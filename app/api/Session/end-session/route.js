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
        const endUtc = new Date(timestamp_utc);
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
            console.log(`End session: no car associated with bluetooth address ${bluetooth_address}. Doing nothing.`);
            return new Response(null, { status: 204 });
        }

        const carId = rows[0].CAR_ID;

        // Close the most recent open session for this car
        const updateSql = `
            UPDATE SESSION_DATA
            SET END_UTC = :endUtc, UPDATED_AT = UTC_TIMESTAMP()
            WHERE TRIM(CAR_ID) = TRIM(:carId)
              AND END_UTC IS NULL
              AND (IS_DELETED = 0 OR IS_DELETED IS NULL)
            ORDER BY START_UTC DESC LIMIT 1
        `;

        const result = await query(updateSql, { endUtc, carId });

        const updated = result.rows ? result.rows.affectedRows : 0;

        const elapsed = Date.now() - startTime;
        console.log(`Session ended. Bluetooth: ${bluetooth_address} Device: ${device_id} Car: ${carId} Updated rows: ${updated} Elapsed time: ${elapsed} ms`);

        if (updated === 0) {
            console.log(`End session: no open session found for car ${carId}. Doing nothing.`);
            return new Response(null, { status: 204 });
        }

        return Response.json({ updated }, { status: 200 });
    } catch (error) {
        console.error('End session error:', error);
        return Response.json({ message: "Internal server error" }, { status: 500 });
    }
}
