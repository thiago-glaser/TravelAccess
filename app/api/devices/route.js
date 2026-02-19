import oracledb from 'oracledb';

export async function GET() {
    let connection;
    try {
        connection = await oracledb.getConnection({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectionString: process.env.ORACLE_CONNECTION_STRING,
        });

        const devicesQuery = `SELECT device_id, description FROM devices ORDER BY device_id`;
        const devicesResult = await connection.execute(devicesQuery, [], {
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
