import { NextResponse } from 'next/server';
import { User } from '@/lib/models/index.js';
import crypto from 'crypto';
import { Op } from 'sequelize';

export async function POST(req) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const user = await User.findOne({ where: { email: email.toLowerCase() } });

        if (!user) {
            // We return success even if user not found for security reasons
            return NextResponse.json({ success: true });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now

        await user.update({
            resetPasswordToken: resetToken,
            resetPasswordExpires: resetExpires
        });

        const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

        // In a real application, you would send an email here.
        // For this demonstration, we'll log it to the console.
        console.log(`[PASSWORD RESET] Link for ${email}: ${resetUrl}`);
        
        // If there's a need to mock email sending functionality, we could do it here.

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Forgot password error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
