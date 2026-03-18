import { NextResponse } from 'next/server';
import { User } from '@/lib/models/index.js';
import { sendEmail } from '@/lib/email';

export async function POST(req) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        console.log(`[Forgot Username] Request received for: ${email}`);
        const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });

        // Security: Always return success to avoid leaking existence of emails
        if (!user) {
            console.log(`[Forgot Username] No user found for ${email}`);
            return NextResponse.json({ success: true });
        }

        try {
            await sendEmail({
                to: email,
                subject: 'Your TravelAccess Username',
                text: `You requested a username reminder. Your username is: ${user.username}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #4f46e5;">TravelAccess</h2>
                        <p>Hello,</p>
                        <p>We received a request to remind you of your username for your TravelAccess account.</p>
                        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                            <p style="margin: 0; color: #6b7280; font-size: 14px;">Your Username:</p>
                            <h3 style="margin: 5px 0 0 0; color: #1f2937; font-size: 24px;">${user.username}</h3>
                        </div>
                        <p style="color: #6b7280; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
                        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                        <p style="color: #9ca3af; font-size: 12px;">Precision Travel & Expense Tracking</p>
                    </div>
                `,
            });
        } catch (emailError) {
            console.error('[GMAIL] Email send failed for username reminder:', emailError);
            // We still return success to the user
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Forgot username error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
