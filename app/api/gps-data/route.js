import { query } from '@/lib/db';
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

    try {
        // Get location data with filters restricted by user
        const userId = session.USER_ID || session.id || session.ID;
        let sql = `
            SELECT ld.device_id as DEVICE_ID, 
                   DATE_FORMAT(ld.timestamp_utc, '%Y-%m-%dT%H:%i:%sZ') as TIMESTAMP_UTC, 
                   ld.latitude as LATITUDE, ld.longitude as LONGITUDE, ld.altitude as ALTITUDE
            FROM LOCATION_DATA ld
            JOIN USER_DEVICES ud ON ld.device_id = ud.device_id
            WHERE TRIM(ud.user_id) = TRIM(:userId)
        `;

        const params = { userId };

        if (deviceId) {
            sql += ` AND ld.device_id = :deviceId`;
            params.deviceId = deviceId;
        }

        if (startDate) {
            let startDateTime = startDate.includes('T') ? startDate : `${startDate}T00:00:00`;
            if (startDateTime.includes('.') && startDateTime.indexOf('.') > 10) {
                startDateTime = startDateTime.split('.')[0];
            }
            if (startDateTime.endsWith('Z')) {
                startDateTime = startDateTime.slice(0, -1);
            }
            // MySQL standard format: YYYY-MM-DD HH:MM:SS
            startDateTime = startDateTime.replace('T', ' ');
            sql += ` AND ld.timestamp_utc >= :startDate`;
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
            endDateTime = endDateTime.replace('T', ' ');
            sql += ` AND ld.timestamp_utc <= :endDate`;
            params.endDate = endDateTime;
        }

        sql += ` ORDER BY ld.timestamp_utc DESC`;

        const result = await query(sql, params);

        const locations = result.rows.map(row => ({
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
    }
}
