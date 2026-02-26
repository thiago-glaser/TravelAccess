import oracledb from 'oracledb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function migrateView() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await oracledb.getConnection({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectionString: process.env.ORACLE_CONNECTION_STRING,
        });

        console.log('Updating V_SESSIONS view...');
        await connection.execute(`
            CREATE OR REPLACE VIEW V_SESSIONS AS
            select 
            S.ID,
            S.DEVICE_ID,
            S.CAR_ID,
            C.DESCRIPTION AS CAR_DESCRIPTION,
            S.START_UTC,
            S.END_UTC,
            S.SESSION_TYPE,
            fix_mojibake(NVL(l1.formatted_address, 'Unknow location')) LOCATION_START,
            fix_mojibake(NVL(l2.formatted_address, 'Unknow location')) LOCATION_END
            from SESSION_DATA S
            LEFT JOIN CARS C ON S.CAR_ID = C.ID
            LEFT JOIN LOCATION_GEOCODE L1 ON (s.geocode_start = l1.id)
            LEFT JOIN LOCATION_GEOCODE L2 ON (s.geocode_end = l2.id)
        `);
        console.log('View V_SESSIONS updated successfully.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log('Connection closed.');
            } catch (err) {
                console.error(err);
            }
        }
    }
}

migrateView();
