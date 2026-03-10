import { getSession } from '@/lib/auth';
import { SessionView, SessionData, Device, sequelize } from '@/lib/models/index.js';
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
    const tzFilter = searchParams.get('tz') || 'UTC';

    try {
        const userId = session.USER_ID || session.id || session.ID;

        // Build where clauses for the ORM abstraction
        const whereConditions = {
            [Op.and]: [
                sequelize.literal(`"SessionView"."DEVICE_ID" IN (SELECT "DEVICE_ID" FROM "USER_DEVICES" WHERE RTRIM(LTRIM("USER_ID")) = RTRIM(LTRIM('${userId.trim()}')))`),
            ]
        };

        if (carFilter) {
            whereConditions[Op.and].push(sequelize.where(sequelize.fn('TRIM', sequelize.col('SessionView.CAR_ID')), carFilter.trim()));
        }

        if (yearFilter) {
            whereConditions[Op.and].push(
                sequelize.where(
                    sequelize.literal(`TO_NUMBER(TO_CHAR(FROM_TZ(CAST("SessionView"."START_UTC" AS TIMESTAMP), 'UTC') AT TIME ZONE CAST('${tzFilter}' AS VARCHAR2(50)), 'YYYY'))`),
                    parseInt(yearFilter)
                )
            );
        }

        if (monthFilter) {
            whereConditions[Op.and].push(
                sequelize.where(
                    sequelize.literal(`TO_NUMBER(TO_CHAR(FROM_TZ(CAST("SessionView"."START_UTC" AS TIMESTAMP), 'UTC') AT TIME ZONE CAST('${tzFilter}' AS VARCHAR2(50)), 'MM'))`),
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

        updateData.updatedAt = sequelize.fn('SYS_EXTRACT_UTC', sequelize.fn('SYSTIMESTAMP'));

        // We update SessionData directly using ORM mapping
        const [updatedRows] = await SessionData.update(updateData, {
            where: sequelize.and(
                sequelize.where(sequelize.fn('TRIM', sequelize.col('ID')), id.trim()),
                sequelize.literal(`"DEVICE_ID" IN (SELECT "DEVICE_ID" FROM "USER_DEVICES" WHERE RTRIM(LTRIM("USER_ID")) = RTRIM(LTRIM('${userId.trim()}')))`),
            )
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
