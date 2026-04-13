import { getSession } from '@/lib/auth';
import { Insurance, Car, sequelize } from '@/lib/models/index.js';
import { Op } from 'sequelize';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.USER_ID || session.id || session.ID;
        
        const insurancesData = await Insurance.findAll({
            where: {
                userId: userId,
                isDeleted: {
                    [Op.or]: [0, null]
                }
            },
            attributes: [
                'id',
                'carId',
                'paymentDate',
                'period',
                'amount'
            ],
            include: [{
                model: Car,
                as: 'car',
                attributes: ['licensePlate', 'description']
            }],
            order: [['paymentDate', 'DESC']]
        });

        const insurances = insurancesData.map(i => {
            const raw = i.get({ plain: true });
            return {
                id: (raw.id || '').trim(),
                carId: (raw.carId || '').trim(),
                paymentDate: raw.paymentDate ? new Date(raw.paymentDate).toISOString().replace(/\.\d{3}Z$/, 'Z') : null,
                period: raw.period,
                amount: raw.amount,
                carLicensePlate: raw.car ? raw.car.licensePlate : null,
                carDescription: raw.car ? raw.car.description : null
            };
        });

        return Response.json({ success: true, insurances });
    } catch (error) {
        console.error("GET Insurance error:", error);
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
        const body = await request.json();
        const { carId, paymentDate, period, amount } = body;

        if (!carId || !paymentDate || !period || isNaN(amount)) {
            return Response.json({ success: false, error: 'Missing mandatory fields' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;

        // Ensure Car belongs to User
        const carExists = await Car.findOne({
            where: sequelize.and(
                { id: String(carId).trim() },
                { userId: String(userId).trim() },
                { isDeleted: { [Op.or]: [0, null] } }
            )
        });

        if (!carExists) {
            return Response.json({ success: false, error: 'Invalid car selected' }, { status: 400 });
        }

        const newInsurance = await Insurance.create({
            userId: userId,
            carId: carId,
            paymentDate: new Date(paymentDate),
            period: period,
            amount: amount
        });

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

    if (session.isDemo === 'Y' || session.isDemo === true) {
        return Response.json({ success: false, error: 'Demo users cannot perform write operations' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return Response.json({ success: false, error: 'ID is required' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;

        const [updatedRowsCount] = await Insurance.update(
            { isDeleted: 1, updatedAt: new Date() },
            { 
                where: sequelize.and(
                    { id: String(id).trim() },
                    { userId: String(userId).trim() }
                )
            }
        );

        if (updatedRowsCount === 0) {
            return Response.json({ success: false, error: 'Not found or not authorized' }, { status: 404 });
        }

        return Response.json({ success: true, message: 'Insurance entry removed successfully' });
    } catch (error) {
        console.error("DELETE Insurance error:", error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
