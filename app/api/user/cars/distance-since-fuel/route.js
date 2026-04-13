import { getSession } from '@/lib/auth';
import { Fuel, SessionView, SessionData, LocationData, sequelize } from '@/lib/models/index.js';
import { calculateTotalDistance, filterLocationsByDistance } from '@/lib/gpsUtils';
import { Op } from 'sequelize';

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
                { carId: String(carId).trim() },
                { userId: String(userId).trim() },
                { isDeleted: { [Op.or]: [0, null] } }
            ),
            order: [['timestampUtc', 'DESC']]
        });

        if (!lastFuel) {
            return Response.json({ success: false, error: 'No fuel log found for this car' }, { status: 404 });
        }

        const lastFuelTimestamp = lastFuel.get('timestampUtc');

        // 2. Find all sessions for this car where START_UTC > last_fuel_timestamp
        // We use V_SESSIONS as done in the fuel calculation, checking for soft-deletes via SessionData
        const sessions = await SessionView.findAll({
            attributes: ['id', 'deviceId', 'startUtc', 'endUtc'],
            include: [{
                model: SessionData,
                as: 'sessionData',
                attributes: [],
                where: { isDeleted: { [Op.or]: [0, null] } }
            }],
            where: sequelize.and(
                { carId: String(carId).trim() },
                { startUtc: { [Op.gt]: lastFuelTimestamp } }
            ),
            raw: true
        });

        let totalMeters = 0;
        let totalMs = 0;
        const nowUtc = new Date();

        // 3. For each session, fetch location_data and calculate distance
        for (const s of sessions) {
            const deviceId = s.deviceId;
            const sessionStartUtc = s.startUtc;
            const sessionEndUtc = s.endUtc || nowUtc;

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
                // Use filtering to ignore noise
                const filtered = filterLocationsByDistance(locations, 10);
                const dist = calculateTotalDistance(filtered);
                totalMeters += dist;

                // Calculate time based on session start and end
                const tStart = new Date(sessionStartUtc).getTime();
                const tEnd = new Date(sessionEndUtc).getTime();
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
