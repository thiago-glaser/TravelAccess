import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import oracledb from 'oracledb';

export async function GET(request, { params }) {
    const session = await getSession(request);
    const { id } = await params;

    if (!session) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const userId = session.USER_ID || session.id || session.ID;
        const sql = `
            SELECT RECEIPT_IMAGE, RECEIPT_MIME 
            FROM MAINTENANCE 
            WHERE TRIM(ID) = TRIM(:id) AND TRIM(USER_ID) = TRIM(:userId) AND (IS_DELETED = 0 OR IS_DELETED IS NULL)
        `;

        const opts = {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
            fetchInfo: { "RECEIPT_IMAGE": { type: oracledb.BUFFER } }
        };

        const result = await query(sql, { id, userId }, opts);

        if (result.rows.length === 0) {
            return new Response('Not found', { status: 404 });
        }

        const row = result.rows[0];
        if (!row.RECEIPT_IMAGE) {
            return new Response('No image found', { status: 404 });
        }

        const buffer = row.RECEIPT_IMAGE;
        const mime = row.RECEIPT_MIME || 'application/octet-stream';

        return new Response(buffer, {
            headers: {
                'Content-Type': mime,
                'Content-Length': buffer.length.toString(),
                'Cache-Control': 'public, max-age=86400',
            }
        });

    } catch (error) {
        console.error('Error fetching receipt:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
