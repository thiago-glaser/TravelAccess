import { getSession, generateApiKey } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const sql = `SELECT TRIM(ID) AS ID, DESCRIPTION, IS_ACTIVE, CREATED_AT, LAST_USED FROM API_KEYS WHERE TRIM(USER_ID) = TRIM(:userId) AND (IS_DELETED = 0 OR IS_DELETED IS NULL)`;
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

export async function DELETE(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return Response.json({ success: false, error: 'Key ID is required' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;
        const sql = `UPDATE API_KEYS SET IS_DELETED = 1, UPDATED_AT = SYS_EXTRACT_UTC(SYSTIMESTAMP) WHERE TRIM(ID) = TRIM(:id) AND TRIM(USER_ID) = TRIM(:userId)`;
        await query(sql, { id, userId });

        return Response.json({ success: true, message: 'API key revoked successfully' });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
