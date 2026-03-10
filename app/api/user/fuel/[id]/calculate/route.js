import { getSession } from '@/lib/auth';
import { Fuel, sequelize } from '@/lib/models/index.js';
import { calculateTotalDistance, filterLocationsByDistance } from '@/lib/gpsUtils';
import { QueryTypes, Op } from 'sequelize';

export async function POST(request, context) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.USER_ID || session.id || session.ID;

        // In Next.js 15+, params is a promise
        const params = await context.params;
        const fuelId = params.id;

        if (!fuelId) {
            return Response.json({ success: false, error: 'Fuel ID is required' }, { status: 400 });
        }

        // 1. Get current fuel record F2
        const f2 = await Fuel.findOne({
            where: sequelize.and(
                sequelize.where(sequelize.fn('TRIM', sequelize.col('ID')), fuelId.trim()),
                sequelize.where(sequelize.fn('TRIM', sequelize.col('USER_ID')), userId.trim()),
                { isDeleted: { [Op.or]: [0, null] } }
            )
        });

        if (!f2) {
            return Response.json({ success: false, error: 'Fuel record not found or not authorized' }, { status: 404 });
        }

        const carId = f2.get('carId').trim();
        const f2Timestamp = f2.get('timestampUtc'); // This is a Date object
        const f2Liters = parseFloat(f2.get('liters')) || 0;
        const f2TotalValue = parseFloat(f2.get('totalValue')) || 0;

        const f2TimestampISO = f2Timestamp.toISOString(); // "2026-02-26T19:00:00.000Z"
        const f2UtcStr = f2TimestampISO.substring(0, 19).replace('T', ' '); // "2026-02-26 19:00:00"

        // 2. Get previous fuel record F1 for the same car
        const f1 = await Fuel.findOne({
            where: sequelize.and(
                sequelize.where(sequelize.fn('TRIM', sequelize.col('CAR_ID')), carId),
                sequelize.where(sequelize.fn('TRIM', sequelize.col('USER_ID')), userId.trim()),
                { timestampUtc: { [Op.lt]: f2Timestamp } },
                { isDeleted: { [Op.or]: [0, null] } }
            ),
            order: [['timestampUtc', 'DESC']]
        });

        if (!f1) {
            return Response.json({ success: false, error: 'Cannot calculate. No previous fuel log found for this car.' }, { status: 400 });
        }

        const f1TimestampISO = f1.get('timestampUtc').toISOString();
        const f1UtcStr = f1TimestampISO.substring(0, 19).replace('T', ' ');

        // 3. Find all sessions for this car within (f1UtcStr, f2UtcStr)
        // V_SESSIONS is a view, and we don't have a model, so we use raw query
        const sessions = await sequelize.query(`
            SELECT TRIM(ID) AS ID, DEVICE_ID, TO_CHAR(START_UTC, 'YYYY-MM-DD"T"HH24:MI:SS') AS START_UTC, TO_CHAR(END_UTC, 'YYYY-MM-DD"T"HH24:MI:SS') AS END_UTC 
            FROM V_SESSIONS 
            WHERE TRIM(CAR_ID) = TRIM(:carId) 
              AND START_UTC > TO_DATE(:f1UtcStr, 'YYYY-MM-DD HH24:MI:SS') 
              AND START_UTC < TO_DATE(:f2UtcStr, 'YYYY-MM-DD HH24:MI:SS')
        `, {
            replacements: { carId, f1UtcStr, f2UtcStr },
            type: QueryTypes.SELECT
        });

        let totalMeters = 0;

        // 4. For each session, fetch location_data and calculate distance
        for (const s of sessions) {
            const deviceId = s.DEVICE_ID;
            const startUtc = s.START_UTC;
            const endUtc = s.END_UTC;

            const sessionEndUtc = endUtc ? endUtc : f2TimestampISO;
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
        f2.totalKilometers = totalKilometers;
        f2.kilometerPerLiter = kilometerPerLiter;
        f2.pricePerKilometer = pricePerKilometer;
        await f2.save();

        // 5. Invalidate sessions that are affected by F2's updated price:
        const f3 = await Fuel.findOne({
            where: sequelize.and(
                sequelize.where(sequelize.fn('TRIM', sequelize.col('CAR_ID')), carId),
                sequelize.where(sequelize.fn('TRIM', sequelize.col('USER_ID')), userId.trim()),
                { timestampUtc: { [Op.gt]: f2Timestamp } },
                { isDeleted: { [Op.or]: [0, null] } }
            ),
            order: [['timestampUtc', 'ASC']]
        });

        // --- Invalidate F1 → F2 sessions (confirmed range) ---
        await sequelize.query(`
            UPDATE SESSION_DATA
            SET COST = NULL, DISTANCE = NULL, TIME_TRAVELED = NULL,
                VALUE_CONFIRMED = 'N',
                UPDATED_AT = SYS_EXTRACT_UTC(SYSTIMESTAMP)
            WHERE TRIM(CAR_ID) = TRIM(:carId)
              AND START_UTC > TO_DATE(:f1UtcStr, 'YYYY-MM-DD HH24:MI:SS')
              AND START_UTC < TO_DATE(:f2UtcStr, 'YYYY-MM-DD HH24:MI:SS')
        `, { replacements: { carId, f1UtcStr, f2UtcStr } });

        // --- Invalidate F2 → F3 sessions (estimated range) ---
        if (f3) {
            // There is a next fuel record — invalidate up to F3
            const f3UtcStr = f3.get('timestampUtc').toISOString().substring(0, 19).replace('T', ' ');
            await sequelize.query(`
                UPDATE SESSION_DATA
                SET COST = NULL, DISTANCE = NULL, TIME_TRAVELED = NULL,
                    VALUE_CONFIRMED = 'N',
                    UPDATED_AT = SYS_EXTRACT_UTC(SYSTIMESTAMP)
                WHERE TRIM(CAR_ID) = TRIM(:carId)
                  AND START_UTC >= TO_DATE(:f2UtcStr, 'YYYY-MM-DD HH24:MI:SS')
                  AND START_UTC <  TO_DATE(:f3UtcStr, 'YYYY-MM-DD HH24:MI:SS')
            `, { replacements: { carId, f2UtcStr, f3UtcStr } });
            console.log(`Invalidated estimated sessions between F2 and F3 (${f2UtcStr} → ${f3UtcStr})`);
        } else {
            // No next fuel record — invalidate all future sessions from F2 onwards
            await sequelize.query(`
                UPDATE SESSION_DATA
                SET COST = NULL, DISTANCE = NULL, TIME_TRAVELED = NULL,
                    VALUE_CONFIRMED = 'N',
                    UPDATED_AT = SYS_EXTRACT_UTC(SYSTIMESTAMP)
                WHERE TRIM(CAR_ID) = TRIM(:carId)
                  AND START_UTC >= TO_DATE(:f2UtcStr, 'YYYY-MM-DD HH24:MI:SS')
            `, { replacements: { carId, f2UtcStr } });
            console.log(`Invalidated all future estimated sessions from F2 onwards (${f2UtcStr} → ∞)`);
        }

        return Response.json({ success: true, message: 'Calculated successfully' });
    } catch (e) {
        console.error("Calculate Error:", e);
        return Response.json({ success: false, error: e.message || 'Error calculating fuel' }, { status: 500 });
    }
}
