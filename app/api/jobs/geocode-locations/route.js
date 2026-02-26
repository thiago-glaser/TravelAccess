import { runGeocodeLocationsJob } from '@/lib/jobs/geocodeLocations';

export async function GET(request) {
    try {
        const result = await runGeocodeLocationsJob();
        return Response.json({ status: 'success', ...result }, { status: 200 });
    } catch (err) {
        console.error('Error in geocode-locations API:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
