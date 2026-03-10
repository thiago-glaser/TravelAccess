import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.USER_ID || session.id || session.ID;
        const sql = `
            SELECT TRIM(i.ID) AS ID, TRIM(i.CAR_ID) AS CAR_ID, TO_CHAR(i.PAYMENT_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS PAYMENT_DATE, 
                   i.PERIOD, i.AMOUNT,
                   c.LICENSE_PLATE, c.DESCRIPTION AS CAR_DESCRIPTION
            FROM INSURANCE i
            JOIN CARS c ON TRIM(i.CAR_ID) = TRIM(c.ID)
            WHERE TRIM(i.USER_ID) = TRIM(:userId) AND (i.IS_DELETED = 0 OR i.IS_DELETED IS NULL)
            ORDER BY i.PAYMENT_DATE DESC
        `;
        const result = await query(sql, { userId });

        const insurances = result.rows.map(row => ({
            id: row.ID,
            carId: row.CAR_ID,
            paymentDate: row.PAYMENT_DATE,
            period: row.PERIOD,
            amount: row.AMOUNT,
            carLicensePlate: row.LICENSE_PLATE,
            carDescription: row.CAR_DESCRIPTION
        }));

        return Response.json({ success: true, insurances });
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
        const body = await request.json();
        const { carId, paymentDate, period, amount } = body;

        if (!carId || !paymentDate || !period || isNaN(amount)) {
            return Response.json({ success: false, error: 'Missing mandatory fields' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;

        // Ensure Car belongs to User
        const carCheckResult = await query(`SELECT ID FROM CARS WHERE TRIM(ID) = TRIM(:carId) AND TRIM(USER_ID) = TRIM(:userId) AND (IS_DELETED = 0 OR IS_DELETED IS NULL)`, { carId, userId });
        if (carCheckResult.rows.length === 0) {
            return Response.json({ success: false, error: 'Invalid car selected' }, { status: 400 });
        }

        const utcStr = new Date(paymentDate).toISOString().substring(0, 19).replace('T', ' ');

        const sql = `
            INSERT INTO INSURANCE (USER_ID, CAR_ID, PAYMENT_DATE, PERIOD, AMOUNT)
            VALUES (:userId, :carId, TO_DATE(:utcStr, 'YYYY-MM-DD HH24:MI:SS'), :period, :amount)
        `;

        const binds = {
            userId,
            carId,
            utcStr,
            period,
            amount
        };

        await query(sql, binds);

        return Response.json({ success: true, message: 'Insurance entry added successfully' });
    } catch (error) {
        console.error("POST Insurance error:", error);
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

        const sql = `UPDATE INSURANCE SET IS_DELETED = 1, UPDATED_AT = SYS_EXTRACT_UTC(SYSTIMESTAMP) WHERE TRIM(ID) = TRIM(:id) AND TRIM(USER_ID) = TRIM(:userId)`;
        const result = await query(sql, { id, userId });

        if (result.rowsAffected === 0) {
            return Response.json({ success: false, error: 'Not found or not authorized' }, { status: 404 });
        }

        return Response.json({ success: true, message: 'Insurance entry removed successfully' });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
