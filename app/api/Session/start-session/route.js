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

        if (!device_id) {
            return Response.json({ message: "Provide a device_id." }, { status: 400 });
        }

        const startTime = Date.now();
        const startUtc = timestamp_utc ? new Date(timestamp_utc) : new Date();

        const isOwner = await verifyDeviceOwnership(session, device_id);
        if (!isOwner) {
            return Response.json({ message: "Forbidden: Device does not belong to the user." }, { status: 403 });
        }

        const insertSql = `
            INSERT INTO SESSION_DATA (ID, DEVICE_ID, START_UTC, END_UTC, SESSION_TYPE)
            VALUES (Sys_guid(), :deviceId, :startUtc, NULL, 'P')
        `;

        const result = await query(insertSql, {
            deviceId: device_id,
            startUtc: startUtc
        });

        const inserted = result.rowsAffected;

        const elapsed = Date.now() - startTime;
        console.log(`Session started. Device: ${device_id} Elapsed time: ${elapsed} ms`);

        return Response.json({ inserted }, { status: 201 });
    } catch (error) {
        console.error('Start session error:', error);
        return Response.json({ message: "Internal server error" }, { status: 500 });
    }
}
