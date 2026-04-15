import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

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
        const { bluetooth_address, timestamp_utc, device_id } = body;

        if (!bluetooth_address || !timestamp_utc || !device_id) {
            return Response.json({ message: "Provide a bluetooth_address, device_id and timestamp_utc." }, { status: 400 });
        }

        const startTime = Date.now();
        const startUtc = new Date(timestamp_utc);
        const userId = session.USER_ID || session.id || session.ID;

        // Look up the Bluetooth record to find the associated car
        const btResult = await query(
            `SELECT TRIM(CAR_ID) AS CAR_ID FROM BLUETOOTH
             WHERE TRIM(ADDRESS) = TRIM(:address)
               AND TRIM(USER_ID) = TRIM(:userId)
               AND (IS_DELETED = 0 OR IS_DELETED IS NULL)
             LIMIT 1`,
            { address: bluetooth_address, userId }
        );

        const rows = btResult.rows || [];
        if (rows.length === 0 || !rows[0].CAR_ID) {
            console.log(`Start session: no car associated with bluetooth address ${bluetooth_address}. Doing nothing.`);
            return new Response(null, { status: 204 });
        }

        const carId = rows[0].CAR_ID;

        const insertSql = `
            INSERT INTO SESSION_DATA (ID, DEVICE_ID, CAR_ID, START_UTC, END_UTC, SESSION_TYPE)
            VALUES (UUID(), :deviceId, :carId, :startUtc, NULL, 'P')
        `;

        const result = await query(insertSql, { deviceId: device_id, carId, startUtc });

        const inserted = result.rows ? result.rows.affectedRows : 0;

        const elapsed = Date.now() - startTime;
        console.log(`Session started. Bluetooth: ${bluetooth_address} Car: ${carId} Elapsed time: ${elapsed} ms`);

        return Response.json({ inserted }, { status: 201 });
    } catch (error) {
        console.error('Start session error:', error);
        return Response.json({ message: "Internal server error" }, { status: 500 });
    }
}
