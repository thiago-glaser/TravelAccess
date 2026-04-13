import { getSession } from '@/lib/auth';
import { Car, sequelize } from '@/lib/models/index.js';
import { Op } from 'sequelize';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.USER_ID || session.id || session.ID;

        const carsData = await Car.findAll({
            where: {
                userId: userId,
                isDeleted: { [Op.or]: [0, null] }
            },
            attributes: ['id', 'description', 'licensePlate'],
            order: [['id', 'ASC']]
        });

        const cars = carsData.map(c => {
            const raw = c.get({ plain: true });
            return {
                ID: (raw.id || '').trim(),
                DESCRIPTION: raw.description,
                LICENSE_PLATE: raw.licensePlate
            };
        });

        return Response.json({ success: true, cars });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.isDemo === 'Y' || session.isDemo === true) {
        return Response.json({ success: false, error: 'Demo users cannot perform write operations' }, { status: 403 });
    }

    try {
        const { description, licensePlate } = await request.json();

        if (!description && !licensePlate) {
            return Response.json({ success: false, error: 'Description or License Plate is required' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;

        await Car.create({
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

    if (session.isDemo === 'Y' || session.isDemo === true) {
        return Response.json({ success: false, error: 'Demo users cannot perform write operations' }, { status: 403 });
    }

    try {
        const { carId, description, licensePlate } = await request.json();

        if (!carId) {
            return Response.json({ success: false, error: 'Car ID is required' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;
        const paddedCarId = String(carId).trim();
        const paddedUserId = String(userId).trim();

        const [updatedRowsCount] = await Car.update(
            { 
                description: description || null, 
                licensePlate: licensePlate || null,
                updatedAt: new Date()
            },
            {
                where: sequelize.and(
                    { id: paddedCarId },
                    { userId: paddedUserId },
                    { isDeleted: { [Op.or]: [0, null] } }
                )
            }
        );

        if (updatedRowsCount === 0) {
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

    if (session.isDemo === 'Y' || session.isDemo === true) {
        return Response.json({ success: false, error: 'Demo users cannot perform write operations' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const carId = searchParams.get('carId');

        if (!carId) {
            return Response.json({ success: false, error: 'Car ID is required' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;
        const paddedCarId = String(carId).trim();
        const paddedUserId = String(userId).trim();

        const [updatedRowsCount] = await Car.update(
            { isDeleted: 1, updatedAt: new Date() },
            {
                where: sequelize.and(
                    { id: paddedCarId },
                    { userId: paddedUserId }
                )
            }
        );

        if (updatedRowsCount === 0) {
            return Response.json({ success: false, error: 'Car not found or not authorized' }, { status: 404 });
        }

        return Response.json({ success: true, message: 'Car removed successfully' });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
