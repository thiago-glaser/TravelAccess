import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { User, sequelize } from '@/lib/models/index.js';

export async function GET(request) {
    try {
        const session = await getSession(request);

        if (!session || !session.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const user = await User.findOne({
            attributes: ['username', 'email', 'googleAvatarUrl'],
            where: sequelize.where(sequelize.fn('TRIM', sequelize.col('ID')), session.id.trim())
        });

        if (!user) {
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            user: {
                username: user.username,
                email: user.email,
                googleAvatarUrl: user.googleAvatarUrl
            }
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
