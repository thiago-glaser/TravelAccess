import { getSession, verifyDeviceOwnership } from '@/lib/auth';
import { LocationData, sequelize } from '@/lib/models/index.js';

export async function POST(request) {
    try {
        const session = await getSession(request);
        if (!session) {
            return Response.json({ message: "Unauthorized: Invalid or missing API Key" }, { status: 401 });
        }

        if (session.isDemo === 'Y' || session.isDemo === true) {
            return Response.json({ message: "Demo users cannot perform write operations" }, { status: 403 });
        }

        const body = await request.json();
        const { device_id, locations } = body;

        if (!device_id || !locations || locations.length === 0) {
            return Response.json({ message: "Provide a device_id and at least one location." }, { status: 400 });
        }

        const startTime = Date.now();

        // Check if the user owns this device
        const isOwner = await verifyDeviceOwnership(session, device_id);
        if (!isOwner) {
            return Response.json({ message: "Forbidden: Device does not belong to the user." }, { status: 403 });
        }

        // Prepare records for individual insert
        const recordsToInsert = locations.map(loc => ({
            deviceId: device_id,
            timestampUtc: new Date(loc.timestamp_utc),
            latitude: loc.latitude,
            longitude: loc.longitude,
            altitude: loc.altitude
        }));

        // Insert each record individually; skip duplicates, re-throw anything else
        let inserted = 0;
        let skipped = 0;
        for (const record of recordsToInsert) {
            try {
                await LocationData.create(record);
                inserted++;
            } catch (err) {
                if (err.name === 'SequelizeUniqueConstraintError') {
                    skipped++;
                } else {
                    throw err; // non-duplicate error — propagate to outer catch
                }
            }
        }

        const elapsed = Date.now() - startTime;
        console.log(`Inserted: ${inserted} - Skipped (duplicate): ${skipped} Elapsed: ${elapsed} ms - Device: ${device_id}`);

        return Response.json({ inserted, skipped }, { status: 201 });
    } catch (error) {
        console.error('LocationData insert error:', error);
        return Response.json({ message: "Internal server error" }, { status: 500 });
    }
}
