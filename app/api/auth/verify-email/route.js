import { NextResponse } from 'next/server';
import { User } from '@/lib/models/index.js';

export async function POST(req) {
    try {
        const { token } = await req.json();
        console.log(`[API] Verifying email for token: ${token}`);

        if (!token) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400 });
        }

        const user = await User.findOne({
            where: {
                verificationToken: token,
                isVerified: 0
            }
        });

        if (!user) {
            console.log(`[API] No unverified user found for token: ${token}`);
            return NextResponse.json({ error: 'Invalid or expired verification token' }, { status: 400 });
        }

        console.log(`[API] Found user ${user.username} for verification.`);

        // Update user to verified and clear the token
        await user.update({
            isVerified: 1,
            verificationToken: null
        });

        return NextResponse.json({ success: true, message: 'Email verified successfully' });
    } catch (error) {
        console.error('Email verification error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
