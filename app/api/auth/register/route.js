import { hashPassword } from '@/lib/auth';
import { User } from '@/lib/models/index.js';

export async function POST(request) {
    try {
        const { username, password, email } = await request.json();

        if (!username || !password) {
            return Response.json({ success: false, error: 'Username and password are required' }, { status: 400 });
        }

        const hashedPassword = await hashPassword(password);

        try {
            await User.create({
                username,
                passwordHash: hashedPassword,
                email: email || null
            });

            return Response.json({ success: true, message: 'User registered successfully' });
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
