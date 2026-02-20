import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.id || session.ID || session.USER_ID;
        const sql = `SELECT DEVICE_ID FROM USER_DEVICES WHERE USER_ID = :userId ORDER BY DEVICE_ID`;
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
        const { deviceId } = await request.json();
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
