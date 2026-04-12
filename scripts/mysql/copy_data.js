import dotenv from 'dotenv';
dotenv.config(); // The script will be run from the app root

// When running locally outside of docker, we need to override the wallet dir to point correctly
if (process.env.CLOUD_ORACLE_WALLET_DIR === '/app/oracle_wallet') {
    process.env.CLOUD_ORACLE_WALLET_DIR = './oracle_wallet';
}

const { Sequelize, DataTypes } = await import('sequelize');
const { default: oracleSequelize } = await import('../../lib/sequelize.js');
const oracleModels = await import('../../lib/models/index.js');

// Setup MySQL Connection
const mysqlSequelize = new Sequelize(
    process.env.MYSQL_DATABASE, 
    process.env.MYSQL_USER, 
    process.env.MYSQL_PASSWORD, 
    {
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT || 3306,
        dialect: 'mysql',
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
        const viewsToSkip = ['SessionView', 'SessionCalc'];

        // 1. Define models on MySQL
        for (const [modelName, OracleModel] of Object.entries(oracleModels)) {
            if (modelName === 'sequelize' || viewsToSkip.includes(modelName)) continue;

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
                        cleanAttributes[key].type = DataTypes.BLOB;
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
            if (modelName === 'sequelize' || viewsToSkip.includes(modelName)) continue;
            
            const totalRecords = await OracleModel.count();
            console.log(`Reading ${totalRecords} records from Oracle for ${modelName}...`);
            
            if (totalRecords > 0) {
                const MysqlModel = mysqlModelsObj[modelName];
                const batchSize = 1000;
                
                // Identify a column to order by for consistent pagination. Usually 'id', or just the first PK.
                let orderColumn = [];
                const primaryKeys = Object.keys(OracleModel.primaryKeys || {});
                if (primaryKeys.length > 0) {
                    orderColumn.push([primaryKeys[0], 'ASC']);
                }

                for (let offset = 0; offset < totalRecords; offset += batchSize) {
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
                        await MysqlModel.bulkCreate(records, { validate: false, ignoreDuplicates: true });
                        console.log(` - Migrated ${offset + records.length} / ${totalRecords} for ${modelName}`);
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
