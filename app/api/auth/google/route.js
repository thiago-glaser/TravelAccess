import { NextResponse } from 'next/server';

/**
 * GET /api/auth/google
 * Redirects the user to Google's OAuth consent screen.
 */
export async function GET(request) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`;

    if (!clientId) {
        return NextResponse.json({ error: 'Google OAuth is not configured' }, { status: 500 });
    }

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account',
    });

    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
