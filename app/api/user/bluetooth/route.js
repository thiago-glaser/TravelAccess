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
            SELECT TRIM(b.ID) AS ID, b.NAME, b.DESCRIPTION, b.ADDRESS, TRIM(b.CAR_ID) AS CAR_ID, c.DESCRIPTION AS CAR_DESCRIPTION
            FROM BLUETOOTH b
            LEFT JOIN CARS c ON TRIM(b.CAR_ID) = TRIM(c.ID)
            WHERE TRIM(b.USER_ID) = TRIM(:userId)
            ORDER BY b.ID
        `;
        const result = await query(sql, { userId });

        return Response.json({ success: true, bluetooth: result.rows });
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
        const { name, description, address, carId } = await request.json();

        if (!name || !address) {
            return Response.json({ success: false, error: 'Name and Address are required' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;

        // Check if device already exists for this user to avoid duplicates
        const existingCheck = await query(`SELECT ID FROM BLUETOOTH WHERE TRIM(USER_ID) = TRIM(:userId) AND ADDRESS = :address`, { userId, address });

        if (existingCheck.rows && existingCheck.rows.length > 0) {
            return Response.json({ success: true, message: 'Bluetooth device already exists (silent success)' });
        }

        const sql = `INSERT INTO BLUETOOTH (USER_ID, NAME, DESCRIPTION, ADDRESS, CAR_ID) VALUES (:userId, :name, :description, :address, :carId)`;
        await query(sql, {
            userId,
            name,
            description: description || null,
            address,
            carId: carId ? String(carId) : null
        });

        return Response.json({ success: true, message: 'Bluetooth device added successfully' });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id, name, description, address, carId } = await request.json();

        if (!id || !name || !address) {
            return Response.json({ success: false, error: 'ID, Name, and Address are required' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;

        // Verify ownership and update
        const sql = `
            UPDATE BLUETOOTH 
            SET NAME = :name, DESCRIPTION = :description, ADDRESS = :address, CAR_ID = :carId 
            WHERE TRIM(ID) = TRIM(:id) AND TRIM(USER_ID) = TRIM(:userId)
        `;
        const result = await query(sql, {
            name,
            description: description || null,
            address,
            carId: carId ? String(carId) : null,
            id,
            userId
        });

        if (result.rowsAffected === 0) {
            return Response.json({ success: false, error: 'Bluetooth device not found or not authorized' }, { status: 404 });
        }

        return Response.json({ success: true, message: 'Bluetooth device updated successfully' });
    } catch (error) {
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
        const sql = `DELETE FROM BLUETOOTH WHERE TRIM(ID) = TRIM(:id) AND TRIM(USER_ID) = TRIM(:userId)`;
        const result = await query(sql, { id, userId });

        if (result.rowsAffected === 0) {
            return Response.json({ success: false, error: 'Bluetooth device not found or not authorized' }, { status: 404 });
        }

        return Response.json({ success: true, message: 'Bluetooth device removed successfully' });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
