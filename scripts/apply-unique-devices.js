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

        // 1. Add UNIQUE constraint to DEVICE_ID in USER_DEVICES
        console.log('Applying UNIQUE constraint to USER_DEVICES.DEVICE_ID...');
        try {
            await connection.execute(`
                ALTER TABLE USER_DEVICES ADD CONSTRAINT UK_DEVICE_ID UNIQUE (DEVICE_ID)
            `);
            console.log('Constraint UK_DEVICE_ID applied.');
        } catch (e) {
            if (e.errorNum === 2261) {
                console.log('Unique constraint already exists.');
            } else if (e.errorNum === 2299) {
                console.error('ERROR: Duplicate devices found across users. Cannot apply unique constraint until duplicates are resolved.');
            } else {
                console.error('Error applying constraint:', e);
            }
        }

        await connection.commit();
        console.log('Constraint script complete.');

    } catch (err) {
        console.error('Failure:', err);
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
