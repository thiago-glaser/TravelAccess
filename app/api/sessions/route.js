import { getSession } from '@/lib/auth';
import { sequelize, UserDevice } from '@/lib/models/index.js';
import { QueryTypes } from 'sequelize';

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

    try {
        const userId = session.USER_ID || session.id || session.ID;

        // Build dynamic WHERE clause for Raw Query
        let conditions = [`s.device_id IN (SELECT device_id FROM USER_DEVICES WHERE RTRIM(LTRIM(user_id)) = RTRIM(LTRIM(:userId)))`];
        let bindParams = { userId };

        if (carFilter) {
            conditions.push(`TRIM(s.car_id) = TRIM(:carId)`);
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
        const countResult = await sequelize.query(countQuery, {
            replacements: bindParams,
            type: QueryTypes.SELECT
        });
        const total = countResult[0].TOTAL;

        // Query with pagination
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
                s.time_traveled,
                sd.value_confirmed
            FROM V_SESSIONS s
            JOIN SESSION_DATA sd ON TRIM(sd.id) = TRIM(s.id)
            LEFT JOIN devices d ON s.device_id = d.device_id
            ${whereClause}
            ORDER BY s.start_utc DESC
            OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
        `;

        const dataBindParams = { ...bindParams, offset, limit };
        const result = await sequelize.query(query, {
            replacements: dataBindParams,
            type: QueryTypes.SELECT
        });

        const sessions = result.map(row => ({
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
            timeTraveled: row.TIME_TRAVELED,
            valueConfirmed: row.VALUE_CONFIRMED || 'N'
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
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    const session = await getSession(request);
    if (!session || (session.authType === 'api-key' && !session.IS_ADMIN)) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { id, type, cost, distance, timeTraveled, valueConfirmed } = body;

        if (!id) {
            return Response.json({ success: false, error: 'ID is required' }, { status: 400 });
        }

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
        if (valueConfirmed !== undefined) {
            updates.push('value_confirmed = :valueConfirmed');
            bindParams.valueConfirmed = valueConfirmed;
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

        const [results, metadata] = await sequelize.query(query, {
            replacements: bindParams,
            type: QueryTypes.UPDATE
        });

        // metadata usually contains the number of rows affected
        if (metadata === 0) {
            return Response.json({ success: false, error: 'Session not found or update failed' }, { status: 404 });
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error('Database error in sessions PATCH API:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
