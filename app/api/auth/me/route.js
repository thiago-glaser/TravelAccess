import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request) {
    try {
        const session = await getSession(request);

        if (!session || !session.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const sql = `SELECT USERNAME, EMAIL, GOOGLE_AVATAR_URL FROM USERS WHERE ID = :id`;
        const result = await query(sql, { id: session.id });

        if (!result.rows || result.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
        }

        const user = result.rows[0];

        return NextResponse.json({
            success: true,
            user: {
                username: user.USERNAME,
                email: user.EMAIL,
                googleAvatarUrl: user.GOOGLE_AVATAR_URL
            }
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
