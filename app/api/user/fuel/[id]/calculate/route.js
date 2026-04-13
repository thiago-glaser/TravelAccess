import { getSession } from '@/lib/auth';
import { Fuel, SessionView, LocationData, SessionData, sequelize } from '@/lib/models/index.js';
import { calculateTotalDistance, filterLocationsByDistance } from '@/lib/gpsUtils';
import { Op } from 'sequelize';

export async function POST(request, context) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.isDemo === 'Y' || session.isDemo === true) {
        return Response.json({ success: false, error: 'Demo users cannot perform write operations' }, { status: 403 });
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
                { id: String(fuelId).trim() },
                { userId: String(userId).trim() },
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

        // 2. Get previous fuel record F1 for the same car
        const f1 = await Fuel.findOne({
            where: sequelize.and(
                { carId: carId },
                { userId: String(userId).trim() },
                { timestampUtc: { [Op.lt]: f2Timestamp } },
                { isDeleted: { [Op.or]: [0, null] } }
            ),
            order: [['timestampUtc', 'DESC']]
        });

        if (!f1) {
            return Response.json({ success: false, error: 'Cannot calculate. No previous fuel log found for this car.' }, { status: 400 });
        }

        const f1Timestamp = f1.get('timestampUtc');

        // 3. Find all sessions for this car within (f1Timestamp, f2Timestamp)
        // V_SESSIONS is a view, mapped to SessionView
        const sessions = await SessionView.findAll({
            attributes: ['id', 'deviceId', 'startUtc', 'endUtc'],
            include: [{
                model: SessionData,
                as: 'sessionData',
                attributes: [],
                where: { isDeleted: { [Op.or]: [0, null] } }
            }],
            where: {
                carId: carId,
                startUtc: {
                    [Op.gte]: f1Timestamp,
                    [Op.lt]: f2Timestamp
                }
            },
            raw: true
        });

        let totalMeters = 0;

        // 4. For each session, fetch location_data and calculate distance
        for (const s of sessions) {
            const deviceId = s.deviceId;
            const sessionStartUtc = s.startUtc;
            const sessionEndUtc = s.endUtc || f2Timestamp;

            const gpsLocations = await LocationData.findAll({
                attributes: ['latitude', 'longitude', 'timestampUtc'],
                where: {
                    deviceId,
                    timestampUtc: {
                        [Op.gte]: sessionStartUtc,
                        [Op.lte]: sessionEndUtc
                    }
                },
                order: [['timestampUtc', 'ASC']],
                raw: true
            });

            if (gpsLocations.length > 1) {
                const locations = gpsLocations.map(row => ({
                    lat: Number(row.latitude),
                    lng: Number(row.longitude),
                    date: typeof row.timestampUtc === 'string' ? row.timestampUtc : row.timestampUtc.toISOString().substring(0, 19).replace('T', ' ')
                }));
                // Use filtering to ignore noise if necessary
                const filtered = filterLocationsByDistance(locations, 10);
                const dist = calculateTotalDistance(filtered);
                totalMeters += dist;
            }
        }

        const totalKilometers = totalMeters / 1000;
        
        // Only update efficiency metrics if we actually have distance data. 
        // If distance is zero, we keep the previous values (usually 0) but avoid 
        // overwriting with a potentially "broken" zero calculation if some distance was expected.
        if (totalKilometers > 0.01) {
            const kilometerPerLiter = f2Liters > 0 ? totalKilometers / f2Liters : 0;
            const pricePerKilometer = totalKilometers > 0 ? f2TotalValue / totalKilometers : 0;

            f2.totalKilometers = totalKilometers;
            f2.kilometerPerLiter = kilometerPerLiter;
            f2.pricePerKilometer = pricePerKilometer;
            await f2.save();
        } else {
            // Even if distance is zero, we should record that no distance was found
            f2.totalKilometers = 0;
            await f2.save();
        }

        // 5. Invalidate sessions that are affected by F2's updated price:
        const f3 = await Fuel.findOne({
            where: sequelize.and(
                { carId: carId },
                { userId: String(userId).trim() },
                { timestampUtc: { [Op.gt]: f2Timestamp } },
                { isDeleted: { [Op.or]: [0, null] } }
            ),
            order: [['timestampUtc', 'ASC']]
        });

        // --- Invalidate F1 → F2 sessions (confirmed range) ---
        await SessionData.update({
            cost: null,
            distance: null,
            timeTraveled: null,
            valueConfirmed: 'N',
            updatedAt: new Date()
        }, {
            where: {
                carId: carId,
                startUtc: {
                    [Op.gte]: f1Timestamp,
                    [Op.lt]: f2Timestamp
                }
            }
        });

        // --- Invalidate F2 → F3 sessions (estimated range) ---
        if (f3) {
            // There is a next fuel record — invalidate up to F3
            const f3Timestamp = f3.get('timestampUtc');
            await SessionData.update({
                cost: null,
                distance: null,
                timeTraveled: null,
                valueConfirmed: 'N',
                updatedAt: new Date()
            }, {
                where: {
                    carId: carId,
                    startUtc: {
                        [Op.gte]: f2Timestamp,
                        [Op.lt]: f3Timestamp
                    }
                }
            });
            console.log(`Invalidated estimated sessions between F2 and F3`);
        } else {
            // No next fuel record — invalidate all future sessions from F2 onwards
            await SessionData.update({
                cost: null,
                distance: null,
                timeTraveled: null,
                valueConfirmed: 'N',
                updatedAt: new Date()
            }, {
                where: {
                    carId: carId,
                    startUtc: {
                        [Op.gte]: f2Timestamp
                    }
                }
            });
            console.log(`Invalidated all future estimated sessions from F2 onwards`);
        }

        return Response.json({ success: true, message: 'Calculated successfully' });
    } catch (e) {
        console.error("Calculate Error:", e);
        return Response.json({ success: false, error: e.message || 'Error calculating fuel' }, { status: 500 });
    }
}
