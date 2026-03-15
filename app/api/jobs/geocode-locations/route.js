import { runGeocodeLocationsJob } from '@/lib/jobs/geocodeLocations';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    const session = await getSession(request);
    
    // Check for admin permission (handles both DB keys and .env fallback)
    if (!session || !session.isAdmin) {
        return Response.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await runGeocodeLocationsJob();
        return Response.json({ status: 'success', ...result }, { status: 200 });
    } catch (err) {
        console.error('Error in geocode-locations API:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
