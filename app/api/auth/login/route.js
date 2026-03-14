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
