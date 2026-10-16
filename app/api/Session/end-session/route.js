import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { generateSessionSummary } from '@/lib/gemini';

export async function POST(request) {
    try {
        const session = await getSession(request);
        if (!session) {
            return Response.json({ message: "Unauthorized: Invalid or missing API Key" }, { status: 401 });
        }

        const body = await request.json();
        const { bluetooth_address, timestamp_utc, device_id, id } = body;

        if (!timestamp_utc || (!bluetooth_address && !id && !device_id)) {
            return Response.json({ message: "Provide a timestamp_utc and either bluetooth_address, device_id, or session id." }, { status: 400 });
        }

        const startTime = Date.now();
        const endUtc = new Date(timestamp_utc);
        const userId = session.USER_ID || session.id || session.ID;

        let targetSessionId = id || null;
        let carId = null;

        // If direct session id was provided, verify and use it
        if (targetSessionId) {
            const res = await query(
                `SELECT ID, CAR_ID, DEVICE_ID FROM SESSION_DATA 
                 WHERE ID = :id AND (IS_DELETED = 0 OR IS_DELETED IS NULL)
                 LIMIT 1`,
                { id: targetSessionId }
            );
            const rows = res.rows || [];
            if (rows.length === 0) {
                return Response.json({ message: "Session not found." }, { status: 404 });
            }
            carId = rows[0].CAR_ID;
        } else if (bluetooth_address) {
            // Look up Bluetooth record to find associated car
            const btResult = await query(
                `SELECT TRIM(CAR_ID) AS CAR_ID FROM BLUETOOTH
                 WHERE TRIM(ADDRESS) = TRIM(:address)
                   AND TRIM(USER_ID) = TRIM(:userId)
                   AND (IS_DELETED = 0 OR IS_DELETED IS NULL)
                 LIMIT 1`,
                { address: bluetooth_address, userId }
            );

            const btRows = btResult.rows || [];
            if (btRows.length === 0 || !btRows[0].CAR_ID) {
                console.log(`End session: no car associated with bluetooth address ${bluetooth_address}. Doing nothing.`);
                return new Response(null, { status: 204 });
            }

            carId = btRows[0].CAR_ID;

            // Find most recent open session for this car
            const sResult = await query(
                `SELECT ID FROM SESSION_DATA
                 WHERE TRIM(CAR_ID) = TRIM(:carId)
                   AND END_UTC IS NULL
                   AND (IS_DELETED = 0 OR IS_DELETED IS NULL)
                 ORDER BY START_UTC DESC LIMIT 1`,
                { carId }
            );
            const sRows = sResult.rows || [];
            if (sRows.length > 0) {
                targetSessionId = sRows[0].ID;
            }
        } else if (device_id) {
            // Find most recent open session for this device
            const sResult = await query(
                `SELECT ID, CAR_ID FROM SESSION_DATA
                 WHERE TRIM(DEVICE_ID) = TRIM(:device_id)
                   AND END_UTC IS NULL
                   AND (IS_DELETED = 0 OR IS_DELETED IS NULL)
                 ORDER BY START_UTC DESC LIMIT 1`,
                { device_id }
            );
            const sRows = sResult.rows || [];
            if (sRows.length > 0) {
                targetSessionId = sRows[0].ID;
                carId = sRows[0].CAR_ID;
            }
        }

        if (!targetSessionId) {
            console.log(`End session: no open session found. Doing nothing.`);
            return new Response(null, { status: 204 });
        }

        // Close the session
        const updateSql = `
            UPDATE SESSION_DATA
            SET END_UTC = :endUtc, UPDATED_AT = UTC_TIMESTAMP()
            WHERE ID = :targetSessionId
        `;
        const result = await query(updateSql, { endUtc, targetSessionId });
        const updated = result.rows ? result.rows.affectedRows : 0;

        const elapsed = Date.now() - startTime;
        console.log(`Session ended. ID: ${targetSessionId} Car: ${carId} Updated rows: ${updated} Elapsed: ${elapsed}ms`);

        // Trigger Gemini AI trip resume generation in background so response is not delayed
        generateSessionSummary(targetSessionId).catch(err => {
            console.error(`[Gemini AI] Background session summary failed for ${targetSessionId}:`, err.message);
        });

        return Response.json({ updated, sessionId: targetSessionId }, { status: 200 });
    } catch (error) {
        console.error('End session error:', error);
        return Response.json({ message: "Internal server error" }, { status: 500 });
    }
}
