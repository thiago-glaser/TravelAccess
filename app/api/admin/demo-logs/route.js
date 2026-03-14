import { getSession } from '@/lib/auth';
import { DemoAccessLog } from '@/lib/models/index.js';

export async function GET(request) {
    const session = await getSession(request);
    if (!session || session.isAdmin !== 1) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const logs = await DemoAccessLog.findAll({
            order: [['accessTime', 'DESC']],
            limit: 100
        });

        return Response.json({ success: true, logs });
    } catch (error) {
        console.error('Error fetching demo access logs:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
