import { NextResponse } from 'next/server';
import { User, ApiKey, sequelize } from '@/lib/models/index.js';
import { Op } from 'sequelize';

export async function POST(request) {
    try {
        const { token } = await request.json();

        if (!token) {
            return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 });
        }

        const user = await User.findOne({
            where: {
                deletionToken: token,
                deletionExpires: {
                    [Op.gt]: new Date()
                }
            }
        });

        if (!user) {
            return NextResponse.json({ 
                success: false, 
                error: 'Invalid or expired deletion token' 
            }, { status: 400 });
        }

        // Perform deletion logic within a transaction
        await sequelize.transaction(async (t) => {
            // 1. Mark user as deleted
            user.isDeleted = 1;
            user.deletionToken = null;
            user.deletionExpires = null;
            await user.save({ transaction: t });

            // 2. Revoke API Keys
            await ApiKey.update(
                { isActive: 0, isDeleted: 1 },
                { 
                    where: { userId: user.id },
                    transaction: t 
                }
            );
        });

        const response = NextResponse.json({ 
            success: true, 
            message: 'Your account has been successfully deleted and all API access has been revoked.' 
        });

        // Clear the auth cookie
        response.cookies.set('auth_token', '', { expires: new Date(0), path: '/' });

        return response;

    } catch (error) {
        console.error('Confirm deletion error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
