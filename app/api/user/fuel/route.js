import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import oracledb from 'oracledb';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.USER_ID || session.id || session.ID;
        const sql = `
            SELECT TRIM(f.ID) AS ID, TRIM(f.CAR_ID) AS CAR_ID, TO_CHAR(f.TIMESTAMP_UTC, 'YYYY-MM-DD"T"HH24:MI:SS') AS TIMESTAMP_UTC, f.TOTAL_VALUE, f.LITERS, 
                   f.TOTAL_KILOMETERS, f.KILOMETER_PER_LITER, f.PRICE_PER_KILOMETER,
                   c.LICENSE_PLATE, c.DESCRIPTION AS CAR_DESCRIPTION,
                   CASE WHEN f.RECEIPT_IMAGE IS NOT NULL THEN 1 ELSE 0 END AS HAS_RECEIPT
            FROM FUEL f
            JOIN CARS c ON TRIM(f.CAR_ID) = TRIM(c.ID)
            WHERE TRIM(f.USER_ID) = TRIM(:userId) AND (f.IS_DELETED = 0 OR f.IS_DELETED IS NULL)
            ORDER BY f.TIMESTAMP_UTC DESC
        `;
        const result = await query(sql, { userId });

        const fuelEntries = result.rows.map(row => ({
            id: row.ID,
            carId: row.CAR_ID,
            timestampUtc: row.TIMESTAMP_UTC,
            totalValue: row.TOTAL_VALUE,
            liters: row.LITERS,
            totalKilometers: row.TOTAL_KILOMETERS || 0,
            kilometerPerLiter: row.KILOMETER_PER_LITER || 0,
            pricePerKilometer: row.PRICE_PER_KILOMETER || 0,
            carLicensePlate: row.LICENSE_PLATE,
            carDescription: row.CAR_DESCRIPTION,
            hasReceipt: row.HAS_RECEIPT === 1
        }));

        return Response.json({ success: true, fuel: fuelEntries });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const carId = formData.get('carId');
        const timestampIso = formData.get('timestampIso'); // expects valid UTC ISO string
        const totalValue = parseFloat(formData.get('totalValue'));
        const liters = parseFloat(formData.get('liters'));
        const receiptFile = formData.get('receipt');

        if (!carId || !timestampIso || isNaN(totalValue) || isNaN(liters)) {
            return Response.json({ success: false, error: 'Missing mandatory fields' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;

        // Ensure Car belongs to User
        const carCheckResult = await query(`SELECT ID FROM CARS WHERE TRIM(ID) = TRIM(:carId) AND TRIM(USER_ID) = TRIM(:userId) AND (IS_DELETED = 0 OR IS_DELETED IS NULL)`, { carId, userId });
        if (carCheckResult.rows.length === 0) {
            return Response.json({ success: false, error: 'Invalid car selected' }, { status: 400 });
        }

        let receiptBuffer = null;
        let receiptMime = null;

        if (receiptFile && typeof receiptFile === 'object' && receiptFile.size > 0) {
            const arrayBuffer = await receiptFile.arrayBuffer();
            receiptBuffer = Buffer.from(arrayBuffer);
            receiptMime = receiptFile.type;
        }

        // Construct a strict UTC string without milliseconds/Z, i.e., '2026-02-26 19:00:00'
        const utcStr = new Date(timestampIso).toISOString().substring(0, 19).replace('T', ' ');

        const sql = `
            INSERT INTO FUEL (USER_ID, CAR_ID, TIMESTAMP_UTC, TOTAL_VALUE, LITERS, RECEIPT_IMAGE, RECEIPT_MIME)
            VALUES (:userId, :carId, TO_DATE(:utcStr, 'YYYY-MM-DD HH24:MI:SS'), :totalValue, :liters, :receiptImage, :receiptMime)
        `;

        const binds = {
            userId,
            carId,
            utcStr,
            totalValue,
            liters,
            receiptImage: receiptBuffer ? { type: oracledb.BLOB, dir: oracledb.BIND_IN, val: receiptBuffer } : null,
            receiptMime: receiptMime || null
        };

        await query(sql, binds);

        return Response.json({ success: true, message: 'Fuel entry added successfully' });
    } catch (error) {
        console.error("POST Fuel error:", error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return Response.json({ success: false, error: 'ID is required' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;

        // Find the carId and timestamp before deleting the fuel entry
        const carRes = await query(`
            SELECT TRIM(CAR_ID) AS CAR_ID, TO_CHAR(TIMESTAMP_UTC, 'YYYY-MM-DD"T"HH24:MI:SS') AS TIMESTAMP_UTC 
            FROM FUEL 
            WHERE TRIM(ID) = TRIM(:id) AND TRIM(USER_ID) = TRIM(:userId) AND (IS_DELETED = 0 OR IS_DELETED IS NULL)
        `, { id, userId });
        if (carRes.rows.length === 0) {
            return Response.json({ success: false, error: 'Not found or not authorized' }, { status: 404 });
        }
        const carId = carRes.rows[0].CAR_ID;
        const deletedTimestampISO = carRes.rows[0].TIMESTAMP_UTC;
        const deletedUtcStr = deletedTimestampISO.substring(0, 19).replace('T', ' ');

        // Find the prior fuel timestamp for this car (if any)
        const priorFuelRes = await query(`
            SELECT TO_CHAR(TIMESTAMP_UTC, 'YYYY-MM-DD"T"HH24:MI:SS') AS TIMESTAMP_UTC 
            FROM FUEL 
            WHERE TRIM(CAR_ID) = TRIM(:carId) 
              AND TRIM(USER_ID) = TRIM(:userId) 
              AND TIMESTAMP_UTC < TO_DATE(:deletedUtcStr, 'YYYY-MM-DD HH24:MI:SS')
              AND (IS_DELETED = 0 OR IS_DELETED IS NULL)
            ORDER BY TIMESTAMP_UTC DESC 
            FETCH NEXT 1 ROWS ONLY
        `, { carId, userId, deletedUtcStr });

        const sql = `UPDATE FUEL SET IS_DELETED = 1, UPDATED_AT = SYS_EXTRACT_UTC(SYSTIMESTAMP) WHERE TRIM(ID) = TRIM(:id) AND TRIM(USER_ID) = TRIM(:userId)`;
        const result = await query(sql, { id, userId });

        if (result.rowsAffected > 0) {
            if (priorFuelRes.rows.length > 0) {
                const priorTimestampISO = priorFuelRes.rows[0].TIMESTAMP_UTC;
                const priorUtcStr = priorTimestampISO.substring(0, 19).replace('T', ' ');

                await query(`
                    UPDATE SESSION_DATA
                    SET COST = NULL, DISTANCE = NULL, TIME_TRAVELED = NULL
                    WHERE TRIM(CAR_ID) = TRIM(:carId)
                      AND START_UTC > TO_DATE(:priorUtcStr, 'YYYY-MM-DD HH24:MI:SS')
                      AND START_UTC < TO_DATE(:deletedUtcStr, 'YYYY-MM-DD HH24:MI:SS')
                `, { carId, priorUtcStr, deletedUtcStr });
            } else {
                // If there's no prior fuel, invalidate all sessions up to this deleted fueling point
                await query(`
                    UPDATE SESSION_DATA
                    SET COST = NULL, DISTANCE = NULL, TIME_TRAVELED = NULL
                    WHERE TRIM(CAR_ID) = TRIM(:carId)
                      AND START_UTC < TO_DATE(:deletedUtcStr, 'YYYY-MM-DD HH24:MI:SS')
                `, { carId, deletedUtcStr });
            }
        }

        return Response.json({ success: true, message: 'Fuel entry removed successfully' });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
