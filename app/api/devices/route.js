import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized. API Key or Login required.' }, { status: 401 });
    }

    try {
        // Get devices mapped to this user
        const userId = session.USER_ID || session.id || session.ID;
        const devicesQuery = `
            SELECT d.device_id as DEVICE_ID, d.description as DESCRIPTION
            FROM devices d
            JOIN USER_DEVICES ud ON d.device_id = ud.device_id
            WHERE TRIM(ud.user_id) = TRIM(:userId)
            ORDER BY d.device_id
        `;
        const devicesResult = await query(devicesQuery, { userId });

        const devices = devicesResult.rows.map(row => ({
            id: row.DEVICE_ID,
            description: row.DESCRIPTION,
        }));

        return Response.json({ success: true, devices });
    } catch (error) {
        console.error('Database error:', error);
        return Response.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
