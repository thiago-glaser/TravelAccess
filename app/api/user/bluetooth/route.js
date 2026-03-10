import { getSession } from '@/lib/auth';
import { Bluetooth, Car, sequelize } from '@/lib/models/index.js';
import { Op } from 'sequelize';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.USER_ID || session.id || session.ID;

        const bluetoothData = await Bluetooth.findAll({
            where: {
                userId: userId,
                isDeleted: { [Op.or]: [0, null] }
            },
            attributes: ['id', 'name', 'description', 'address', 'carId'],
            include: [{
                model: Car,
                as: 'car',
                attributes: ['description'],
                required: false
            }],
            order: [['id', 'ASC']]
        });

        const bluetooth = bluetoothData.map(b => {
            const raw = b.get({ plain: true });
            return {
                ID: (raw.id || '').trim(),
                NAME: raw.name,
                DESCRIPTION: raw.description,
                ADDRESS: raw.address,
                CAR_ID: raw.carId ? raw.carId.trim() : null,
                CAR_DESCRIPTION: raw.car ? raw.car.description : null
            };
        });

        return Response.json({ success: true, bluetooth });
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
        const existingCheck = await Bluetooth.findOne({
            where: sequelize.and(
                sequelize.where(sequelize.fn('TRIM', sequelize.col('USER_ID')), userId.trim()),
                { address: address, isDeleted: { [Op.or]: [0, null] } }
            )
        });

        if (existingCheck) {
            return Response.json({ success: true, message: 'Bluetooth device already exists (silent success)' });
        }

        await Bluetooth.create({
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

        const [updatedRowsCount] = await Bluetooth.update(
            { 
                name, 
                description: description || null, 
                address, 
                carId: carId ? String(carId) : null,
                updatedAt: sequelize.fn('SYS_EXTRACT_UTC', sequelize.fn('SYSTIMESTAMP'))
            },
            {
                where: sequelize.and(
                    sequelize.where(sequelize.fn('TRIM', sequelize.col('ID')), id.trim()),
                    sequelize.where(sequelize.fn('TRIM', sequelize.col('USER_ID')), userId.trim()),
                    { isDeleted: { [Op.or]: [0, null] } }
                )
            }
        );

        if (updatedRowsCount === 0) {
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

        const [updatedRowsCount] = await Bluetooth.update(
            { isDeleted: 1, updatedAt: sequelize.fn('SYS_EXTRACT_UTC', sequelize.fn('SYSTIMESTAMP')) },
            {
                where: sequelize.and(
                    sequelize.where(sequelize.fn('TRIM', sequelize.col('ID')), id.trim()),
                    sequelize.where(sequelize.fn('TRIM', sequelize.col('USER_ID')), userId.trim())
                )
            }
        );

        if (updatedRowsCount === 0) {
            return Response.json({ success: false, error: 'Bluetooth device not found or not authorized' }, { status: 404 });
        }

        return Response.json({ success: true, message: 'Bluetooth device removed successfully' });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
