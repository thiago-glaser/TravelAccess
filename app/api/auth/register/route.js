import { hashPassword } from '@/lib/auth';
import { query, oracledb } from '@/lib/db';

export async function POST(request) {
    try {
        const { username, password, email } = await request.json();

        if (!username || !password) {
            return Response.json({ success: false, error: 'Username and password are required' }, { status: 400 });
        }

        const hashedPassword = await hashPassword(password);

        try {
            const sql = `
                INSERT INTO USERS(USERNAME, PASSWORD_HASH, EMAIL)
VALUES(: username, : password_hash, : email)
                RETURNING ID INTO: id
    `;

            const result = await query(sql, {
                username,
                password_hash: hashedPassword,
                email: email || null,
                id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            });

            return Response.json({ success: true, message: 'User registered successfully' });
        } catch (e) {
            if (e.errorNum === 1) { // Unique constraint violation
                return Response.json({ success: false, error: 'Username already exists' }, { status: 409 });
            }
            throw e;
        }
    } catch (error) {
        console.error('Registration error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
