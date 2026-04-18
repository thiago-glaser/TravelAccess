import { getSession } from '@/lib/auth';
import { OtherExpense, Car, ExpenseType, sequelize } from '@/lib/models/index.js';
import { Op } from 'sequelize';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.USER_ID || session.id || session.ID;
        
        const expenses = await OtherExpense.findAll({
            where: {
                userId: userId,
                isDeleted: {
                    [Op.or]: [0, null]
                }
            },
            attributes: [
                'id',
                'carId',
                'expenseTypeId',
                'expenseDate',
                'amount',
                'description',
                'receiptMime',
                [sequelize.literal('CASE WHEN `RECEIPT_IMAGE` IS NOT NULL THEN 1 ELSE 0 END'), 'hasReceipt']
            ],
            include: [
                {
                    model: Car,
                    as: 'car',
                    attributes: ['licensePlate', 'description']
                },
                {
                    model: ExpenseType,
                    as: 'expenseType',
                    attributes: ['name']
                }
            ],
            order: [['expenseDate', 'DESC']]
        });

        const entryList = expenses.map(e => {
            const raw = e.get({ plain: true });
            return {
                id: (raw.id || '').trim(),
                carId: (raw.carId || '').trim(),
                expenseTypeId: (raw.expenseTypeId || '').trim(),
                expenseDate: raw.expenseDate ? new Date(raw.expenseDate).toISOString().replace(/\.\d{3}Z$/, 'Z') : null,
                amount: raw.amount,
                description: raw.description,
                carLicensePlate: raw.car ? raw.car.licensePlate : null,
                carDescription: raw.car ? raw.car.description : null,
                expenseTypeName: raw.expenseType ? raw.expenseType.name : null,
                hasReceipt: raw.hasReceipt === 1,
                receiptMime: raw.receiptMime
            };
        });

        return Response.json({ success: true, expenses: entryList });
    } catch (error) {
        console.error("GET OtherExpense error:", error);
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
        const formData = await request.formData();
        const carId = formData.get('carId');
        const expenseTypeId = formData.get('expenseTypeId');
        const expenseDateIso = formData.get('expenseDateIso');
        const amount = parseFloat(formData.get('amount'));
        const description = formData.get('description');
        const receiptFile = formData.get('receipt');

        if (!carId || !expenseTypeId || !expenseDateIso || isNaN(amount) || !description) {
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

        // Ensure ExpenseType belongs to User
        const typeExists = await ExpenseType.findOne({
            where: sequelize.and(
                { id: String(expenseTypeId).trim() },
                { userId: String(userId).trim() },
                { isDeleted: { [Op.or]: [0, null] } }
            )
        });

        if (!typeExists) {
            return Response.json({ success: false, error: 'Invalid expense type selected' }, { status: 400 });
        }

        let receiptBuffer = null;
        let receiptMime = null;

        if (receiptFile && typeof receiptFile === 'object' && receiptFile.size > 0) {
            const arrayBuffer = await receiptFile.arrayBuffer();
            receiptBuffer = Buffer.from(arrayBuffer);
            receiptMime = receiptFile.type;
        }

        const newExp = await OtherExpense.create({
            userId: userId,
            carId: carId,
            expenseTypeId: expenseTypeId,
            expenseDate: new Date(expenseDateIso),
            amount: amount,
            description: description,
            receiptImage: receiptBuffer,
            receiptMime: receiptMime
        });

        return Response.json({ success: true, message: 'Expense entry added successfully' });
    } catch (error) {
        console.error("POST OtherExpense error:", error);
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

        await OtherExpense.update(
            { isDeleted: 1, updatedAt: new Date() },
            { 
                where: sequelize.and(
                    { id: String(id).trim() },
                    { userId: String(userId).trim() }
                )
            }
        );

        return Response.json({ success: true, message: 'Expense entry removed successfully' });
    } catch (error) {
        console.error("DELETE OtherExpense error:", error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
