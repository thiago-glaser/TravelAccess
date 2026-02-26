const oracledb = require('oracledb');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env or .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const dbConfig = {
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectionString: process.env.ORACLE_CONNECTION_STRING.replace('host.docker.internal', 'localhost'),
};

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function run() {
    let connection;

    try {
        console.log('Connecting to Oracle...');
        connection = await oracledb.getConnection(dbConfig);
        console.log('Connected successfully.');

        console.log('Altering FUEL table...');

        try {
            await connection.execute(`
                ALTER TABLE FUEL ADD (
                    TOTAL_KILOMETERS NUMBER DEFAULT 0,
                    KILOMETER_PER_LITER NUMBER DEFAULT 0,
                    PRICE_PER_KILOMETER NUMBER DEFAULT 0
                )
            `);
            console.log('FUEL table altered successfully.');
        } catch (e) {
            if (e.errorNum === 14320 || e.errorNum === 1430) {
                console.log('Columns already exist in FUEL table.');
            } else {
                throw e;
            }
        }

        await connection.commit();
        console.log('Database modification complete.');

    } catch (err) {
        console.error('Modification failed:', err);
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
}

run();
