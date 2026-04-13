import dotenv from 'dotenv';
import path from 'path';
import oracledb from 'oracledb';
dotenv.config(); // The script will be run from the app root

// When running locally outside of docker, we need to override the wallet dir to point correctly
if (process.env.CLOUD_ORACLE_WALLET_DIR === '/app/oracle_wallet') {
    process.env.CLOUD_ORACLE_WALLET_DIR = './oracle_wallet';
}

// Ensure oracledb fetches BLOBs as Buffers so they can be easily copied to MySQL
oracledb.fetchAsBuffer = [oracledb.BLOB];

// Force the entire process to treat dates as UTC
process.env.TZ = 'UTC';

const { Sequelize, DataTypes } = await import('sequelize');
const oracleModels = await import('../../lib/models/index.js');

// Setup REAL Oracle Source Connection 
// (We don't use lib/sequelize.js because that has been switched to MySQL for the app)
const isCloud = process.env.USE_CLOUD_DB === 'true';
const oraclePrefix = isCloud ? 'CLOUD_ORACLE_' : 'ORACLE_';

console.log(`Connecting to Oracle (Cloud: ${isCloud})...`);

const oracleSequelize = new Sequelize({
    dialect: 'oracle',
    username: process.env[`${oraclePrefix}USER`],
    password: process.env[`${oraclePrefix}PASSWORD`],
    // Standard Sequelize Oracle dialect often expects connectString in dialectOptions
    dialectOptions: {
        connectString: process.env[`${oraclePrefix}CONNECTION_STRING`],
        walletLocation: path.resolve(process.env.CLOUD_ORACLE_WALLET_DIR),
        walletPassword: process.env.CLOUD_ORACLE_WALLET_PASSWORD,
        sslServerDnMatch: true
    },
    logging: false,
    timezone: '+00:00'
});

// Re-initialize models on the REAL Oracle connection
for (const [modelName, ModelClass] of Object.entries(oracleModels)) {
    if (modelName === 'sequelize' || typeof ModelClass !== 'function' || !ModelClass.init) continue;
    
    // We re-init to bind to our local oracleSequelize instead of the MySQL one in lib/sequelize.js
    ModelClass.init(ModelClass.getAttributes(), {
        sequelize: oracleSequelize,
        tableName: ModelClass.tableName,
        timestamps: ModelClass.options?.timestamps,
        createdAt: ModelClass.options?.createdAt,
        updatedAt: ModelClass.options?.updatedAt,
        deletedAt: ModelClass.options?.deletedAt,
        paranoid: ModelClass.options?.paranoid,
        freezeTableName: true
    });
}

// Setup MySQL Connection
const mysqlSequelize = new Sequelize(
    process.env.MYSQL_DATABASE,
    process.env.MYSQL_USER,
    process.env.MYSQL_PASSWORD,
    {
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT || 3306,
        dialect: 'mysql',
        timezone: '+00:00', // Strictly enforce UTC for target
        logging: false,
        pool: { max: 1, min: 1 } // Force single connection to ensure session variables persist
    }
);

