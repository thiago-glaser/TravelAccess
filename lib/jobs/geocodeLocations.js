import { getConnection, oracledb } from '@/lib/db';
import crypto from 'crypto';

async function getGeocodeJSON(lat, lon, apiKey) {
    const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${apiKey}`;
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Node.js',
                'Accept': 'application/json'
            }
        });
        if (!response.ok) {
            console.error(`Geoapify error: ${response.status} ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        if (data && data.features && data.features.length > 0) {
            return data.features[0].properties;
        }
        return null;
    } catch (err) {
        console.error('getGeocodeJSON exception:', err.message);
        return null;
    }
}

export async function runGeocodeLocationsJob() {
    let connection;
    try {
        connection = await getConnection();

        const apiKey = process.env.GEOAPIFY_API_KEY;

        if (!apiKey) {
            console.log('No GEOAPIFY_API_KEY found in environment variables.');
            return { error: 'No API_KEY provided' };
        }

        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        let callCount = 0;

        // 1. GEOCODE_FIRST_10_LOCATIONS
        const locationsQuery = `
            SELECT l.ID, l.LATITUDE, l.LONGITUDE, l.timestamp_utc_start
            FROM LOCATION l
            WHERE l.LOCATION_GEOCODE_ID IS NULL
              AND l.ID <> (
                  SELECT MAX(m.ID) KEEP (DENSE_RANK LAST ORDER BY m.TIMESTAMP_UTC_START)
                  FROM LOCATION m
                  WHERE m.DEVICE_ID = l.DEVICE_ID
              )
            ORDER BY l.timestamp_utc_start DESC
            FETCH FIRST 10 ROWS ONLY
        `;

        const locResult = await connection.execute(locationsQuery, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });

        for (const loc of locResult.rows) {
            if (callCount > 0) await sleep(500); // Wait 500ms to respect rate limit of approx 2/sec
            callCount++;

            const feat = await getGeocodeJSON(loc.LATITUDE, loc.LONGITUDE, apiKey);
            if (!feat) continue;

            let geocodeId = null;
            const placeId = feat.place_id;

            const existingResult = await connection.execute(
                `SELECT ID FROM LOCATION_GEOCODE WHERE PLACE_ID = :placeId`,
                { placeId },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );

            if (existingResult.rows.length === 0) {
                // Generate a random 32-char hex string similar to SYS_GUID()
                geocodeId = crypto.randomBytes(16).toString('hex').toUpperCase();

                const insertGeoSql = `
                    INSERT INTO LOCATION_GEOCODE (
                        ID, PLACE_ID, PLUS_CODE, FORMATTED_ADDRESS,
                        ADDRESS_LINE1, ADDRESS_LINE2, HOUSENUMBER, STREET,
                        SUBURB, CITY, POSTCODE, COUNTY, STATE, COUNTRY,
                        RESULT_TYPE, GEOCODE_DISTANCE_M,
                        TIMEZONE_NAME, TIMEZONE_OFFSET_STD, TIMEZONE_OFFSET_DST,
                        GEOCODED_AT
                    ) VALUES (
                        :id, :place_id, :plus_code, :formatted,
                        :addr1, :addr2, :housenumber, :street,
                        :suburb, :city, :postcode, :county, :state, :country,
                        :result_type, :distance,
                        :tz_name, :tz_std, :tz_dst,
                        SYSTIMESTAMP
                    )
                `;

                await connection.execute(insertGeoSql, {
                    id: geocodeId,
                    place_id: feat.place_id,
                    plus_code: feat.plus_code,
                    formatted: feat.formatted,
                    addr1: feat.address_line1 || null,
                    addr2: feat.address_line2 || null,
                    housenumber: feat.housenumber || null,
                    street: feat.street || null,
                    suburb: feat.suburb || null,
                    city: feat.city || null,
                    postcode: feat.postcode || null,
                    county: feat.county || null,
                    state: feat.state || null,
                    country: feat.country || null,
                    result_type: feat.result_type || null,
                    distance: feat.distance || null,
                    tz_name: feat.timezone?.name || null,
                    tz_std: feat.timezone?.offset_STD || null,
                    tz_dst: feat.timezone?.offset_DST || null
                }, { autoCommit: true });
                console.log('[Geocode] NEW -> ' + feat.formatted);
            } else {
                geocodeId = existingResult.rows[0].ID;
                console.log('[Geocode] REUSE -> ' + feat.formatted);
            }

            if (geocodeId) {
                await connection.execute(
                    `UPDATE LOCATION SET LOCATION_GEOCODE_ID = :geocodeId WHERE ID = :id`,
                    { geocodeId, id: loc.ID },
                    { autoCommit: true }
                );
            }
        }

        // 2. GEOCODE_SESSION
        const sessionsQuery = `
            SELECT 
            SESSION_ID AS ID,
            GEOCODE_START,
            START_LATITUDE AS LATITUDE,
            START_LONGITUDE AS LONGITUDE,
            'S' AS STATUS
            FROM V_SESSION_CALC
            WHERE GEOCODE_START IS NULL AND START_LOCATION_UTC IS NOT NULL
            UNION ALL 
            SELECT 
            SESSION_ID,
            GEOCODE_END,
            END_LATITUDE,
            END_LONGITUDE,
            'E'
            FROM V_SESSION_CALC
            WHERE GEOCODE_END IS NULL AND END_LOCATION_UTC IS NOT NULL
        `;

        const sessionsResult = await connection.execute(sessionsQuery, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });

        for (const sess of sessionsResult.rows) {
            if (callCount > 0) await sleep(500);
            callCount++;

            const feat = await getGeocodeJSON(sess.LATITUDE, sess.LONGITUDE, apiKey);
            if (!feat) continue;

            let geocodeId = null;
            const placeId = feat.place_id;

            const existingResult = await connection.execute(
                `SELECT ID FROM LOCATION_GEOCODE WHERE PLACE_ID = :placeId`,
                { placeId },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );

            if (existingResult.rows.length === 0) {
                geocodeId = crypto.randomBytes(16).toString('hex').toUpperCase();

                const insertGeoSql = `
                    INSERT INTO LOCATION_GEOCODE (
                        ID, PLACE_ID, PLUS_CODE, FORMATTED_ADDRESS,
                        ADDRESS_LINE1, ADDRESS_LINE2, HOUSENUMBER, STREET,
                        SUBURB, CITY, POSTCODE, COUNTY, STATE, COUNTRY,
                        RESULT_TYPE, GEOCODE_DISTANCE_M,
                        TIMEZONE_NAME, TIMEZONE_OFFSET_STD, TIMEZONE_OFFSET_DST,
                        GEOCODED_AT
                    ) VALUES (
                        :id, :place_id, :plus_code, :formatted,
                        :addr1, :addr2, :housenumber, :street,
                        :suburb, :city, :postcode, :county, :state, :country,
                        :result_type, :distance,
                        :tz_name, :tz_std, :tz_dst,
                        SYSTIMESTAMP
                    )
                `;

                await connection.execute(insertGeoSql, {
                    id: geocodeId,
                    place_id: feat.place_id,
                    plus_code: feat.plus_code,
                    formatted: feat.formatted,
                    addr1: feat.address_line1 || null,
                    addr2: feat.address_line2 || null,
                    housenumber: feat.housenumber || null,
                    street: feat.street || null,
                    suburb: feat.suburb || null,
                    city: feat.city || null,
                    postcode: feat.postcode || null,
                    county: feat.county || null,
                    state: feat.state || null,
                    country: feat.country || null,
                    result_type: feat.result_type || null,
                    distance: feat.distance || null,
                    tz_name: feat.timezone?.name || null,
                    tz_std: feat.timezone?.offset_STD || null,
                    tz_dst: feat.timezone?.offset_DST || null
                }, { autoCommit: true });
                console.log('[Geocode] NEW Session -> ' + feat.formatted);
            } else {
                geocodeId = existingResult.rows[0].ID;
                console.log('[Geocode] REUSE Session -> ' + feat.formatted);
            }

            if (geocodeId) {
                if (sess.STATUS === 'S') {
                    await connection.execute(
                        `UPDATE SESSION_DATA SET GEOCODE_START = :geocodeId WHERE ID = :id`,
                        { geocodeId, id: sess.ID },
                        { autoCommit: true }
                    );
                } else {
                    await connection.execute(
                        `UPDATE SESSION_DATA SET GEOCODE_END = :geocodeId WHERE ID = :id`,
                        { geocodeId, id: sess.ID },
                        { autoCommit: true }
                    );
                }
            }
        }

        return { status: 'success', callsMade: callCount };

    } catch (err) {
        console.error('Error in runGeocodeLocationsJob:', err);
        throw err;
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { }
        }
    }
}
