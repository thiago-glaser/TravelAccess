import oracledb from 'oracledb';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const deviceId = searchParams.get('deviceId');

    // Log Oracle connection parameters
    console.log('🔍 Oracle Connection Parameters:');
    console.log(`   User: ${process.env.ORACLE_USER}`);
    console.log(`   Connection String: ${process.env.ORACLE_CONNECTION_STRING}`);
    console.log(`   Password: ${process.env.ORACLE_PASSWORD ? '***set***' : 'NOT SET'}`);
    console.log('');

    let connection;
    try {
        console.log('⏳ Attempting Oracle connection...');
        connection = await oracledb.getConnection({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectionString: process.env.ORACLE_CONNECTION_STRING,
        });
        console.log('✅ Oracle connection successful!\n');

        // Get location data with filters
        let query = `
      SELECT id, device_id, timestamp_utc, latitude, longitude, altitude
      FROM location_data
      WHERE 1=1
    `;

        const params = {};

        if (deviceId) {
            query += ` AND device_id = :deviceId`;
            params.deviceId = deviceId;
        }

        if (startDate) {
            // Parse datetime string "YYYY-MM-DDTHH:mm:ss" or just date "YYYY-MM-DD"
            const startDateTime = startDate.includes('T') ? startDate : `${startDate}T00:00:00`;
            query += ` AND timestamp_utc >= TO_TIMESTAMP(:startDate, 'YYYY-MM-DD"T"HH24:MI:SS')`;
            params.startDate = startDateTime;
        }

        if (endDate) {
            // Parse datetime string "YYYY-MM-DDTHH:mm:ss" or just date "YYYY-MM-DD"
            const endDateTime = endDate.includes('T') ? endDate : `${endDate}T23:59:59`;
            query += ` AND timestamp_utc <= TO_TIMESTAMP(:endDate, 'YYYY-MM-DD"T"HH24:MI:SS')`;
            params.endDate = endDateTime;
        }

        query += ` ORDER BY timestamp_utc DESC`;

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

        console.log(`✅ Found ${locations.length} location records\n`);
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
