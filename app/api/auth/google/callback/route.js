import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { User, sequelize } from '@/lib/models/index.js';
import { generateToken } from '@/lib/auth';
import { Op } from 'sequelize';

const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
);

/**
 * GET /api/auth/google/callback
 * Handles the OAuth callback from Google.
 * Exchanges the code for tokens, verifies the ID token, 
 * links/creates the user account, and sets a secure JWT cookie.
 */
export async function GET(request) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/auth/google/callback`;

    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error');

        if (errorParam) {
            return NextResponse.redirect(`${baseUrl}/login?error=google_denied`);
        }

        if (!code) {
            return NextResponse.redirect(`${baseUrl}/login?error=google_no_code`);
        }

        // 1. Exchange authorization code for tokens
        const { tokens } = await client.getToken({ code, redirect_uri: redirectUri });
        const idToken = tokens.id_token;

        if (!idToken) {
            return NextResponse.redirect(`${baseUrl}/login?error=google_no_token`);
        }

        // 2. Verify the ID token and extract user info
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, picture } = payload;

        if (!email) {
            return NextResponse.redirect(`${baseUrl}/login?error=google_no_email`);
        }

        let user = null;

        // 3a. Try to find user by Google ID (existing Google Users)
        user = await User.findOne({ where: { googleId } });

        if (!user) {
            // 3b. Try by email to link an existing local account
            user = await User.findOne({
                where: { email }
            });

            if (user) {
                // Link Google account to existing user
                user.googleId = googleId;
                user.googleAvatarUrl = picture || null;
                await user.save();
            }
        }

        if (!user) {
            // 3c. Create new user account if neither ID nor email matched
            const baseUsername = (email.split('@')[0] || 'user')
                .replace(/[^a-zA-Z0-9_]/g, '')
                .substring(0, 48) || 'user';

            let username = baseUsername;
            let suffix = 1;

            // Ensure username uniqueness
            while (true) {
                const existing = await User.findOne({ where: { username }, attributes: ['id'] });
                if (!existing) break;
                username = `${baseUsername}${suffix++}`;
            }

            user = await User.create({
                username,
                email,
                googleId,
                googleAvatarUrl: picture || null,
                isAdmin: 0
            });
            
            if (!user.id) throw new Error('Failed to create new user in database');
        }

        if (!user) {
            return NextResponse.redirect(`${baseUrl}/login?error=google_db_error`);
        }

        // Generate JWT expected token shape (falling back to legacy column names used inside sign)
        const tokenPayload = {
            ID: user.id,
            USERNAME: user.username,
            IS_ADMIN: user.isAdmin,
            IS_DEMO: user.isDemo,
            id: user.id
        };

        // 4. Generate JWT and set the authentication cookie
        const token = generateToken(tokenPayload);

        const response = NextResponse.redirect(`${baseUrl}/`);
        response.cookies.set('auth_token', token, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 604800, // 7 days
        });

        return response;
    } catch (error) {
        console.error('Google OAuth Error:', error.message);
        return NextResponse.redirect(`${baseUrl}/login?error=google_server_error`);
    }
}
