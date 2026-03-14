import { NextResponse } from 'next/server';
import { getSession, hashPassword, verifyPassword } from '@/lib/auth';
import { User, sequelize } from '@/lib/models/index.js';

export async function POST(request) {
    try {
        const session = await getSession(request);

        if (!session || !session.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        if (session.isDemo === 'Y' || session.isDemo === true) {
            return NextResponse.json({ success: false, error: 'Demo users cannot change password' }, { status: 403 });
        }

        const { currentPassword, newPassword } = await request.json();

        if (!newPassword || newPassword.length < 6) {
            return NextResponse.json({ success: false, error: 'New password must be at least 6 characters' }, { status: 400 });
        }

        // Fetch user to check current password if it exists
        const user = await User.findOne({
            where: { id: session.id.trim() }
        });

        if (!user) {
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
        }

        // If the user has a password set, require them to enter the current one
        if (user.passwordHash) {
            if (!currentPassword) {
                return NextResponse.json({ success: false, error: 'Current password is required' }, { status: 400 });
            }
            const isValid = await verifyPassword(currentPassword, user.passwordHash);
            if (!isValid) {
                return NextResponse.json({ success: false, error: 'Incorrect current password' }, { status: 401 });
            }
        }

        // Apply new password
        user.passwordHash = await hashPassword(newPassword);
        await user.save();

        return NextResponse.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
