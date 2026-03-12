import { getSession } from '@/lib/auth';
import { Maintenance, Car, sequelize } from '@/lib/models/index.js';
import { Op } from 'sequelize';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.USER_ID || session.id || session.ID;
        
        const maintenances = await Maintenance.findAll({
            where: {
                userId: userId,
                isDeleted: {
                    [Op.or]: [0, null]
                }
            },
            attributes: [
                'id',
                'carId',
                'maintenanceDate',
                'amount',
                'description',
                [sequelize.literal(`CASE WHEN "RECEIPT_IMAGE" IS NOT NULL THEN 1 ELSE 0 END`), 'hasReceipt']
            ],
            include: [{
                model: Car,
                as: 'car',
                attributes: ['licensePlate', 'description']
            }],
            order: [['maintenanceDate', 'DESC']]
        });

        const maintenanceEntries = maintenances.map(m => {
            const raw = m.get({ plain: true });
            return {
                id: (raw.id || '').trim(),
                carId: (raw.carId || '').trim(),
                maintenanceDate: raw.maintenanceDate ? new Date(raw.maintenanceDate).toISOString().replace(/\.\d{3}Z$/, 'Z') : null,
                amount: raw.amount,
                description: raw.description,
                carLicensePlate: raw.car ? raw.car.licensePlate : null,
                carDescription: raw.car ? raw.car.description : null,
                hasReceipt: raw.hasReceipt === 1
            };
        });

        return Response.json({ success: true, maintenance: maintenanceEntries });
    } catch (error) {
        console.error("GET Maintenance error:", error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const carId = formData.get('carId');
        const maintenanceDateIso = formData.get('maintenanceDateIso'); // expects valid UTC ISO string
        const amount = parseFloat(formData.get('amount'));
        const description = formData.get('description');
        const receiptFile = formData.get('receipt');

        if (!carId || !maintenanceDateIso || isNaN(amount) || !description) {
            return Response.json({ success: false, error: 'Missing mandatory fields' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;

        // Ensure Car belongs to User
        const carCount = await Car.count({
            where: {
                id: carId.padEnd(36, ' '), // Pad with spaces because CHAR(36) in Oracle might require it depending on drivers, or Sequelize handles it. Let's rely on DB or trim in where string, Sequelize escapes params.
                userId: userId,
                isDeleted: {
                    [Op.or]: [0, null]
                }
            }
        });
        
        // Let's use raw where to ensure trim if needed
        const carExists = await Car.findOne({
            where: sequelize.and(
                { id: carId.trim() },
                { userId: userId.trim() },
                { isDeleted: { [Op.or]: [0, null] } }
            )
        });

        if (!carExists) {
            return Response.json({ success: false, error: 'Invalid car selected' }, { status: 400 });
        }

        let receiptBuffer = null;
        let receiptMime = null;

        if (receiptFile && typeof receiptFile === 'object' && receiptFile.size > 0) {
            const arrayBuffer = await receiptFile.arrayBuffer();
            receiptBuffer = Buffer.from(arrayBuffer);
            receiptMime = receiptFile.type;
        }

        const newMaintenance = await Maintenance.create({
            userId: userId,
            carId: carId,
            maintenanceDate: new Date(maintenanceDateIso),
            amount: amount,
            description: description,
            receiptImage: receiptBuffer,
            receiptMime: receiptMime
        });

        return Response.json({ success: true, message: 'Maintenance entry added successfully' });
    } catch (error) {
        console.error("POST Maintenance error:", error);
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

        await Maintenance.update(
            { isDeleted: 1, updatedAt: new Date() },
            { 
                where: sequelize.and(
                    { id: id.trim() },
                    { userId: userId.trim() }
                )
            }
        );

        return Response.json({ success: true, message: 'Maintenance entry removed successfully' });
    } catch (error) {
        console.error("DELETE Maintenance error:", error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
