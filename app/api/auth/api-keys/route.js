import { getSession, generateApiKey } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const sql = `SELECT ID, DESCRIPTION, IS_ACTIVE, CREATED_AT, LAST_USED FROM API_KEYS WHERE USER_ID = :userId`;
        const result = await query(sql, { userId: session.id || session.ID || session.USER_ID });

        return Response.json({ success: true, apiKeys: result.rows });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { description } = await request.json();
        const apiKey = generateApiKey();

        const sql = `
            INSERT INTO API_KEYS (USER_ID, KEY_VALUE, DESCRIPTION)
            VALUES (:userId, :keyValue, :description)
        `;

        await query(sql, {
            userId: session.id || session.ID || session.USER_ID,
            keyValue: apiKey,
            description: description || 'Default API Key'
        });

        return Response.json({ success: true, apiKey });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
