import { NextResponse } from 'next/server';
import { getSession, hashPassword, verifyPassword } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(request) {
    try {
        const session = await getSession(request);

        if (!session || !session.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { currentPassword, newPassword } = await request.json();

        if (!newPassword || newPassword.length < 6) {
            return NextResponse.json({ success: false, error: 'New password must be at least 6 characters' }, { status: 400 });
        }

        // Fetch user to check current password if it exists (for non-Google users that have a password logic)
        // If a user has no password (e.g., registered via Google), we might skip currentPassword check or require it
        const userSql = `SELECT PASSWORD_HASH FROM USERS WHERE ID = :id`;
        const userResult = await query(userSql, { id: session.id });

        if (!userResult.rows || userResult.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
        }

        const user = userResult.rows[0];

        // If the user has a password set, require them to enter the current one
        if (user.PASSWORD_HASH) {
            if (!currentPassword) {
                return NextResponse.json({ success: false, error: 'Current password is required' }, { status: 400 });
            }
            const isValid = await verifyPassword(currentPassword, user.PASSWORD_HASH);
            if (!isValid) {
                return NextResponse.json({ success: false, error: 'Incorrect current password' }, { status: 401 });
            }
        }

        // Apply new password
        const newHash = await hashPassword(newPassword);
        const updateSql = `UPDATE USERS SET PASSWORD_HASH = :hash WHERE ID = :id`;
        await query(updateSql, { hash: newHash, id: session.id });

        return NextResponse.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
