import { getSession, verifyDeviceOwnership } from '@/lib/auth';
import { LocationData, sequelize } from '@/lib/models/index.js';

export async function POST(request) {
    try {
        const session = await getSession(request);
        if (!session) {
            return Response.json({ message: "Unauthorized: Invalid or missing API Key" }, { status: 401 });
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

        // Prepare records for bulk insert
        const recordsToInsert = locations.map(loc => ({
            deviceId: device_id,
            timestampUtc: new Date(loc.timestamp_utc),
            latitude: loc.latitude,
            longitude: loc.longitude,
            altitude: loc.altitude
        }));

        // Insert all locations using Sequelize bulkCreate
        await LocationData.bulkCreate(recordsToInsert);

        const elapsed = Date.now() - startTime;
        console.log(`Inserted rows: ${recordsToInsert.length} Elapsed time: ${elapsed} ms - Device: ${device_id}`);

        return Response.json({ inserted: recordsToInsert.length }, { status: 201 });
    } catch (error) {
        console.error('LocationData insert error:', error);
        return Response.json({ message: "Internal server error" }, { status: 500 });
    }
}
