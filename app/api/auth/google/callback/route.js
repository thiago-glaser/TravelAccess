import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { query, oracledb } from '@/lib/db';
import { generateToken } from '@/lib/auth';

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
        const byGoogleId = await query(
            `SELECT * FROM USERS WHERE GOOGLE_ID = :googleId`,
            { googleId }
        );

        if (byGoogleId.rows && byGoogleId.rows.length > 0) {
            user = byGoogleId.rows[0];
        }

        if (!user) {
            // 3b. Try by email to link an existing local account
            const byEmail = await query(
                `SELECT * FROM USERS WHERE LOWER(EMAIL) = LOWER(:email)`,
                { email }
            );

            if (byEmail.rows && byEmail.rows.length > 0) {
                user = byEmail.rows[0];
                // Link Google account to existing user
                await query(
                    `UPDATE USERS SET GOOGLE_ID = :googleId, GOOGLE_AVATAR_URL = :avatar WHERE ID = :id`,
                    { googleId, avatar: picture || null, id: user.ID }
                );
                // Refresh data
                const refreshed = await query(`SELECT * FROM USERS WHERE ID = :id`, { id: user.ID });
                user = refreshed.rows[0];
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
                const existing = await query(
                    `SELECT ID FROM USERS WHERE USERNAME = :username`,
                    { username }
                );
                if (!existing.rows || existing.rows.length === 0) break;
                username = `${baseUsername}${suffix++}`;
            }

            const insertSql = `
                INSERT INTO USERS (USERNAME, PASSWORD_HASH, EMAIL, GOOGLE_ID, GOOGLE_AVATAR_URL, CREATED_AT, IS_ADMIN)
                VALUES (:username, NULL, :email, :googleId, :avatar, CURRENT_TIMESTAMP, 0)
                RETURNING ID INTO :id
            `;

            const insertResult = await query(insertSql, {
                username,
                email,
                googleId,
                avatar: picture || null,
                id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
            });

            const newId = insertResult.outBinds?.id?.[0];
            if (!newId) throw new Error('Failed to create new user in database');

            const newUser = await query(`SELECT * FROM USERS WHERE ID = :id`, { id: newId });
            user = newUser.rows?.[0];
        }

        if (!user) {
            return NextResponse.redirect(`${baseUrl}/login?error=google_db_error`);
        }

        // 4. Generate JWT and set the authentication cookie
        const token = generateToken(user);

        const response = NextResponse.redirect(`${baseUrl}/`);
        response.cookies.set('auth_token', token, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 86400, // 24 hours
        });

        return response;
    } catch (error) {
        console.error('Google OAuth Error:', error.message);
        return NextResponse.redirect(`${baseUrl}/login?error=google_server_error`);
    }
}
