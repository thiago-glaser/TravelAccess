import { runMergeLocationGeocodesJob } from '@/lib/jobs/mergeLocationGeocodes';

export async function GET(request) {
    try {
        const result = await runMergeLocationGeocodesJob();
        return Response.json({ status: 'success', ...result }, { status: 200 });
    } catch (err) {
        console.error('Error in merge-location-geocodes API:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
