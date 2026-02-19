import oracledb from 'oracledb';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20;
    const offset = (page - 1) * limit;

    const deviceFilter = searchParams.get('deviceId');
    const yearFilter = searchParams.get('year');
    const monthFilter = searchParams.get('month');

    let connection;
    try {
        connection = await oracledb.getConnection({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectionString: process.env.ORACLE_CONNECTION_STRING,
        });

        // Build dynamic WHERE clause
        let conditions = [];
        let bindParams = {};

        if (deviceFilter) {
            conditions.push(`s.device_id = :deviceId`);
            bindParams.deviceId = deviceFilter;
        }
        if (yearFilter) {
            conditions.push(`EXTRACT(YEAR FROM s.start_utc) = :year`);
            bindParams.year = parseInt(yearFilter);
        }
        if (monthFilter) {
            conditions.push(`EXTRACT(MONTH FROM s.start_utc) = :month`);
            bindParams.month = parseInt(monthFilter);
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
                s.id, 
                s.device_id, 
                d.description,
                TO_CHAR(s.start_utc, 'YYYY-MM-DD"T"HH24:MI:SS') as START_UTC,
                TO_CHAR(s.end_utc, 'YYYY-MM-DD"T"HH24:MI:SS') as END_UTC,
                s.session_type,
                s.location_start,
                s.location_end
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
            description: row.DESCRIPTION,
            startTime: row.START_UTC,
            endTime: row.END_UTC,
            type: row.SESSION_TYPE,
            locationStart: row.LOCATION_START,
            locationEnd: row.LOCATION_END
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
    let connection;
    try {
        const body = await request.json();
        const { id, type } = body;

        if (!id || !type) {
            return Response.json({ success: false, error: 'ID and type are required' }, { status: 400 });
        }

        connection = await oracledb.getConnection({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectionString: process.env.ORACLE_CONNECTION_STRING,
        });

        // Update the session type
        // Assuming V_SESSIONS is an updatable view or there's a Sessions table
        // We'll try to update the base table directly if we can identify it, 
        // but for now we'll try updating through a standard SQL query.
        // Based on common patterns in this project, the table is likely SESSION_DATA or SESSIONS
        const query = `UPDATE V_SESSIONS SET session_type = :type WHERE id = :id`;

        const result = await connection.execute(
            query,
            { type, id },
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
