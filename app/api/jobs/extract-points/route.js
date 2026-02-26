import { runExtractPointsJob } from '@/lib/jobs/extractPoints';

export async function GET(request) {
    try {
        const result = await runExtractPointsJob();
        return Response.json({ status: 'success', ...result }, { status: 200 });
    } catch (err) {
        console.error('Error in extract-points API:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
