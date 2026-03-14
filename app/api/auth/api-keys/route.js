import { getSession, generateApiKey } from '@/lib/auth';
import { ApiKey, sequelize } from '@/lib/models/index.js';
import { Op } from 'sequelize';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.id || session.ID || session.USER_ID;
        
        const apiKeysData = await ApiKey.findAll({
            where: {
                userId: userId,
                isDeleted: { [Op.or]: [0, null] }
            },
            attributes: ['id', 'description', 'isActive', 'createdAt', 'lastUsed']
        });

        const apiKeys = apiKeysData.map(k => {
            const raw = k.get({ plain: true });
            return {
                ID: (raw.id || '').trim(),
                DESCRIPTION: raw.description,
                IS_ACTIVE: raw.isActive,
                CREATED_AT: raw.createdAt,
                LAST_USED: raw.lastUsed
            };
        });

        return Response.json({ success: true, apiKeys });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.isDemo === 'Y' || session.isDemo === true) {
        return Response.json({ success: false, error: 'Demo users cannot run write operations on API keys' }, { status: 403 });
    }

    try {
        const { description } = await request.json();
        const apiKey = generateApiKey();
        const userId = session.id || session.ID || session.USER_ID;

        await ApiKey.create({
            userId: userId,
            keyValue: apiKey,
            description: description || 'Default API Key'
        });

        return Response.json({ success: true, apiKey });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.isDemo === 'Y' || session.isDemo === true) {
        return Response.json({ success: false, error: 'Demo users cannot run write operations on API keys' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return Response.json({ success: false, error: 'Key ID is required' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;

        await ApiKey.update(
            { isDeleted: 1, updatedAt: new Date() },
            {
                where: sequelize.and(
                    { id: id.trim() },
                    { userId: userId.trim() }
                )
            }
        );

        return Response.json({ success: true, message: 'API key revoked successfully' });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
