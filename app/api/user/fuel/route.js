import { getSession } from '@/lib/auth';
import { Fuel, Car, SessionData, sequelize } from '@/lib/models/index.js';
import { Op } from 'sequelize';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.USER_ID || session.id || session.ID;

        const fuelsData = await Fuel.findAll({
            where: {
                userId: userId,
                isDeleted: { [Op.or]: [0, null] }
            },
            attributes: [
                'id',
                'carId',
                'timestampUtc',
                'totalValue',
                'liters',
                'totalKilometers',
                'kilometerPerLiter',
                'pricePerKilometer',
                'receiptMime',
                [sequelize.literal(`CASE WHEN "RECEIPT_IMAGE" IS NOT NULL THEN 1 ELSE 0 END`), 'hasReceipt']
            ],
            include: [{
                model: Car,
                as: 'car',
                attributes: ['licensePlate', 'description']
            }],
            order: [['timestampUtc', 'DESC']]
        });

        const fuelEntries = fuelsData.map(f => {
            const raw = f.get({ plain: true });
            return {
                id: (raw.id || '').trim(),
                carId: (raw.carId || '').trim(),
                timestampUtc: raw.timestampUtc ? new Date(raw.timestampUtc).toISOString().replace(/\.\d{3}Z$/, 'Z') : null,
                totalValue: raw.totalValue,
                liters: raw.liters,
                totalKilometers: raw.totalKilometers || 0,
                kilometerPerLiter: raw.kilometerPerLiter || 0,
                pricePerKilometer: raw.pricePerKilometer || 0,
                carLicensePlate: raw.car ? raw.car.licensePlate : null,
                carDescription: raw.car ? raw.car.description : null,
                hasReceipt: raw.hasReceipt === 1,
                receiptMime: raw.receiptMime
            };
        });

        return Response.json({ success: true, fuel: fuelEntries });
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
        const formData = await request.formData();
        const carId = formData.get('carId');
        const timestampIso = formData.get('timestampIso'); // expects valid UTC ISO string
        const totalValue = parseFloat(formData.get('totalValue'));
        const liters = parseFloat(formData.get('liters'));
        const receiptFile = formData.get('receipt');

        if (!carId || !timestampIso || isNaN(totalValue) || isNaN(liters)) {
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

        let receiptBuffer = null;
        let receiptMime = null;

        if (receiptFile && typeof receiptFile === 'object' && receiptFile.size > 0) {
            const arrayBuffer = await receiptFile.arrayBuffer();
            receiptBuffer = Buffer.from(arrayBuffer);
            receiptMime = receiptFile.type;
        }

        await Fuel.create({
            userId,
            carId,
            timestampUtc: new Date(timestampIso),
            totalValue,
            liters,
            receiptImage: receiptBuffer,
            receiptMime: receiptMime
        });

        return Response.json({ success: true, message: 'Fuel entry added successfully' });
    } catch (error) {
        console.error("POST Fuel error:", error);
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

        // Find the carId and timestamp before deleting the fuel entry
        const deletedFuel = await Fuel.findOne({
            where: sequelize.and(
                { id: String(id).trim() },
                { userId: String(userId).trim() },
                { isDeleted: { [Op.or]: [0, null] } }
            )
        });

        if (!deletedFuel) {
            return Response.json({ success: false, error: 'Not found or not authorized' }, { status: 404 });
        }
        
        const carId = deletedFuel.get('carId').trim();
        const deletedTimestamp = deletedFuel.get('timestampUtc');

        // Find the prior fuel timestamp for this car (if any)
        const priorFuel = await Fuel.findOne({
            where: sequelize.and(
                { carId: carId },
                { userId: String(userId).trim() },
                { timestampUtc: { [Op.lt]: deletedTimestamp } },
                { isDeleted: { [Op.or]: [0, null] } }
            ),
            order: [['timestampUtc', 'DESC']]
        });

        // Delete the fuel entry
        const [updatedRowsCount] = await Fuel.update(
            { isDeleted: 1, updatedAt: new Date() },
            {
                where: sequelize.and(
                    { id: String(id).trim() },
                    { userId: String(userId).trim() }
                )
            }
        );

        if (updatedRowsCount > 0) {
            let sessionCondition = {
                carId: { carId: carId },
                startUtc: { [Op.lt]: deletedTimestamp }
            };

            if (priorFuel) {
                // Between prior fuel and deleted fuel
                sessionCondition.startUtc = {
                    [Op.gt]: priorFuel.timestampUtc,
                    [Op.lt]: deletedTimestamp
                };
            }

            await sequelize.query(`
                UPDATE SESSION_DATA
                SET COST = NULL, DISTANCE = NULL, TIME_TRAVELED = NULL,
                    VALUE_CONFIRMED = 'N',
                    UPDATED_AT = UTC_TIMESTAMP()
                WHERE TRIM(CAR_ID) = :carId
                  ${priorFuel ? `AND START_UTC > :priorTimestamp` : ''}
                  AND START_UTC < :deletedTimestamp
            `, {
                replacements: { 
                    carId, 
                    priorTimestamp: priorFuel ? priorFuel.timestampUtc : null,
                    deletedTimestamp
                }
            });
        }

        return Response.json({ success: true, message: 'Fuel entry removed successfully' });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
