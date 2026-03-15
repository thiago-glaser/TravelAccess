import { runMergeLocationGeocodesJob } from '@/lib/jobs/mergeLocationGeocodes';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    const session = await getSession(request);
    
    if (!session || !session.isAdmin) {
        return Response.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await runMergeLocationGeocodesJob();
        return Response.json({ status: 'success', ...result }, { status: 200 });
    } catch (err) {
        console.error('Error in merge-location-geocodes API:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
