import { verifyPassword, generateToken } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(request) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return Response.json({ success: false, error: 'Username and password are required' }, { status: 400 });
        }

        const sql = `SELECT * FROM USERS WHERE USERNAME = :username`;
        const result = await query(sql, { username });

        if (!result.rows || result.rows.length === 0) {
            return Response.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
        }

        const user = result.rows[0];
        const isValid = await verifyPassword(password, user.PASSWORD_HASH);

        if (!isValid) {
            return Response.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
        }

        const token = generateToken(user);

        // Set cookie for browser sessions
        const response = Response.json({
            success: true,
            message: 'Login successful',
            token,
            user: { id: user.ID, username: user.USERNAME }
        });

        response.headers.set('Set-Cookie', `auth_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