async function run() {
    try {
        console.log('Connecting to Oracle...');
        await oracleSequelize.authenticate();
        console.log('Connected to Oracle.');

        console.log('Connecting to MySQL...');
        await mysqlSequelize.authenticate();
        console.log('Connected to MySQL.');

        console.log('Disabling foreign key checks on MySQL...');
        await mysqlSequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

        const mysqlModelsObj = {};
        const oracleRecordsCount = {};
        const viewsToSkip = ['SessionView', 'SessionCalc'];

        // 1. Define models on MySQL
        for (const [modelName, OracleModel] of Object.entries(oracleModels)) {
            if (modelName === 'sequelize' || viewsToSkip.includes(modelName)) continue;

            // PRE-CHECK: Confirm table exists in Oracle and get total records to avoid queries on missing tables
            let totalRecords = 0;
            try {
                totalRecords = await OracleModel.count();
                oracleRecordsCount[modelName] = totalRecords;
            } catch (err) {
                if (err.message && err.message.includes('ORA-00942') || (err.parent && err.parent.message && err.parent.message.includes('ORA-00942'))) {
                    console.warn(`[WARN] Skipping model ${modelName} - Table ${OracleModel.tableName} does not exist in Oracle.`);
                    continue;
                }
                throw err;
            }

            const attributes = { ...OracleModel.getAttributes() };

            // Clean up attributes
            const cleanAttributes = {};
            for (const key in attributes) {
                cleanAttributes[key] = { ...attributes[key] };
                delete cleanAttributes[key].Model;

                // Normalize DataTypes because Sequelize type instances carry dialect-specific 
                // characteristics (like NVARCHAR2 for Oracle) over to MySQL if we copy them blindly.
                const oldType = cleanAttributes[key].type;
                if (oldType) {
                    const typeName = oldType.key || (oldType.constructor && oldType.constructor.name) || '';
                    if (typeName === 'STRING') {
                        cleanAttributes[key].type = DataTypes.STRING(oldType.options?.length || oldType._length);
                    } else if (typeName === 'CHAR') {
                        cleanAttributes[key].type = DataTypes.CHAR(oldType.options?.length || oldType._length);
                    } else if (typeName === 'INTEGER') {
                        cleanAttributes[key].type = DataTypes.INTEGER;
                    } else if (typeName === 'DECIMAL' || typeName === 'FLOAT' || typeName === 'DOUBLE') {
                        const precision = oldType.options?.precision || oldType._precision || 20;
                        const scale = oldType.options?.scale || oldType._scale || 10;
                        cleanAttributes[key].type = DataTypes.DECIMAL(precision, scale);
                    } else if (typeName === 'DATE') {
                        cleanAttributes[key].type = DataTypes.DATE;
                    } else if (typeName === 'BLOB') {
                        // Use LONGBLOB (4GB) in MySQL to ensure we don't truncate large images/files
                        cleanAttributes[key].type = DataTypes.BLOB('long');
                    } else if (typeName === 'BOOLEAN') {
                        cleanAttributes[key].type = DataTypes.BOOLEAN;
                    } else if (typeof oldType === 'string') {
                        if (oldType.toUpperCase().includes('NVARCHAR2') || oldType.toUpperCase().includes('VARCHAR2')) {
                            const match = oldType.match(/\((\d+)\)/);
                            cleanAttributes[key].type = DataTypes.STRING(match ? parseInt(match[1]) : 255);
                        } else if (oldType.toUpperCase().includes('NUMBER')) {
                            cleanAttributes[key].type = DataTypes.DECIMAL(20, 10);
                        }
                    }
                }
            }

            mysqlModelsObj[modelName] = mysqlSequelize.define(OracleModel.name, cleanAttributes, {
                tableName: OracleModel.tableName,
                timestamps: OracleModel.options.timestamps,
                createdAt: OracleModel.options.createdAt,
                updatedAt: OracleModel.options.updatedAt,
                freezeTableName: OracleModel.options.freezeTableName,
                paranoid: OracleModel.options.paranoid,
                deletedAt: OracleModel.options.deletedAt
            });
        }

        // 2. Drop ALL existing tables in the database
        console.log('Fetching all existing tables to drop them...');
        const [existingTables] = await mysqlSequelize.query('SHOW TABLES');
        if (existingTables && existingTables.length > 0) {
            const tableNames = existingTables.map(row => Object.values(row)[0]);
            console.log(`Found ${tableNames.length} existing tables. Dropping them all...`);
            for (const tableName of tableNames) {
                await mysqlSequelize.query(`DROP TABLE IF EXISTS \`${tableName}\`;`);
            }
        }

        // 3. Create tables in MySQL
        console.log('Creating MySQL tables...');
        for (const [modelName, model] of Object.entries(mysqlModelsObj)) {
            console.log(`Creating ${modelName} table (${model.tableName})...`);
            await model.sync({ force: true });
        }

        // 4. Copy data in batches
        for (const [modelName, OracleModel] of Object.entries(oracleModels)) {
            if (modelName === 'sequelize' || viewsToSkip.includes(modelName) || !mysqlModelsObj[modelName] || oracleRecordsCount[modelName] === undefined) continue;

            const totalRecords = oracleRecordsCount[modelName];
            console.log(`Reading ${totalRecords} records from Oracle for ${modelName}...`);

            if (totalRecords > 0) {
                const MysqlModel = mysqlModelsObj[modelName];
                const batchSize = 25000;

                // Identify a column to order by for consistent pagination. Usually 'id', or just the first PK.
                let orderColumn = [];
                const primaryKeys = Object.keys(OracleModel.primaryKeys || {});
                if (primaryKeys.length > 0) {
                    orderColumn.push([primaryKeys[0], 'ASC']);
                }

                for (let offset = 0; offset < totalRecords; offset += batchSize) {
                    const batchStart = Date.now();
                    const queryOptions = {
                        raw: true,
                        limit: batchSize,
                        offset: offset
                    };
                    if (orderColumn.length > 0) {
                        queryOptions.order = orderColumn;
                    }

                    const records = await OracleModel.findAll(queryOptions);

                    if (records.length > 0) {
                        // Ensure all dates are correctly handled as UTC strings for raw insertion
                        // This helps if the source connection didn't have UTC configured correctly.
                        const fixedRecords = await Promise.all(records.map(async record => {
                            const newRecord = { ...record };
                            for (const key in newRecord) {
                                const val = newRecord[key];
                                if (val instanceof Date) {
                                    newRecord[key] = val.toISOString().slice(0, 19).replace('T', ' ');
                                } else if (val && typeof val === 'object' && val.pipe && typeof val.on === 'function') {
                                    // It's a Stream/Lob object, we must convert it to a Buffer manually
                                    newRecord[key] = await new Promise((resolve, reject) => {
                                        const chunks = [];
                                        val.on('data', chunk => chunks.push(chunk));
                                        val.on('error', reject);
                                        val.on('end', () => resolve(Buffer.concat(chunks)));
                                    });
                                }
                            }
                            return newRecord;
                        }));

                        await MysqlModel.bulkCreate(fixedRecords, { validate: false, ignoreDuplicates: true });
                        const duration = ((Date.now() - batchStart) / 1000).toFixed(2);
                        console.log(` - Migrated ${offset + records.length} / ${totalRecords} for ${modelName} in ${duration}s`);
                    }
                }
            }
        }

        console.log('Re-enabling foreign key checks on MySQL...');
        await mysqlSequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

        console.log('Data copy completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error occurred:', err);
        process.exit(1);
    }
}

run();
