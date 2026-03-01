import { getConnection, oracledb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const deviceId = searchParams.get('deviceId');

    let connection;
    try {
        connection = await getConnection();

        // Get location data with filters restricted by user
        const userId = session.USER_ID || session.id || session.ID;
        let query = `
            SELECT ld.id, ld.device_id, TO_CHAR(ld.timestamp_utc, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as TIMESTAMP_UTC, ld.latitude, ld.longitude, ld.altitude
            FROM location_data ld
            JOIN USER_DEVICES ud ON ld.device_id = ud.device_id
            WHERE ud.user_id = :userId
        `;

        const params = { userId };

        if (deviceId) {
            query += ` AND ld.device_id = :deviceId`;
            params.deviceId = deviceId;
        }

        if (startDate) {
            // Robustly handle ISO strings (YYYY-MM-DDTHH:MM:SS.mmmZ) by truncating to seconds
            let startDateTime = startDate.includes('T') ? startDate : `${startDate}T00:00:00`;
            if (startDateTime.includes('.') && startDateTime.indexOf('.') > 10) {
                startDateTime = startDateTime.split('.')[0];
            }
            // If it ends with Z but has no milliseconds
            if (startDateTime.endsWith('Z')) {
                startDateTime = startDateTime.slice(0, -1);
            }
            query += ` AND ld.timestamp_utc >= TO_TIMESTAMP(:startDate, 'YYYY-MM-DD"T"HH24:MI:SS')`;
            params.startDate = startDateTime;
        }

        if (endDate) {
            let endDateTime = endDate.includes('T') ? endDate : `${endDate}T23:59:59`;
            if (endDateTime.includes('.') && endDateTime.indexOf('.') > 10) {
                endDateTime = endDateTime.split('.')[0];
            }
            if (endDateTime.endsWith('Z')) {
                endDateTime = endDateTime.slice(0, -1);
            }
            query += ` AND ld.timestamp_utc <= TO_TIMESTAMP(:endDate, 'YYYY-MM-DD"T"HH24:MI:SS')`;
            params.endDate = endDateTime;
        }

        query += ` ORDER BY ld.timestamp_utc DESC`;

        const result = await connection.execute(query, params, {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
        });

        const locations = result.rows.map(row => ({
            id: row.ID,
            deviceId: row.DEVICE_ID,
            lat: parseFloat(row.LATITUDE),
            lng: parseFloat(row.LONGITUDE),
            altitude: parseFloat(row.ALTITUDE),
            date: row.TIMESTAMP_UTC,
        }));

        return Response.json({ success: true, data: locations });
    } catch (error) {
        console.error('❌ Database error:', error);
        console.error('   Code:', error.code);
        console.error('   Message:', error.message);
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
