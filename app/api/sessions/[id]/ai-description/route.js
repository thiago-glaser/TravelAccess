import { getSession } from '@/lib/auth';
import { SessionAiDescription } from '@/lib/models';
import { generateSessionSummary } from '@/lib/gemini';

export async function GET(request, { params }) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        if (!id) {
            return Response.json({ success: false, error: 'Session ID is required' }, { status: 400 });
        }

        const record = await SessionAiDescription.findOne({
            where: { sessionDataId: id, isDeleted: 0 },
            raw: true
        });

        return Response.json({
            success: true,
            sessionId: id,
            description: record?.description || null,
            createdAt: record?.createdAt || null,
            updatedAt: record?.updatedAt || null
        });
    } catch (error) {
        console.error('Error fetching AI description:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request, { params }) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        if (!id) {
            return Response.json({ success: false, error: 'Session ID is required' }, { status: 400 });
        }

        const url = new URL(request.url);
        let tz = url.searchParams.get('tz');
        if (!tz) {
            try {
                const body = await request.json();
                tz = body?.tz;
            } catch {
                // Ignore empty or non-JSON body
            }
        }

        const result = await generateSessionSummary(id, { tz });

        if (!result) {
            return Response.json({ success: false, error: 'Failed to generate session summary' }, { status: 400 });
        }

        return Response.json({
            success: true,
            sessionId: id,
            description: result.description
        });
    } catch (error) {
        console.error('Error generating AI description:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
