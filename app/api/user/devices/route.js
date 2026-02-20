import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.id || session.ID || session.USER_ID;
        const sql = `
            SELECT ud.DEVICE_ID, d.DESCRIPTION 
            FROM USER_DEVICES ud
            LEFT JOIN devices d ON ud.DEVICE_ID = d.DEVICE_ID
            WHERE ud.USER_ID = :userId 
            ORDER BY ud.DEVICE_ID
        `;
        const result = await query(sql, { userId });

        return Response.json({ success: true, devices: result.rows });
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
        const { deviceId, description } = await request.json();
        if (!deviceId) {
            return Response.json({ success: false, error: 'Device ID is required' }, { status: 400 });
        }

        const userId = session.id || session.ID || session.USER_ID;

        // Check if device is already owned by another user
        const ownerCheckSql = `SELECT USER_ID FROM USER_DEVICES WHERE DEVICE_ID = :deviceId`;
        const ownerResult = await query(ownerCheckSql, { deviceId });

        if (ownerResult.rows && ownerResult.rows.length > 0) {
            const currentOwner = ownerResult.rows[0].USER_ID;
            if (currentOwner === userId) {
                return Response.json({ success: false, error: 'You already own this device' }, { status: 409 });
            } else {
                return Response.json({ success: false, error: 'This device is already claimed by another user' }, { status: 403 });
            }
        }

        // Ensure device exists in master devices table
        const deviceExistsResult = await query(`SELECT device_id FROM devices WHERE device_id = :deviceId`, { deviceId });
        if (deviceExistsResult.rows.length === 0) {
            await query(
                `INSERT INTO devices (device_id, description) VALUES (:deviceId, :description)`,
                { deviceId, description: description || 'New Device' }
            );
        } else if (description) {
            // Update description if provided
            await query(`UPDATE devices SET description = :description WHERE device_id = :deviceId`, { description, deviceId });
        }

        const sql = `INSERT INTO USER_DEVICES (USER_ID, DEVICE_ID) VALUES (:userId, :deviceId)`;
        await query(sql, { userId, deviceId });

        return Response.json({ success: true, message: 'Device added successfully' });
    } catch (error) {
        if (error.errorNum === 1) {
            return Response.json({ success: false, error: 'Device already added to your account' }, { status: 409 });
        }
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { deviceId, description } = await request.json();
        const userId = session.id || session.ID || session.USER_ID;

        // Verify ownership first
        const verifySql = `SELECT 1 FROM USER_DEVICES WHERE USER_ID = :userId AND DEVICE_ID = :deviceId`;
        const verifyResult = await query(verifySql, { userId, deviceId });

        if (verifyResult.rows.length === 0) {
            return Response.json({ success: false, error: 'Unauthorized or device not found' }, { status: 403 });
        }

        // Update description in master table
        await query(
            `UPDATE devices SET description = :description WHERE device_id = :deviceId`,
            { description, deviceId }
        );

        return Response.json({ success: true, message: 'Description updated successfully' });
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
        const deviceId = searchParams.get('deviceId');

        if (!deviceId) {
            return Response.json({ success: false, error: 'Device ID is required' }, { status: 400 });
        }

        const userId = session.id || session.ID || session.USER_ID;
        const sql = `DELETE FROM USER_DEVICES WHERE USER_ID = :userId AND DEVICE_ID = :deviceId`;
        const result = await query(sql, { userId, deviceId });

        return Response.json({ success: true, message: 'Device removed successfully' });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
