import { runGenerateSessionAiDescriptionJob } from '@/lib/jobs/generateSessionAiDescription';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    const isInternal = request.headers.get('x-internal-job') === 'true';

    if (!isInternal) {
        const session = await getSession(request);
        if (!session || !session.isAdmin) {
            return Response.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        const result = await runGenerateSessionAiDescriptionJob();
        return Response.json({ status: 'success', ...result }, { status: 200 });
    } catch (err) {
        console.error('Error in generate-ai-description job API:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
