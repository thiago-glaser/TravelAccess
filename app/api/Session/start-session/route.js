import { query } from '@/lib/db';
import { getSession, verifyDeviceOwnership } from '@/lib/auth';

export async function POST(request) {
    try {
        const session = await getSession(request);
        if (!session) {
            return Response.json({ message: "Unauthorized: Invalid or missing API Key" }, { status: 401 });
        }

        if (session.isDemo === 'Y' || session.isDemo === true) {
            return Response.json({ message: "Demo users cannot perform write operations" }, { status: 403 });
        }

        const body = await request.json();
        const { device_id, timestamp_utc, carId } = body;

        if (!device_id || !timestamp_utc) {
            return Response.json({ message: "Provide a device_id and timestamp_utc." }, { status: 400 });
        }

        const startTime = Date.now();
        const startUtc = new Date(timestamp_utc);

        const isOwner = await verifyDeviceOwnership(session, device_id);
        if (!isOwner) {
            return Response.json({ message: "Forbidden: Device does not belong to the user." }, { status: 403 });
        }

        let finalCarId = carId || null;
        if (!finalCarId) {
            const userId = session.USER_ID || session.id || session.ID;
            const carsResult = await query(`SELECT TRIM(ID) AS ID FROM CARS WHERE TRIM(USER_ID) = TRIM(:userId) ORDER BY 1`, { userId });
            if (carsResult.rows && carsResult.rows.length > 0) {
                finalCarId = carsResult.rows[0].ID;
            }
        }

        const insertSql = `
            INSERT INTO SESSION_DATA (ID, DEVICE_ID, CAR_ID, START_UTC, END_UTC, SESSION_TYPE)
            VALUES (Sys_guid(), :deviceId, :carId, :startUtc, NULL, 'P')
        `;

        const result = await query(insertSql, {
            deviceId: device_id,
            carId: finalCarId,
            startUtc: startUtc
        });

        const inserted = result.rowsAffected;

        const elapsed = Date.now() - startTime;
        console.log(`Session started. Device: ${device_id} Elapsed time: ${elapsed} ms`);

        return Response.json({ inserted }, { status: 201 });
    } catch (error) {
        console.error('Start session error:', error);
        return Response.json({ message: "Internal server error" }, { status: 500 });
    }
}
