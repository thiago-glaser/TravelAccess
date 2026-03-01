import { getConnection, oracledb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized. API Key or Login required.' }, { status: 401 });
    }

    let connection;
    try {
        connection = await getConnection();

        // Get devices mapped to this user
        const userId = session.USER_ID || session.id || session.ID;
        const devicesQuery = `
            SELECT d.device_id, d.description 
            FROM devices d
            JOIN USER_DEVICES ud ON d.device_id = ud.device_id
            WHERE ud.user_id = :userId
            ORDER BY d.device_id
        `;
        const devicesResult = await connection.execute(devicesQuery, { userId }, {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
        });

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
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
}
