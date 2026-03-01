import { getSession } from '@/lib/auth';
import { query, oracledb } from '@/lib/db';
import { calculateTotalDistance, filterLocationsByDistance } from '@/lib/gpsUtils';

export async function POST(request, context) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.USER_ID || session.id || session.ID;
        const { id: fuelId } = await context.params;

        if (!fuelId) {
            return Response.json({ success: false, error: 'Fuel ID is required' }, { status: 400 });
        }

        // 1. Get current fuel record F2
        const f2Res = await query(`
            SELECT TRIM(ID) AS ID, TRIM(CAR_ID) AS CAR_ID, TO_CHAR(TIMESTAMP_UTC, 'YYYY-MM-DD"T"HH24:MI:SS') AS TIMESTAMP_UTC, LITERS, TOTAL_VALUE 
            FROM FUEL 
            WHERE TRIM(ID) = TRIM(:fuelId) AND TRIM(USER_ID) = TRIM(:userId) AND (IS_DELETED = 0 OR IS_DELETED IS NULL)
        `, { fuelId, userId });
        if (f2Res.rows.length === 0) {
            return Response.json({ success: false, error: 'Fuel record not found or not authorized' }, { status: 404 });
        }

        const f2 = f2Res.rows[0];
        const carId = f2.CAR_ID;
        const f2Timestamp = f2.TIMESTAMP_UTC;
        const f2Liters = parseFloat(f2.LITERS) || 0;
        const f2TotalValue = parseFloat(f2.TOTAL_VALUE) || 0;

        const f2TimestampISO = f2.TIMESTAMP_UTC; // The ISO string "2026-02-26T19:00:00Z"
        const f2UtcStr = f2TimestampISO.substring(0, 19).replace('T', ' '); // "2026-02-26 19:00:00"

        // 2. Get previous fuel record F1 for the same car
        const f1Res = await query(`
            SELECT TO_CHAR(TIMESTAMP_UTC, 'YYYY-MM-DD"T"HH24:MI:SS') AS TIMESTAMP_UTC 
            FROM FUEL 
            WHERE TRIM(CAR_ID) = TRIM(:carId) 
              AND TRIM(USER_ID) = TRIM(:userId) 
              AND TIMESTAMP_UTC < TO_DATE(:f2UtcStr, 'YYYY-MM-DD HH24:MI:SS') 
              AND (IS_DELETED = 0 OR IS_DELETED IS NULL)
            ORDER BY TIMESTAMP_UTC DESC 
            FETCH NEXT 1 ROWS ONLY
        `, {
            carId,
            userId,
            f2UtcStr
        });

        if (f1Res.rows.length === 0) {
            return Response.json({ success: false, error: 'Cannot calculate. No previous fuel log found for this car.' }, { status: 400 });
        }

        const f1TimestampISO = f1Res.rows[0].TIMESTAMP_UTC;
        const f1UtcStr = f1TimestampISO.substring(0, 19).replace('T', ' ');

        // 3. Find all sessions for this car within (f1UtcStr, f2UtcStr)
        const sessionsRes = await query(`
            SELECT TRIM(ID) AS ID, DEVICE_ID, TO_CHAR(START_UTC, 'YYYY-MM-DD"T"HH24:MI:SS') AS START_UTC, TO_CHAR(END_UTC, 'YYYY-MM-DD"T"HH24:MI:SS') AS END_UTC 
            FROM V_SESSIONS 
            WHERE TRIM(CAR_ID) = TRIM(:carId) 
              AND START_UTC > TO_DATE(:f1UtcStr, 'YYYY-MM-DD HH24:MI:SS') 
              AND START_UTC < TO_DATE(:f2UtcStr, 'YYYY-MM-DD HH24:MI:SS')
        `, {
            carId,
            f1UtcStr,
            f2UtcStr
        });

        let totalMeters = 0;

        // 4. For each session, fetch location_data and calculate distance
        for (const s of sessionsRes.rows) {
            const deviceId = s.DEVICE_ID;
            const startUtc = s.START_UTC;
            const endUtc = s.END_UTC;

            const sessionEndUtc = endUtc ? endUtc : f2TimestampISO;
            const sStartStr = startUtc.substring(0, 19).replace('T', ' ');
            const sEndStr = sessionEndUtc.substring(0, 19).replace('T', ' ');

            const gpsRes = await query(`
                SELECT LATITUDE, LONGITUDE, TO_CHAR(TIMESTAMP_UTC, 'YYYY-MM-DD"T"HH24:MI:SS') AS TIMESTAMP_UTC 
                FROM LOCATION_DATA 
                WHERE DEVICE_ID = :deviceId 
                  AND TIMESTAMP_UTC >= TO_DATE(:sStartStr, 'YYYY-MM-DD HH24:MI:SS') 
                  AND TIMESTAMP_UTC <= TO_DATE(:sEndStr, 'YYYY-MM-DD HH24:MI:SS')
                ORDER BY TIMESTAMP_UTC ASC
            `, {
                deviceId,
                sStartStr,
                sEndStr
            });

            if (gpsRes.rows.length > 1) {
                const locations = gpsRes.rows.map(row => ({
                    lat: parseFloat(row.LATITUDE),
                    lng: parseFloat(row.LONGITUDE),
                    date: row.TIMESTAMP_UTC
                }));
                // Use filtering to ignore noise if necessary
                const filtered = filterLocationsByDistance(locations, 10);
                const dist = calculateTotalDistance(filtered);
                totalMeters += dist;
            }
        }

        const totalKilometers = totalMeters / 1000;
        const kilometerPerLiter = f2Liters > 0 ? totalKilometers / f2Liters : 0;
        const pricePerKilometer = totalKilometers > 0 ? f2TotalValue / totalKilometers : 0;

        // Update F2 with calculated values
        await query(`
            UPDATE FUEL 
            SET TOTAL_KILOMETERS = :totalKilometers,
                KILOMETER_PER_LITER = :kilometerPerLiter,
                PRICE_PER_KILOMETER = :pricePerKilometer
            WHERE TRIM(ID) = TRIM(:fuelId)
        `, {
            totalKilometers,
            kilometerPerLiter,
            pricePerKilometer,
            fuelId
        });

        // Invalidate the pre-calculated session data for the car so the reports recalculate using the new price
        // Only invalidate sessions between f1 and f2
        await query(`
            UPDATE SESSION_DATA
            SET COST = NULL, DISTANCE = NULL, TIME_TRAVELED = NULL, UPDATED_AT = SYS_EXTRACT_UTC(SYSTIMESTAMP)
            WHERE TRIM(CAR_ID) = TRIM(:carId)
              AND START_UTC > TO_DATE(:f1UtcStr, 'YYYY-MM-DD HH24:MI:SS')
              AND START_UTC < TO_DATE(:f2UtcStr, 'YYYY-MM-DD HH24:MI:SS')
        `, { carId, f1UtcStr, f2UtcStr });

        return Response.json({ success: true, message: 'Calculated successfully' });
    } catch (e) {
        console.error("Calculate Error:", e);
        return Response.json({ success: false, error: e.message || 'Error calculating fuel' }, { status: 500 });
    }
}
