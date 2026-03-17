import { NextResponse } from 'next/server';
import { User } from '@/lib/models/index.js';
import crypto from 'crypto';
import { Op } from 'sequelize';

import { sendEmail } from '@/lib/email';

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

        try {
            await sendEmail({
                to: email,
                subject: 'Reset your TravelAccess Password',
                text: `You requested a password reset. Click the following link to set a new password: ${resetUrl}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #4f46e5;">TravelAccess</h2>
                        <p>We received a request to reset your password. Click the button below to secure your account:</p>
                        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">Reset Password</a>
                        <p style="color: #6b7280; font-size: 14px;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
                        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                        <p style="color: #9ca3af; font-size: 12px;">Precision Travel & Expense Tracking</p>
                    </div>
                `,
            });
        } catch (emailError) {
            console.error('[GMAIL] Deployment failed, logging to console instead:');
            console.log(`[PASSWORD RESET] Link for ${email}: ${resetUrl}`);
            // We don't fail the whole request if email fails, but you should check the logs
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Forgot password error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
