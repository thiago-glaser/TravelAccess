import { query } from '@/lib/db';

/**
 * Internal endpoint called by the Next.js middleware to record a page/API hit.
 * Uses the UPSERT_PAGE_USAGE Oracle stored proc for atomic, lock-safe incrementing.
 *
 * POST /api/internal/track-usage
 * Body: { path: string }
 *
 * Only accepts requests that originate from the same host (via a shared secret
 * header set in middleware.js) so it cannot be abused externally.
 */

const INTERNAL_SECRET = process.env.INTERNAL_TRACK_SECRET || 'travel-access-internal';

export async function POST(request) {
    // Guard: only allow calls that carry the shared secret
    const secret = request.headers.get('x-internal-secret');
    if (secret !== INTERNAL_SECRET) {
        return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { path } = await request.json();
        if (!path) {
            console.error('[track-usage] Missing path in body');
            return Response.json({ success: false, error: 'Missing path' }, { status: 400 });
        }

        console.log(`[track-usage] Recording hit for: ${path}`);
        await query(
            `BEGIN UPSERT_PAGE_USAGE(:path); END;`,
            { path: path.substring(0, 500) }
        );

        return Response.json({ success: true });
    } catch (error) {
        // Never fail the caller — just log and swallow
        console.error('[track-usage] Failed to record hit:', error.message);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
