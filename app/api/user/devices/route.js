import { getSession, verifyDeviceOwnership } from '@/lib/auth';
import { UserDevice, Device, sequelize } from '@/lib/models/index.js';
import { Op } from 'sequelize';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.USER_ID || session.id || session.ID;

        const userDevicesData = await UserDevice.findAll({
            where: {
                userId: userId,
                isDeleted: { [Op.or]: [0, null] }
            },
            attributes: ['deviceId'],
            include: [{
                model: Device,
                as: 'deviceInfo',
                attributes: ['description'],
                required: false
            }],
            order: [['deviceId', 'ASC']]
        });

        const devices = userDevicesData.map(ud => {
            const raw = ud.get({ plain: true });
            return {
                DEVICE_ID: raw.deviceId,
                DESCRIPTION: raw.deviceInfo ? raw.deviceInfo.description : null
            };
        });

        return Response.json({ success: true, devices });
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

        const userId = session.USER_ID || session.id || session.ID;

        // Check if device is already owned by another user
        const ownerCheck = await UserDevice.findOne({
            where: {
                deviceId: deviceId,
                isDeleted: { [Op.or]: [0, null] }
            }
        });

        if (ownerCheck) {
            const currentOwner = (ownerCheck.userId || '').trim();
            if (currentOwner === userId.trim()) {
                return Response.json({ success: false, error: 'You already own this device' }, { status: 409 });
            } else {
                return Response.json({ success: false, error: 'This device is already claimed by another user' }, { status: 403 });
            }
        }

        // Ensure device exists in master devices table
        const deviceExists = await Device.findOne({ where: { deviceId } });
        
        if (!deviceExists) {
            await Device.create({
                deviceId,
                description: description || 'New Device'
            });
        } else if (description) {
            // Update description if provided
            deviceExists.description = description;
            await deviceExists.save();
        }

        await UserDevice.create({
            userId,
            deviceId
        });

        return Response.json({ success: true, message: 'Device added successfully' });
    } catch (error) {
        // Sequelize UniqueConstraintError might occur if race condition
        if (error.name === 'SequelizeUniqueConstraintError') {
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

        // Verify ownership first
        const isOwner = await verifyDeviceOwnership(session, deviceId);

        if (!isOwner) {
            return Response.json({ success: false, error: 'Unauthorized or device not found' }, { status: 403 });
        }

        // Update description in master table
        await Device.update(
            { description },
            { where: { deviceId } }
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

        const userId = session.USER_ID || session.id || session.ID;
        
        await UserDevice.update(
            { isDeleted: 1, updatedAt: sequelize.fn('SYS_EXTRACT_UTC', sequelize.fn('SYSTIMESTAMP')) },
            {
                where: sequelize.and(
                    sequelize.where(sequelize.fn('TRIM', sequelize.col('USER_ID')), userId.trim()),
                    { deviceId: deviceId }
                )
            }
        );

        return Response.json({ success: true, message: 'Device removed successfully' });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
