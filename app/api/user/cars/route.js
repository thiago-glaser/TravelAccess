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
            SELECT TRIM(ID) AS ID, DESCRIPTION, LICENSE_PLATE 
            FROM CARS 
            WHERE TRIM(USER_ID) = TRIM(:userId) AND (IS_DELETED = 0 OR IS_DELETED IS NULL)
            ORDER BY ID
        `;
        const result = await query(sql, { userId });

        return Response.json({ success: true, cars: result.rows });
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
        const { description, licensePlate } = await request.json();

        if (!description && !licensePlate) {
            return Response.json({ success: false, error: 'Description or License Plate is required' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;

        const sql = `INSERT INTO CARS (USER_ID, DESCRIPTION, LICENSE_PLATE) VALUES (:userId, :description, :licensePlate)`;
        await query(sql, {
            userId,
            description: description || null,
            licensePlate: licensePlate || null
        });

        return Response.json({ success: true, message: 'Car added successfully' });
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
        const { carId, description, licensePlate } = await request.json();

        if (!carId) {
            return Response.json({ success: false, error: 'Car ID is required' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;

        // Verify ownership and update
        const sql = `
            UPDATE CARS 
            SET DESCRIPTION = :description, LICENSE_PLATE = :licensePlate, UPDATED_AT = SYS_EXTRACT_UTC(SYSTIMESTAMP)
            WHERE TRIM(ID) = TRIM(:carId) AND TRIM(USER_ID) = TRIM(:userId) AND (IS_DELETED = 0 OR IS_DELETED IS NULL)
        `;
        const result = await query(sql, {
            description: description || null,
            licensePlate: licensePlate || null,
            carId,
            userId
        });

        if (result.rowsAffected === 0) {
            return Response.json({ success: false, error: 'Car not found or not authorized' }, { status: 404 });
        }

        return Response.json({ success: true, message: 'Car updated successfully' });
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
        const carId = searchParams.get('carId');

        if (!carId) {
            return Response.json({ success: false, error: 'Car ID is required' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;
        const sql = `UPDATE CARS SET IS_DELETED = 1, UPDATED_AT = SYS_EXTRACT_UTC(SYSTIMESTAMP) WHERE TRIM(ID) = TRIM(:carId) AND TRIM(USER_ID) = TRIM(:userId)`;
        const result = await query(sql, { carId, userId });

        if (result.rowsAffected === 0) {
            return Response.json({ success: false, error: 'Car not found or not authorized' }, { status: 404 });
        }

        return Response.json({ success: true, message: 'Car removed successfully' });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
