import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

/**
 * GET /api/admin/usage-stats?year=2026&month=3
 *
 * Returns monthly page/API hit counts.
 *  - If year+month are provided, returns all paths for that specific month.
 *  - If only year is provided, returns totals grouped by month for that year.
 *  - If no params, returns the last 12 months of data (all paths, summed per month).
 *
 * Also returns a list of distinct (year, month) pairs available in the DB so the
 * UI can populate a month picker.
 */
export async function GET(request) {
    const session = await getSession(request);
    if (!session || session.isAdmin !== 1) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const year  = searchParams.get('year')  ? parseInt(searchParams.get('year'),  10) : null;
        const month = searchParams.get('month') ? parseInt(searchParams.get('month'), 10) : null;

        // --- Available months (for picker) ---
        const monthsResult = await query(`
            SELECT YEAR_NUM, MONTH_NUM, SUM(HIT_COUNT) AS TOTAL_HITS
            FROM PAGE_USAGE_MONTHLY
            GROUP BY YEAR_NUM, MONTH_NUM
            ORDER BY YEAR_NUM DESC, MONTH_NUM DESC
        `);
        const availableMonths = monthsResult.rows || [];

        // --- Usage data ---
        let usageRows;

        if (year && month) {
            // Specific month: all paths sorted by hits desc
            const result = await query(`
                SELECT PATH, HIT_COUNT
                FROM PAGE_USAGE_MONTHLY
                WHERE YEAR_NUM  = :year
                  AND MONTH_NUM = :month
                ORDER BY HIT_COUNT DESC
            `, { year, month });
            usageRows = result.rows || [];
        } else if (year) {
            // Full year: group by month
            const result = await query(`
                SELECT MONTH_NUM, SUM(HIT_COUNT) AS TOTAL_HITS
                FROM PAGE_USAGE_MONTHLY
                WHERE YEAR_NUM = :year
                GROUP BY MONTH_NUM
                ORDER BY MONTH_NUM ASC
            `, { year });
            usageRows = result.rows || [];
        } else {
            // Default: last 12 months, all paths
            const result = await query(`
                SELECT PATH, YEAR_NUM, MONTH_NUM, HIT_COUNT
                FROM PAGE_USAGE_MONTHLY
                WHERE (YEAR_NUM * 100 + MONTH_NUM) >=
                      (EXTRACT(YEAR FROM ADD_MONTHS(SYS_EXTRACT_UTC(SYSTIMESTAMP), -11)) * 100 +
                       EXTRACT(MONTH FROM ADD_MONTHS(SYS_EXTRACT_UTC(SYSTIMESTAMP), -11)))
                ORDER BY YEAR_NUM DESC, MONTH_NUM DESC, HIT_COUNT DESC
            `);
            usageRows = result.rows || [];
        }

        return Response.json({
            success: true,
            availableMonths,
            usage: usageRows,
            query: { year, month }
        });
    } catch (error) {
        console.error('[usage-stats] Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
