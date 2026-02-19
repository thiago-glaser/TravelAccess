import oracledb from 'oracledb';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20;
    const offset = (page - 1) * limit;

    let connection;
    try {
        connection = await oracledb.getConnection({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectionString: process.env.ORACLE_CONNECTION_STRING,
        });

        // Query to get total count
        const countResult = await connection.execute(
            `SELECT COUNT(*) as TOTAL FROM V_SESSIONS`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const total = countResult.rows[0].TOTAL;

        // Query with pagination
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
            ORDER BY s.start_utc DESC
            OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
        `;

        const result = await connection.execute(query, { offset, limit }, {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
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
