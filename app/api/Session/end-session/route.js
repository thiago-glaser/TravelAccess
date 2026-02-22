import { query } from '@/lib/db';
import { getSession, verifyDeviceOwnership } from '@/lib/auth';

export async function POST(request) {
    try {
        const session = await getSession(request);
        if (!session) {
            return Response.json({ message: "Unauthorized: Invalid or missing API Key" }, { status: 401 });
        }

        const body = await request.json();
        const { device_id, timestamp_utc } = body;

        if (!device_id || !timestamp_utc) {
            return Response.json({ message: "Provide a device_id and timestamp_utc." }, { status: 400 });
        }

        const startTime = Date.now();
        const endUtc = new Date(timestamp_utc);

        const isOwner = true;//await verifyDeviceOwnership(session, device_id);
        if (!isOwner) {
            return Response.json({ message: "Forbidden: Device does not belong to the user." }, { status: 403 });
        }

        const updateSql = `
            UPDATE SESSION_DATA
            SET END_UTC = :endUtc
            WHERE DEVICE_ID = :deviceId AND END_UTC IS NULL
            AND START_UTC = (SELECT MAX(START_UTC) FROM SESSION_DATA WHERE DEVICE_ID = :deviceId AND END_UTC IS NULL)
        `;

        const result = await query(updateSql, {
            endUtc: endUtc,
            deviceId: device_id
        });

        const updated = result.rowsAffected || 0;

        const elapsed = Date.now() - startTime;
        console.log(`Session ended. Device: ${device_id} Updated rows: ${updated} Elapsed time: ${elapsed} ms`);

        if (updated === 0) {
            return Response.json({ message: "No open session found for the device." }, { status: 404 });
        }

        return Response.json({ updated }, { status: 200 });
    } catch (error) {
        console.error('End session error:', error);
        return Response.json({ message: "Internal server error" }, { status: 500 });
    }
}
