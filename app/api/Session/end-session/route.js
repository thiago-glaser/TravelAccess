import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

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
        const endUtc = timestamp_utc ? new Date(timestamp_utc) : new Date();

        const userId = session.id || session.ID || session.USER_ID;
        const checkSql = `SELECT 1 FROM USER_DEVICES WHERE USER_ID = :userId AND DEVICE_ID = :deviceId`;
        const checkResult = await query(checkSql, { userId, deviceId: device_id });
        if (!checkResult.rows || checkResult.rows.length === 0) {
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
