import { NextResponse } from 'next/server';
import { User } from '@/lib/models/index.js';
import { hashPassword } from '@/lib/auth';
import { Op } from 'sequelize';

export async function POST(req) {
    try {
        const { token, password } = await req.json();

        if (!token || !password) {
            return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
        }

        const user = await User.findOne({
            where: {
                resetPasswordToken: token,
                resetPasswordExpires: {
                    [Op.gt]: new Date()
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'Invalid or expired password reset token' }, { status: 400 });
        }

        // Hash new password
        const passwordHash = await hashPassword(password);

        // Update user and clear reset token fields
        await user.update({
            passwordHash: passwordHash,
            resetPasswordToken: null,
            resetPasswordExpires: null
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
