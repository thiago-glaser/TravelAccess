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
        const f2Res = await query(`SELECT ID, CAR_ID, TIMESTAMP_UTC, LITERS, TOTAL_VALUE FROM FUEL WHERE ID = :fuelId AND USER_ID = :userId`, { fuelId, userId });
        if (f2Res.rows.length === 0) {
            return Response.json({ success: false, error: 'Fuel record not found or not authorized' }, { status: 404 });
        }

        const f2 = f2Res.rows[0];
        const carId = f2.CAR_ID;
        const f2Timestamp = f2.TIMESTAMP_UTC;
        const f2Liters = parseFloat(f2.LITERS) || 0;
        const f2TotalValue = parseFloat(f2.TOTAL_VALUE) || 0;

        // 2. Get previous fuel record F1 for the same car
        const f1Res = await query(`
            SELECT TIMESTAMP_UTC 
            FROM FUEL 
            WHERE CAR_ID = :carId 
              AND USER_ID = :userId 
              AND TIMESTAMP_UTC < :f2Timestamp 
            ORDER BY TIMESTAMP_UTC DESC 
            FETCH NEXT 1 ROWS ONLY
        `, {
            carId,
            userId,
            f2Timestamp: { type: oracledb.DATE, val: f2Timestamp }
        });

        if (f1Res.rows.length === 0) {
            return Response.json({ success: false, error: 'Cannot calculate. No previous fuel log found for this car.' }, { status: 400 });
        }

        const f1Timestamp = f1Res.rows[0].TIMESTAMP_UTC;

        // 3. Find all sessions for this car within [f1Timestamp, f2Timestamp]
        const sessionsRes = await query(`
            SELECT ID, DEVICE_ID, START_UTC, END_UTC 
            FROM V_SESSIONS 
            WHERE CAR_ID = :carId 
              AND START_UTC >= :f1Timestamp 
              AND START_UTC <= :f2Timestamp
        `, {
            carId,
            f1Timestamp: { type: oracledb.DATE, val: f1Timestamp },
            f2Timestamp: { type: oracledb.DATE, val: f2Timestamp }
        });

        let totalMeters = 0;

        // 4. For each session, fetch location_data and calculate distance
        for (const s of sessionsRes.rows) {
            const deviceId = s.DEVICE_ID;
            const startUtc = s.START_UTC;
            const endUtc = s.END_UTC;

            const sessionEndUtc = endUtc ? endUtc : f2Timestamp;

            const gpsRes = await query(`
                SELECT LATITUDE, LONGITUDE, TIMESTAMP_UTC 
                FROM LOCATION_DATA 
                WHERE DEVICE_ID = :deviceId 
                  AND TIMESTAMP_UTC >= :startUtc 
                  AND TIMESTAMP_UTC <= :endUtc
                ORDER BY TIMESTAMP_UTC ASC
            `, {
                deviceId,
                startUtc: { type: oracledb.DATE, val: startUtc },
                endUtc: { type: oracledb.DATE, val: sessionEndUtc }
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
            WHERE ID = :fuelId
        `, {
            totalKilometers,
            kilometerPerLiter,
            pricePerKilometer,
            fuelId
        });

        return Response.json({ success: true, message: 'Calculated successfully' });
    } catch (e) {
        console.error("Calculate Error:", e);
        return Response.json({ success: false, error: e.message || 'Error calculating fuel' }, { status: 500 });
    }
}
