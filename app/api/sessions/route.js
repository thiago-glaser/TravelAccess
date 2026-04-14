import { getSession } from '@/lib/auth';
import { SessionView, SessionData, Device, UserDevice, sequelize } from '@/lib/models/index.js';
import { Op } from 'sequelize';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20;
    const offset = (page - 1) * limit;

    const carFilter = searchParams.get('carId');
    const yearFilter = searchParams.get('year');
    const monthFilter = searchParams.get('month');
    const typeFilter = searchParams.get('type');

    // Validate timezone to prevent SQL injection - only allow safe characters for IANA timezone names
    const rawTz = searchParams.get('tz') || 'UTC';
    const tzPattern = /^[a-zA-Z0-9_\/+-]+$/;
    if (!tzPattern.test(rawTz) || rawTz.length > 50) {
        return Response.json({ success: false, error: 'Invalid timezone format' }, { status: 400 });
    }
    const tzFilter = rawTz;

    try {
        const userId = session.USER_ID || session.id || session.ID;

        // Build where clauses for the ORM abstraction
        const whereConditions = {
            [Op.and]: [
                sequelize.literal(`\`SessionView\`.\`DEVICE_ID\` IN (SELECT \`DEVICE_ID\` FROM \`USER_DEVICES\` WHERE TRIM(\`USER_ID\`) = TRIM('${userId.trim()}'))`),
            ]
        };

        if (carFilter) {
            whereConditions[Op.and].push({ carId: carFilter.trim() });
        }

        if (yearFilter) {
            whereConditions[Op.and].push(
                sequelize.where(
                    sequelize.literal(`YEAR(CONVERT_TZ(\`SessionView\`.\`START_UTC\`, '+00:00', '${tzFilter}'))`),
                    parseInt(yearFilter)
                )
            );
        }

        if (monthFilter) {
            whereConditions[Op.and].push(
                sequelize.where(
                    sequelize.literal(`MONTH(CONVERT_TZ(\`SessionView\`.\`START_UTC\`, '+00:00', '${tzFilter}'))`),
                    parseInt(monthFilter)
                )
            );
        }

        if (typeFilter) {
            whereConditions[Op.and].push({ sessionType: typeFilter });
        }

        // Use findAndCountAll to execute count and fetch simultaneously
        const { count: total, rows: results } = await SessionView.findAndCountAll({
            where: whereConditions,
            include: [
                {
                    model: SessionData,
                    as: 'sessionData',
                    attributes: ['valueConfirmed'],
                    where: { isDeleted: 0 },
                    required: true
                },
                {
                    model: Device,
                    as: 'deviceInfo',
                    attributes: ['description'],
                    required: false
                }
            ],
            order: [['startUtc', 'DESC']],
            offset: offset,
            limit: limit
        });

        // Map abstract models into original json response form
        const sessions = results.map(row => {
            const description = row.carDescription || (row.deviceInfo ? row.deviceInfo.description : null);
            return {
                id: row.id.trim(),
                deviceId: row.deviceId.trim(),
                carId: row.carId ? row.carId.trim() : null,
                description: description,
                startTime: row.startUtc ? row.startUtc.toISOString().replace(/\.\d{3}Z$/, 'Z') : null,
                endTime: row.endUtc ? row.endUtc.toISOString().replace(/\.\d{3}Z$/, 'Z') : null,
                type: row.sessionType,
                locationStart: row.locationStart,
                locationEnd: row.locationEnd,
                cost: row.cost ? parseFloat(row.cost) : null,
                distance: row.distance ? parseFloat(row.distance) : null,
                timeTraveled: row.timeTraveled ? parseFloat(row.timeTraveled) : null,
                valueConfirmed: row.sessionData ? row.sessionData.valueConfirmed || 'N' : 'N'
            };
        });

        return Response.json({
            success: true,
            data: sessions,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Database error in sessions API:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    const session = await getSession(request);
    if (!session || (session.authType === 'api-key' && !session.IS_ADMIN)) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.isDemo === 'Y' || session.isDemo === true) {
        return Response.json({ success: false, error: 'Demo users cannot perform write operations' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { id, type, cost, distance, timeTraveled, valueConfirmed } = body;

        if (!id) {
            return Response.json({ success: false, error: 'ID is required' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;
        const updateData = {};

        if (type !== undefined) updateData.sessionType = type;
        if (cost !== undefined) updateData.cost = cost;
        if (distance !== undefined) updateData.distance = distance;
        if (timeTraveled !== undefined) updateData.timeTraveled = timeTraveled;
        if (valueConfirmed !== undefined) updateData.valueConfirmed = valueConfirmed;

        if (Object.keys(updateData).length === 0) {
            return Response.json({ success: false, error: 'No fields to update' }, { status: 400 });
        }

        updateData.updatedAt = new Date();

        // We update SessionData directly using ORM mapping
        const [updatedRows] = await SessionData.update(updateData, {
            where: {
                [Op.and]: [
                    sequelize.where(
                        sequelize.fn('RTRIM', sequelize.fn('LTRIM', sequelize.col('ID'))),
                        sequelize.fn('RTRIM', sequelize.fn('LTRIM', id.trim()))
                    ),
                    sequelize.where(
                        sequelize.fn('RTRIM', sequelize.fn('LTRIM', sequelize.col('DEVICE_ID'))),
                        { [Op.in]: sequelize.literal(`(SELECT TRIM(\`DEVICE_ID\`) FROM \`USER_DEVICES\` WHERE TRIM(\`USER_ID\`) = TRIM(${sequelize.escape(userId.trim())}))`) }
                    ),
                ]
            }
        });

        if (updatedRows === 0) {
            return Response.json({ success: false, error: 'Session not found or update failed' }, { status: 404 });
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error('Database error in sessions PATCH API:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession(request);
    if (!session || (session.authType === 'api-key' && !session.IS_ADMIN)) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.isDemo === 'Y' || session.isDemo === true) {
        return Response.json({ success: false, error: 'Demo users cannot perform write operations' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { deviceId, carId, startUtc, endUtc, sessionType } = body;

        if (!deviceId || !startUtc) {
            return Response.json({ success: false, error: 'Device ID and Start Time are required' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;

        // Verify device ownership
        const userDevice = await UserDevice.findOne({
            where: {
                userId: userId,
                deviceId: deviceId,
                isDeleted: { [Op.or]: [0, null] }
            }
        });

        if (!userDevice) {
            return Response.json({ success: false, error: 'Forbidden: Device does not belong to the user.' }, { status: 403 });
        }

        // Create the session
        const newSession = await SessionData.create({
            deviceId,
            carId: carId || null,
            startUtc: new Date(startUtc),
            endUtc: endUtc ? new Date(endUtc) : null,
            sessionType: sessionType || 'P',
            valueConfirmed: 'N' // Manually added sessions start unconfirmed
        });

        return Response.json({ success: true, id: newSession.id.trim() });
    } catch (error) {
        console.error('Database error in sessions POST API:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    const session = await getSession(request);
    if (!session || (session.authType === 'api-key' && !session.IS_ADMIN)) {
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

        // Perform soft delete
        const [updatedRows] = await SessionData.update(
            { isDeleted: 1, updatedAt: new Date() },
            {
                where: {
                    [Op.and]: [
                        sequelize.where(
                            sequelize.fn('RTRIM', sequelize.fn('LTRIM', sequelize.col('ID'))),
                            sequelize.fn('RTRIM', sequelize.fn('LTRIM', id.trim()))
                        ),
                        sequelize.where(
                            sequelize.fn('RTRIM', sequelize.fn('LTRIM', sequelize.col('DEVICE_ID'))),
                            { [Op.in]: sequelize.literal(`(SELECT TRIM(\`DEVICE_ID\`) FROM \`USER_DEVICES\` WHERE TRIM(\`USER_ID\`) = TRIM(${sequelize.escape(userId.trim())}))`) }
                        ),
                    ]
                }
            }
        );

        if (updatedRows === 0) {
            return Response.json({ success: false, error: 'Session not found or already deleted' }, { status: 404 });
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error('Database error in sessions DELETE API:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
