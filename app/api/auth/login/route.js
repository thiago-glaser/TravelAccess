import { verifyPassword, generateToken } from '@/lib/auth';
import { User } from '@/lib/models/index.js';

export async function POST(request) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return Response.json({ success: false, error: 'Username and password are required' }, { status: 400 });
        }

        const user = await User.findOne({ where: { username } });

        if (!user) {
            return Response.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
        }

        const isValid = await verifyPassword(password, user.passwordHash);

        if (!isValid) {
            return Response.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
        }

        // Check if email is verified (skip for demo users)
        const isDemo = user.isDemo === 'Y' || user.isDemo === true;
        if (!isDemo && user.isVerified !== 1) {
            return Response.json({ 
                success: false, 
                error: 'Please verify your email address before logging in. Check your inbox for the verification link.' 
            }, { status: 403 });
        }

        // generateToken expects an object with specific keys from the old query (ID, USERNAME)
        const tokenTokenPayload = {
            ID: user.id,
            USERNAME: user.username,
            IS_ADMIN: user.isAdmin,
            IS_DEMO: user.isDemo,
            // Fallbacks for the rest if generating generic session objects
            id: user.id
        };

        const token = generateToken(tokenTokenPayload);

        // Log demo access if it's the demo user
        if (user.isDemo === 'Y' || user.isDemo === true) {
            try {
                const { DemoAccessLog } = await import('@/lib/models/index.js');

                // Ensure table exists (quick check/init)
                await DemoAccessLog.sync();

                const ip = request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown';
                const ua = request.headers.get('user-agent') || 'unknown';
                const referer = request.headers.get('referer') || '';

                await DemoAccessLog.create({
                    ipAddress: ip.split(',')[0].trim(),
                    userAgent: ua,
                    referer: referer
                });
                console.log(`[Demo Access] Logged connection from ${ip}`);
            } catch (logError) {
                console.error('Failed to log demo access:', logError);
                // Don't block login if logging fails
            }
        }

        // Set cookie for browser sessions
        const response = Response.json({
            success: true,
            message: 'Login successful',
            token,
            user: { id: user.id, username: user.username }
        });

        response.headers.set('Set-Cookie', `auth_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
