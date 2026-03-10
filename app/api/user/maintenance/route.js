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
            SELECT TRIM(m.ID) AS ID, TRIM(m.CAR_ID) AS CAR_ID, TO_CHAR(m.MAINTENANCE_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS MAINTENANCE_DATE, 
                   m.AMOUNT, m.DESCRIPTION,
                   c.LICENSE_PLATE, c.DESCRIPTION AS CAR_DESCRIPTION,
                   CASE WHEN m.RECEIPT_IMAGE IS NOT NULL THEN 1 ELSE 0 END AS HAS_RECEIPT
            FROM MAINTENANCE m
            JOIN CARS c ON TRIM(m.CAR_ID) = TRIM(c.ID)
            WHERE TRIM(m.USER_ID) = TRIM(:userId) AND (m.IS_DELETED = 0 OR m.IS_DELETED IS NULL)
            ORDER BY m.MAINTENANCE_DATE DESC
        `;
        const result = await query(sql, { userId });

        const maintenanceEntries = result.rows.map(row => ({
            id: row.ID,
            carId: row.CAR_ID,
            maintenanceDate: row.MAINTENANCE_DATE,
            amount: row.AMOUNT,
            description: row.DESCRIPTION,
            carLicensePlate: row.LICENSE_PLATE,
            carDescription: row.CAR_DESCRIPTION,
            hasReceipt: row.HAS_RECEIPT === 1
        }));

        return Response.json({ success: true, maintenance: maintenanceEntries });
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
        const maintenanceDateIso = formData.get('maintenanceDateIso'); // expects valid UTC ISO string
        const amount = parseFloat(formData.get('amount'));
        const description = formData.get('description');
        const receiptFile = formData.get('receipt');

        if (!carId || !maintenanceDateIso || isNaN(amount) || !description) {
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

        // Construct a strict UTC string without milliseconds/Z
        const utcStr = new Date(maintenanceDateIso).toISOString().substring(0, 19).replace('T', ' ');

        const sql = `
            INSERT INTO MAINTENANCE (USER_ID, CAR_ID, MAINTENANCE_DATE, AMOUNT, DESCRIPTION, RECEIPT_IMAGE, RECEIPT_MIME)
            VALUES (:userId, :carId, TO_DATE(:utcStr, 'YYYY-MM-DD HH24:MI:SS'), :amount, :description, :receiptImage, :receiptMime)
        `;

        const binds = {
            userId,
            carId,
            utcStr,
            amount,
            description,
            receiptImage: receiptBuffer ? { type: oracledb.BLOB, dir: oracledb.BIND_IN, val: receiptBuffer } : null,
            receiptMime: receiptMime || null
        };

        await query(sql, binds);

        return Response.json({ success: true, message: 'Maintenance entry added successfully' });
    } catch (error) {
        console.error("POST Maintenance error:", error);
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

        const sql = `UPDATE MAINTENANCE SET IS_DELETED = 1, UPDATED_AT = SYS_EXTRACT_UTC(SYSTIMESTAMP) WHERE TRIM(ID) = TRIM(:id) AND TRIM(USER_ID) = TRIM(:userId)`;
        await query(sql, { id, userId });

        return Response.json({ success: true, message: 'Maintenance entry removed successfully' });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
