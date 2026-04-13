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

    console.log("Creating V_SESSION_CALC...");
    await query(`
        CREATE OR REPLACE VIEW V_SESSION_CALC AS
        SELECT
            s.id AS session_id,
            s.start_utc AS session_start_utc,
            s.end_utc   AS session_end_utc,

            CASE
                WHEN IFNULL(bs.before_start_diff, 999999999) <= IFNULL(as_.after_start_diff, 999999999) THEN bs.before_start_id
                ELSE as_.after_start_id
            END AS start_location_id,

            CASE
                WHEN IFNULL(bs.before_start_diff, 999999999) <= IFNULL(as_.after_start_diff, 999999999) THEN bs.before_start_ts
                ELSE as_.after_start_ts
            END AS start_location_utc,

            CASE
                WHEN IFNULL(bs.before_start_diff, 999999999) <= IFNULL(as_.after_start_diff, 999999999) THEN bs.before_start_lat
                ELSE as_.after_start_lat
            END AS start_latitude,

            CASE
                WHEN IFNULL(bs.before_start_diff, 999999999) <= IFNULL(as_.after_start_diff, 999999999) THEN bs.before_start_lon
                ELSE as_.after_start_lon
            END AS start_longitude,

            CASE
                WHEN IFNULL(be.before_end_diff, 999999999) <= IFNULL(ae.after_end_diff, 999999999) THEN be.before_end_id
                ELSE ae.after_end_id
            END AS end_location_id,

            CASE
                WHEN IFNULL(be.before_end_diff, 999999999) <= IFNULL(ae.after_end_diff, 999999999) THEN be.before_end_ts
                ELSE ae.after_end_ts
            END AS end_location_utc,

            CASE
                WHEN IFNULL(be.before_end_diff, 999999999) <= IFNULL(ae.after_end_diff, 999999999) THEN be.before_end_lat
                ELSE ae.after_end_lat
            END AS end_latitude,

            CASE
                WHEN IFNULL(be.before_end_diff, 999999999) <= IFNULL(ae.after_end_diff, 999999999) THEN be.before_end_lon
                ELSE ae.after_end_lon
            END AS end_longitude,
            s.geocode_start,
            s.geocode_end

        FROM SESSION_DATA s

        LEFT JOIN LATERAL (
            SELECT
                b.id        AS before_start_id,
                b.timestamp_utc AS before_start_ts,
                b.latitude  AS before_start_lat,
                b.longitude AS before_start_lon,
                TIMESTAMPDIFF(SECOND, b.timestamp_utc, s.start_utc) AS before_start_diff
            FROM LOCATION_DATA b
            WHERE b.device_id = s.device_id
              AND b.timestamp_utc <= s.start_utc
            ORDER BY b.timestamp_utc DESC
            LIMIT 1
        ) bs ON TRUE

        LEFT JOIN LATERAL (
            SELECT
                a.id        AS after_start_id,
                a.timestamp_utc AS after_start_ts,
                a.latitude  AS after_start_lat,
                a.longitude AS after_start_lon,
                TIMESTAMPDIFF(SECOND, s.start_utc, a.timestamp_utc) AS after_start_diff
            FROM LOCATION_DATA a
            WHERE a.device_id = s.device_id
              AND a.timestamp_utc > s.start_utc
            ORDER BY a.timestamp_utc
            LIMIT 1
        ) as_ ON TRUE

        LEFT JOIN LATERAL (
            SELECT
                b.id        AS before_end_id,
                b.timestamp_utc AS before_end_ts,
                b.latitude  AS before_end_lat,
                b.longitude AS before_end_lon,
                TIMESTAMPDIFF(SECOND, b.timestamp_utc, s.end_utc) AS before_end_diff
            FROM LOCATION_DATA b
            WHERE b.device_id = s.device_id
              AND b.timestamp_utc <= s.end_utc
            ORDER BY b.timestamp_utc DESC
            LIMIT 1
        ) be ON TRUE

        LEFT JOIN LATERAL (
            SELECT
                a.id        AS after_end_id,
                a.timestamp_utc AS after_end_ts,
                a.latitude  AS after_end_lat,
                a.longitude AS after_end_lon,
                TIMESTAMPDIFF(SECOND, s.end_utc, a.timestamp_utc) AS after_end_diff
            FROM LOCATION_DATA a
            WHERE a.device_id = s.device_id
              AND a.timestamp_utc > s.end_utc
            ORDER BY a.timestamp_utc
            LIMIT 1
        ) ae ON TRUE
    `);
    console.log("V_SESSION_CALC created successfully.");
    process.exit(0);
}

createViews().catch(err => {
    console.error(err);
    process.exit(1);
});
