import oracledb from 'oracledb';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20;
    const offset = (page - 1) * limit;

    const carFilter = searchParams.get('carId');
    const yearFilter = searchParams.get('year');
    const monthFilter = searchParams.get('month');
    const typeFilter = searchParams.get('type');
    const tzFilter = searchParams.get('tz') || 'UTC';

    let connection;
    try {
        connection = await oracledb.getConnection({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectionString: process.env.ORACLE_CONNECTION_STRING,
        });

        const userId = session.USER_ID || session.id || session.ID;

        // Build dynamic WHERE clause
        let conditions = [`s.device_id IN (SELECT device_id FROM USER_DEVICES WHERE user_id = :userId)`];
        let bindParams = { userId };

        if (carFilter) {
            conditions.push(`TRIM(s.car_id) = :carId`);
            bindParams.carId = carFilter;
        }
        if (yearFilter) {
            conditions.push(`TO_NUMBER(TO_CHAR(FROM_TZ(CAST(s.start_utc AS TIMESTAMP), 'UTC') AT TIME ZONE CAST(:tz AS VARCHAR2(50)), 'YYYY')) = :year`);
            bindParams.year = parseInt(yearFilter);
            bindParams.tz = tzFilter;
        }
        if (monthFilter) {
            conditions.push(`TO_NUMBER(TO_CHAR(FROM_TZ(CAST(s.start_utc AS TIMESTAMP), 'UTC') AT TIME ZONE CAST(:tz AS VARCHAR2(50)), 'MM')) = :month`);
            bindParams.month = parseInt(monthFilter);
            bindParams.tz = tzFilter;
        }
        if (typeFilter) {
            conditions.push(`s.session_type = :sessionType`);
            bindParams.sessionType = typeFilter;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Query to get total count
        const countQuery = `SELECT COUNT(*) as TOTAL FROM V_SESSIONS s ${whereClause}`;
        const countResult = await connection.execute(countQuery, bindParams, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const total = countResult.rows[0].TOTAL;

        // Query with pagination
        const dataBindParams = { ...bindParams, offset, limit };
        const query = `
            SELECT 
                TRIM(s.id) as id, 
                TRIM(s.device_id) as device_id,
                TRIM(s.car_id) as car_id, 
                NVL(s.car_description, d.description) as description,
                TO_CHAR(s.start_utc, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as START_UTC,
                TO_CHAR(s.end_utc, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as END_UTC,
                s.session_type,
                s.location_start,
                s.location_end,
                s.cost,
                s.distance,
                s.time_traveled
            FROM V_SESSIONS s
            LEFT JOIN devices d ON s.device_id = d.device_id
            ${whereClause}
            ORDER BY s.start_utc DESC
            OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
        `;

        const result = await connection.execute(query, dataBindParams, {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
            maxRows: limit
        });

        const sessions = result.rows.map(row => ({
            id: row.ID,
            deviceId: row.DEVICE_ID,
            carId: row.CAR_ID,
            description: row.DESCRIPTION,
            startTime: row.START_UTC,
            endTime: row.END_UTC,
            type: row.SESSION_TYPE,
            locationStart: row.LOCATION_START,
            locationEnd: row.LOCATION_END,
            cost: row.COST,
            distance: row.DISTANCE,
            timeTraveled: row.TIME_TRAVELED
        }));

        return Response.json({
            success: true,
            data: sessions,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Database error in sessions API:', error);
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

export async function PATCH(request) {
    const session = await getSession(request);
    if (!session || (session.authType === 'api-key' && !session.IS_ADMIN)) {
        // Only admins or logged in users can patch sessions, or specific keys if we want.
        // For now, let's just require a session.
        if (!session) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let connection;
    try {
        const body = await request.json();
        const { id, type, cost, distance, timeTraveled } = body;

        if (!id) {
            return Response.json({ success: false, error: 'ID is required' }, { status: 400 });
        }

        connection = await oracledb.getConnection({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectionString: process.env.ORACLE_CONNECTION_STRING,
        });

        // Build update statement dynamically based on what was provided
        const userId = session.USER_ID || session.id || session.ID;
        const updates = [];
        const bindParams = { id, userId };

        if (type !== undefined) {
            updates.push('session_type = :type');
            bindParams.type = type;
        }
        if (cost !== undefined) {
            updates.push('cost = :cost');
            bindParams.cost = cost;
        }
        if (distance !== undefined) {
            updates.push('distance = :distance');
            bindParams.distance = distance;
        }
        if (timeTraveled !== undefined) {
            updates.push('time_traveled = :timeTraveled');
            bindParams.timeTraveled = timeTraveled;
        }

        if (updates.length === 0) {
            return Response.json({ success: false, error: 'No fields to update' }, { status: 400 });
        }

        updates.push('updated_at = SYS_EXTRACT_UTC(SYSTIMESTAMP)');

        const query = `
            UPDATE SESSION_DATA 
            SET ${updates.join(', ')}
            WHERE TRIM(id) = TRIM(:id) 
            AND TRIM(device_id) IN (SELECT TRIM(device_id) FROM USER_DEVICES WHERE TRIM(user_id) = TRIM(:userId))
        `;

        const result = await connection.execute(
            query,
            bindParams,
            { autoCommit: true }
        );

        if (result.rowsAffected === 0) {
            return Response.json({ success: false, error: 'Session not found or update failed' }, { status: 404 });
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error('Database error in sessions PATCH API:', error);
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
