import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { calculateTotalDistance, filterLocationsByDistance } from '@/lib/gpsUtils';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const carId = searchParams.get('carId');

        if (!carId) {
            return Response.json({ success: false, error: 'Car ID is required' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;

        // 1. Get the most recent fuel record for the given car
        const lastFuelRes = await query(`
            SELECT TO_CHAR(TIMESTAMP_UTC, 'YYYY-MM-DD"T"HH24:MI:SS') AS TIMESTAMP_UTC 
            FROM FUEL 
            WHERE TRIM(CAR_ID) = TRIM(:carId) AND TRIM(USER_ID) = TRIM(:userId) AND (IS_DELETED = 0 OR IS_DELETED IS NULL)
            ORDER BY TIMESTAMP_UTC DESC 
            FETCH NEXT 1 ROWS ONLY
        `, { carId, userId });

        if (lastFuelRes.rows.length === 0) {
            return Response.json({ success: false, error: 'No fuel log found for this car' }, { status: 404 });
        }

        const lastFuelTimestampISO = lastFuelRes.rows[0].TIMESTAMP_UTC;
        const lastFuelUtcStr = lastFuelTimestampISO.substring(0, 19).replace('T', ' ');

        // 2. Find all sessions for this car where START_UTC > last_fuel_timestamp
        // We use V_SESSIONS as done in the fuel calculation
        const sessionsRes = await query(`
            SELECT TRIM(ID) AS ID, DEVICE_ID, TO_CHAR(START_UTC, 'YYYY-MM-DD"T"HH24:MI:SS') AS START_UTC, TO_CHAR(END_UTC, 'YYYY-MM-DD"T"HH24:MI:SS') AS END_UTC 
            FROM V_SESSIONS 
            WHERE TRIM(CAR_ID) = TRIM(:carId) 
              AND START_UTC > TO_DATE(:lastFuelUtcStr, 'YYYY-MM-DD HH24:MI:SS')
        `, {
            carId,
            lastFuelUtcStr
        });

        let totalMeters = 0;
        const nowUtc = new Date().toISOString();

        // 3. For each session, fetch location_data and calculate distance
        for (const s of sessionsRes.rows) {
            const deviceId = s.DEVICE_ID;
            const startUtc = s.START_UTC;
            const endUtc = s.END_UTC;

            const sessionEndUtc = endUtc ? endUtc : nowUtc;
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
                // Use filtering to ignore noise
                const filtered = filterLocationsByDistance(locations, 10);
                const dist = calculateTotalDistance(filtered);
                totalMeters += dist;
            }
        }

        const totalKilometers = totalMeters / 1000;

        return Response.json({ success: true, kilometers: totalKilometers });
    } catch (e) {
        console.error("Calculate Distance Since Fuel Error:", e);
        return Response.json({ success: false, error: e.message || 'Error calculating distance' }, { status: 500 });
    }
}
