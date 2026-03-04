import { getConnection, oracledb } from '@/lib/db';
import { getSession } from '@/lib/auth';

// Returns the single most recent session for the authenticated user, ignoring all filters.
// Used by the timer widget on the main page so it always reflects the true last/active session.
export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let connection;
    try {
        connection = await getConnection();
        const userId = session.USER_ID || session.id || session.ID;

        const result = await connection.execute(
            `SELECT
                TRIM(s.id)          AS id,
                TRIM(s.device_id)   AS device_id,
                NVL(s.car_description, d.description) AS description,
                TO_CHAR(s.start_utc, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_utc,
                TO_CHAR(s.end_utc,   'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end_utc
             FROM V_SESSIONS s
             LEFT JOIN DEVICES d ON s.device_id = d.device_id
             WHERE s.device_id IN (
                 SELECT device_id FROM USER_DEVICES WHERE user_id = :userId
             )
             ORDER BY s.start_utc DESC
             FETCH FIRST 1 ROWS ONLY`,
            { userId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            return Response.json({ success: true, session: null });
        }

        const row = result.rows[0];
        return Response.json({
            success: true,
            session: {
                id: row.ID,
                deviceId: row.DEVICE_ID,
                description: row.DESCRIPTION,
                startTime: row.START_UTC,
                endTime: row.END_UTC,
            }
        });
    } catch (error) {
        console.error('Error in /api/sessions/latest:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { /* ignore */ }
        }
    }
}
