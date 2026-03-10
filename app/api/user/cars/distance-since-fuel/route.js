import { getSession } from '@/lib/auth';
import { Fuel, sequelize } from '@/lib/models/index.js';
import { calculateTotalDistance, filterLocationsByDistance } from '@/lib/gpsUtils';
import { QueryTypes, Op } from 'sequelize';

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
        const lastFuel = await Fuel.findOne({
            where: sequelize.and(
                sequelize.where(sequelize.fn('TRIM', sequelize.col('CAR_ID')), carId.trim()),
                sequelize.where(sequelize.fn('TRIM', sequelize.col('USER_ID')), userId.trim()),
                { isDeleted: { [Op.or]: [0, null] } }
            ),
            order: [['timestampUtc', 'DESC']]
        });

        if (!lastFuel) {
            return Response.json({ success: false, error: 'No fuel log found for this car' }, { status: 404 });
        }

        const lastFuelTimestampISO = lastFuel.get('timestampUtc').toISOString();
        const lastFuelUtcStr = lastFuelTimestampISO.substring(0, 19).replace('T', ' ');

        // 2. Find all sessions for this car where START_UTC > last_fuel_timestamp
        // We use V_SESSIONS as done in the fuel calculation
        const sessions = await sequelize.query(`
            SELECT TRIM(ID) AS ID, DEVICE_ID, TO_CHAR(START_UTC, 'YYYY-MM-DD"T"HH24:MI:SS') AS START_UTC, TO_CHAR(END_UTC, 'YYYY-MM-DD"T"HH24:MI:SS') AS END_UTC 
            FROM V_SESSIONS 
            WHERE TRIM(CAR_ID) = TRIM(:carId) 
              AND START_UTC > TO_DATE(:lastFuelUtcStr, 'YYYY-MM-DD HH24:MI:SS')
        `, {
            replacements: { carId, lastFuelUtcStr },
            type: QueryTypes.SELECT
        });

        let totalMeters = 0;
        let totalMs = 0;
        const nowUtc = new Date().toISOString();

        // 3. For each session, fetch location_data and calculate distance
        for (const s of sessions) {
            const deviceId = s.DEVICE_ID;
            const startUtc = s.START_UTC;
            const endUtc = s.END_UTC;

            const sessionEndUtc = endUtc ? endUtc : nowUtc;
            const sStartStr = startUtc.substring(0, 19).replace('T', ' ');
            const sEndStr = sessionEndUtc.substring(0, 19).replace('T', ' ');

            const gpsLocations = await sequelize.query(`
                SELECT LATITUDE, LONGITUDE, TO_CHAR(TIMESTAMP_UTC, 'YYYY-MM-DD"T"HH24:MI:SS') AS TIMESTAMP_UTC 
                FROM LOCATION_DATA 
                WHERE DEVICE_ID = :deviceId 
                  AND TIMESTAMP_UTC >= TO_DATE(:sStartStr, 'YYYY-MM-DD HH24:MI:SS') 
                  AND TIMESTAMP_UTC <= TO_DATE(:sEndStr, 'YYYY-MM-DD HH24:MI:SS')
                ORDER BY TIMESTAMP_UTC ASC
            `, {
                replacements: { deviceId, sStartStr, sEndStr },
                type: QueryTypes.SELECT
            });

            if (gpsLocations.length > 1) {
                const locations = gpsLocations.map(row => ({
                    lat: parseFloat(row.LATITUDE),
                    lng: parseFloat(row.LONGITUDE),
                    date: row.TIMESTAMP_UTC
                }));
                // Use filtering to ignore noise
                const filtered = filterLocationsByDistance(locations, 10);
                const dist = calculateTotalDistance(filtered);
                totalMeters += dist;

                // Calculate time based on session start and end
                const tStart = new Date(startUtc + 'Z').getTime();
                const tEnd = new Date(endUtc ? endUtc + 'Z' : nowUtc).getTime();
                if (!isNaN(tStart) && !isNaN(tEnd)) {
                    totalMs += Math.max(0, tEnd - tStart);
                }
            }
        }

        const totalKilometers = totalMeters / 1000;

        return Response.json({ success: true, kilometers: totalKilometers, timeMs: totalMs });
    } catch (e) {
        console.error("Calculate Distance Since Fuel Error:", e);
        return Response.json({ success: false, error: e.message || 'Error calculating distance' }, { status: 500 });
    }
}
