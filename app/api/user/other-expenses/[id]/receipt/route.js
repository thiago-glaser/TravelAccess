import { getSession } from '@/lib/auth';
import { OtherExpense, sequelize } from '@/lib/models/index.js';

export async function GET(request, { params }) {
    const session = await getSession(request);
    if (!session) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const userId = session.USER_ID || session.id || session.ID;
        const id = params.id;

        const expense = await OtherExpense.findOne({
            where: sequelize.and(
                { id: String(id).trim() },
                { userId: String(userId).trim() }
            ),
            attributes: ['receiptImage', 'receiptMime']
        });

        if (!expense || !expense.receiptImage) {
            return new Response('Receipt not found', { status: 404 });
        }

        return new Response(expense.receiptImage, {
            status: 200,
            headers: {
                'Content-Type': expense.receiptMime || 'application/octet-stream',
                'Cache-Control': 'public, max-age=31536000'
            }
        });
    } catch (error) {
        console.error("GET Expense Receipt error:", error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
