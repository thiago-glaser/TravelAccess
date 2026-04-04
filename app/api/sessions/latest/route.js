import { getSession } from '@/lib/auth';
import { SessionView, SessionData, Device, sequelize } from '@/lib/models/index.js';
import { Op } from 'sequelize';

// Returns the single most recent session for the authenticated user, ignoring all filters.
// Used by the timer widget on the main page so it always reflects the true last/active session.
export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.USER_ID || session.id || session.ID;

        // Using findOne with an eager-loaded Device and SessionData to filter by isDeleted
        const latestSession = await SessionView.findOne({
            include: [
                {
                    model: Device,
                    as: 'deviceInfo',
                    attributes: ['description']
                },
                {
                    model: SessionData,
                    as: 'sessionData',
                    attributes: [],
                    where: { isDeleted: 0 },
                    required: true
                }
            ],
            where: sequelize.where(
                sequelize.literal(`"SessionView"."DEVICE_ID" IN (SELECT "DEVICE_ID" FROM "USER_DEVICES" WHERE RTRIM(LTRIM("USER_ID")) = RTRIM(LTRIM('${userId.trim()}')))`),
                true
            ),
            order: [['startUtc', 'DESC']]
        });

        if (!latestSession) {
            return Response.json({ success: true, session: null });
        }

        // The View already contains everything we need. If car_description is null, use the Device description.
        const description = latestSession.carDescription || (latestSession.deviceInfo ? latestSession.deviceInfo.description : null);

        return Response.json({
            success: true,
            session: {
                id: latestSession.id.trim(),
                deviceId: latestSession.deviceId.trim(),
                description: description,
                // Match exact formatting used previously by TO_CHAR queries: YYYY-MM-DD"T"HH24:MI:SS"Z"
                startTime: latestSession.startUtc ? latestSession.startUtc.toISOString().replace(/\.\d{3}Z$/, 'Z') : null,
                endTime: latestSession.endUtc ? latestSession.endUtc.toISOString().replace(/\.\d{3}Z$/, 'Z') : null,
            }
        });
    } catch (error) {
        console.error('Error in /api/sessions/latest:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
