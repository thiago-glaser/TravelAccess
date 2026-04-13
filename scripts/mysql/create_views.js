import { query } from '../../lib/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function createViews() {
    console.log("Creating V_SESSIONS...");
    await query(`
        CREATE OR REPLACE VIEW V_SESSIONS AS
        SELECT 
        S.ID,
        S.DEVICE_ID,
        S.CAR_ID,
        C.DESCRIPTION AS CAR_DESCRIPTION,
        S.START_UTC,
        S.END_UTC,
        S.SESSION_TYPE,
        S.COST,
        S.DISTANCE,
        S.TIME_TRAVELED,
        IFNULL(L1.formatted_address, 'Unknow location') AS LOCATION_START,
        IFNULL(L2.formatted_address, 'Unknow location') AS LOCATION_END
        FROM SESSION_DATA S
        LEFT JOIN CARS C ON S.CAR_ID = C.ID
        LEFT JOIN LOCATION_GEOCODE L1 ON S.geocode_start = L1.id
        LEFT JOIN LOCATION_GEOCODE L2 ON S.geocode_end = L2.id;
    `);
    console.log("V_SESSIONS created successfully.");

    console.log("V_SESSION_CALC usage has been refactored away natively via JS directly against SESSION_DATA. No longer creating view.");
    process.exit(0);
}

createViews().catch(err => {
    console.error(err);
    process.exit(1);
});
