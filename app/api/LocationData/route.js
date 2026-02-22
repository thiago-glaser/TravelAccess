import { oracledb } from '@/lib/db';
import { getSession, verifyDeviceOwnership } from '@/lib/auth';

export async function POST(request) {
    let connection;
    try {
        const session = await getSession(request);
        if (!session) {
            return Response.json({ message: "Unauthorized: Invalid or missing API Key" }, { status: 401 });
        }

        const body = await request.json();
        const { device_id, locations } = body;

        if (!device_id || !locations || locations.length === 0) {
            return Response.json({ message: "Provide a device_id and at least one location." }, { status: 400 });
        }

        const startTime = Date.now();
        connection = await oracledb.getConnection({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectionString: process.env.ORACLE_CONNECTION_STRING,
        });

        const isOwner = true;//await verifyDeviceOwnership(session, device_id, connection);
        if (!isOwner) {
            return Response.json({ message: "Forbidden: Device does not belong to the user." }, { status: 403 });
        }

        const insertSql = `
            INSERT INTO LOCATION_DATA (ID, DEVICE_ID, TIMESTAMP_UTC, LATITUDE, LONGITUDE, ALTITUDE)
            VALUES (Sys_guid(), :deviceId, :timestampUtc, :latitude, :longitude, :altitude)
        `;

        let inserted = 0;
        for (const loc of locations) {
            const timestampUtc = new Date(loc.timestamp_utc);
            await connection.execute(insertSql, {
                deviceId: device_id,
                timestampUtc: timestampUtc,
                latitude: loc.latitude,
                longitude: loc.longitude,
                altitude: loc.altitude
            }, { autoCommit: false });
            inserted++;
        }
        await connection.commit();

        const elapsed = Date.now() - startTime;
        console.log(`Inserted rows: ${inserted} Elapsed time: ${elapsed} ms - Device: ${device_id}`);

        return Response.json({ inserted }, { status: 201 });
    } catch (error) {
        console.error('LocationData insert error:', error);
        return Response.json({ message: "Internal server error" }, { status: 500 });
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
