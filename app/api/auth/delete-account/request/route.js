import { NextResponse } from 'next/server';
import { User } from '@/lib/models/index.js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email';

export async function POST(request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const user = await User.findByPk(decoded.id || decoded.ID);
        if (!user) {
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
        }

        if (user.isDemo === 'Y' || user.isDemo === true) {
            return NextResponse.json({ success: false, error: 'Demo users cannot delete their account' }, { status: 403 });
        }

        const deletionToken = crypto.randomBytes(32).toString('hex');
        const expires = new Date();
        expires.setHours(expires.getHours() + 1); // 1 hour to verify

        user.deletionToken = deletionToken;
        user.deletionExpires = expires;
        await user.save();

        const deletionUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/delete-account/confirm?token=${deletionToken}`;

        try {
            await sendEmail({
                to: user.email,
                subject: 'Confirm TravelAccess Account Deletion',
                text: `You have requested to delete your TravelAccess account. To confirm this action, please click the following link: ${deletionUrl}. This link will expire in 1 hour. If you did not request this, please ignore this email.`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fee2e2; border-radius: 12px; overflow: hidden;">
                        <div style="background-color: #ef4444; padding: 20px; text-align: center;">
                            <h2 style="color: white; margin: 0;">Account Deletion Request</h2>
                        </div>
                        <div style="padding: 30px; color: #374151; line-height: 1.6;">
                            <p>Hello <strong>${user.username}</strong>,</p>
                            <p>We received a request to delete your TravelAccess account. This action is irreversible and will mark your account as deleted and revoke all API access.</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${deletionUrl}" style="display: inline-block; padding: 14px 28px; background-color: #ef4444; color: white; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);">Confirm Deletion</a>
                            </div>
                            <p style="font-size: 14px; color: #6b7280;">This link will expire in 1 hour.</p>
                            <p style="font-size: 14px; color: #6b7280; font-style: italic;">If you didn't request this, you can safely ignore this email. Your account will remain secure.</p>
                            <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 20px 0;" />
                            <p style="color: #9ca3af; font-size: 12px; text-align: center;">Precision Travel & Expense Tracking</p>
                        </div>
                    </div>
                `,
            });
        } catch (emailError) {
            console.error('[GMAIL] Deletion email failed:', emailError);
            return NextResponse.json({ 
                success: false, 
                error: 'Failed to send confirmation email. Please try again later.' 
            }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            message: 'A confirmation email has been sent to your registered email address.' 
        });

    } catch (error) {
        console.error('Delete account request error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
