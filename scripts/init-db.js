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

        // 3. Create USER_DEVICES mapping table
        console.log('Creating USER_DEVICES table...');
        try {
            await connection.execute(`
                CREATE TABLE USER_DEVICES (
                    USER_ID NUMBER REFERENCES USERS(ID) ON DELETE CASCADE,
                    DEVICE_ID VARCHAR2(50),
                    PRIMARY KEY (USER_ID, DEVICE_ID)
                )
            `);
            console.log('USER_DEVICES table created.');
        } catch (e) {
            if (e.errorNum === 955) {
                console.log('USER_DEVICES table already exists.');
            } else {
                throw e;
            }
        }

        // 4. Map all existing devices to the first user found (as requested)
        console.log('Mapping all devices to the first user...');
        const usersResult = await connection.execute(`SELECT ID FROM USERS FETCH FIRST 1 ROWS ONLY`);
        if (usersResult.rows.length > 0) {
            const userId = usersResult.rows[0].ID;
            const devicesResult = await connection.execute(`SELECT device_id FROM devices`);

            for (const device of devicesResult.rows) {
                try {
                    await connection.execute(
                        `INSERT INTO USER_DEVICES (USER_ID, DEVICE_ID) VALUES (:userId, :deviceId)`,
                        { userId, deviceId: device.DEVICE_ID }
                    );
                    console.log(`Mapped device ${device.DEVICE_ID} to user ID ${userId}`);
                } catch (e) {
                    if (e.errorNum === 1) { // Unique constraint violation (already mapped)
                        console.log(`Device ${device.DEVICE_ID} already mapped to user ${userId}`);
                    } else {
                        console.error(`Error mapping device ${device.DEVICE_ID}:`, e);
                    }
                }
            }
        } else {
            console.log('No users found in database to map devices to.');
        }

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
