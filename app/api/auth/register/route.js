import { hashPassword } from '@/lib/auth';
import { User } from '@/lib/models/index.js';

import crypto from 'crypto';
import { sendEmail } from '@/lib/email';

export async function POST(request) {
    try {
        const { username, password, email } = await request.json();

        if (!username || !password || !email) {
            return Response.json({ success: false, error: 'Username, password, and email are required' }, { status: 400 });
        }

        const hashedPassword = await hashPassword(password);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        try {
            await User.create({
                username,
                passwordHash: hashedPassword,
                email: email.toLowerCase(),
                verificationToken,
                isVerified: 0
            });

            const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify-email/${verificationToken}`;

            try {
                await sendEmail({
                    to: email,
                    subject: 'Verify your TravelAccess Account',
                    text: `Welcome to TravelAccess! Please verify your account by clicking this link: ${verificationUrl}`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #4f46e5;">Welcome to TravelAccess</h2>
                            <p>Thank you for joining! To start using your account, please verify your email address:</p>
                            <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">Verify Email</a>
                            <p style="color: #6b7280; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
                            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                            <p style="color: #9ca3af; font-size: 12px;">Precision Travel & Expense Tracking</p>
                        </div>
                    `,
                });
            } catch (emailError) {
                console.error('[GMAIL] Verification email failed, logging link instead:');
                console.log(`[VERIFY EMAIL] Link for ${email}: ${verificationUrl}`);
            }

            return Response.json({ 
                success: true, 
                message: 'Account created. Please check your email to verify your account.' 
            });
        } catch (e) {
            // Sequelize Unique Constraint Error
            if (e.name === 'SequelizeUniqueConstraintError') {
                return Response.json({ success: false, error: 'Username already exists' }, { status: 409 });
            }
            throw e;
        }
    } catch (error) {
        console.error('Registration error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
