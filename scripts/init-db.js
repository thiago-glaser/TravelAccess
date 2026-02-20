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

async function run() {
    let connection;

    try {
        console.log('Connecting to Oracle...');
        connection = await oracledb.getConnection(dbConfig);
        console.log('Connected successfully.');

        // 1. Create USERS table
        console.log('Creating USERS table...');
        try {
            await connection.execute(`
                CREATE TABLE USERS (
                    ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    USERNAME VARCHAR2(50) UNIQUE NOT NULL,
                    PASSWORD_HASH VARCHAR2(255) NOT NULL,
                    EMAIL VARCHAR2(100),
                    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    IS_ADMIN NUMBER(1) DEFAULT 0
                )
            `);
            console.log('USERS table created.');
        } catch (e) {
            if (e.errorNum === 955) {
                console.log('USERS table already exists.');
            } else {
                throw e;
            }
        }

        // 2. Create API_KEYS table
        console.log('Creating API_KEYS table...');
        try {
            await connection.execute(`
                CREATE TABLE API_KEYS (
                    ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    USER_ID NUMBER REFERENCES USERS(ID) ON DELETE CASCADE,
                    KEY_VALUE VARCHAR2(64) UNIQUE NOT NULL,
                    DESCRIPTION VARCHAR2(100),
                    IS_ACTIVE NUMBER(1) DEFAULT 1,
                    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    LAST_USED TIMESTAMP
                )
            `);
            console.log('API_KEYS table created.');
        } catch (e) {
            if (e.errorNum === 955) {
                console.log('API_KEYS table already exists.');
            } else {
                throw e;
            }
        }

        // 3. Create a default admin user (password: admin123)
        // Note: In a real app, we'd hash this. For the script, I'll use a placeholder or hash it if I have bcrypt.
        // For now, I'll just create the table and let the app handle registration.

        await connection.commit();
        console.log('Database initialization complete.');

    } catch (err) {
        console.error('Initialization failed:', err);
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
