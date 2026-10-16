import { query } from '@/lib/db';
import { generateSessionSummary } from '@/lib/gemini';

/**
 * Background job that runs every 5 minutes:
 * Always fetches the newest ended session (only one) without an AI description yet,
 * and generates the AI description for that session.
 */
export async function runGenerateSessionAiDescriptionJob() {
    try {
        console.log('[AI Description Job] Checking for newest completed session without description...');

        // Query the newest ended session that does not have an AI description yet
        const sql = `
            SELECT s.ID, s.START_UTC, s.END_UTC, s.DEVICE_ID
            FROM SESSION_DATA s
            LEFT JOIN SESSION_AI_DESCRIPTION d 
              ON TRIM(s.ID) = TRIM(d.SESSION_DATA_ID) AND (d.IS_DELETED = 0 OR d.IS_DELETED IS NULL)
            WHERE s.END_UTC IS NOT NULL
              AND (s.IS_DELETED = 0 OR s.IS_DELETED IS NULL)
              AND d.SESSION_DATA_ID IS NULL
            ORDER BY s.END_UTC DESC
            LIMIT 1
        `;

        const res = await query(sql);
        const rows = res.rows || [];

        if (rows.length === 0) {
            console.log('[AI Description Job] No ended sessions pending AI description.');
            return { status: 'idle', message: 'No sessions pending description.' };
        }

        const session = rows[0];
        const sessionId = session.ID || session.id;

        console.log(`[AI Description Job] Found session ${sessionId} (ended ${session.END_UTC}). Generating AI description...`);

        const result = await generateSessionSummary(sessionId);

        if (result && result.description) {
            console.log(`[AI Description Job] Successfully generated description for session ${sessionId} (${result.description.length} chars).`);
            return {
                status: 'success',
                sessionId,
                descriptionLength: result.description.length
            };
        } else {
            console.warn(`[AI Description Job] Summary generation returned empty result for session ${sessionId}.`);
            return {
                status: 'warning',
                sessionId,
                message: 'No description generated.'
            };
        }
    } catch (err) {
        console.error('[AI Description Job] Error generating session AI description:', err);
        throw err;
    }
}
