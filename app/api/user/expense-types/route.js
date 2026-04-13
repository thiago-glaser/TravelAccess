import { getSession } from '@/lib/auth';
import { ExpenseType, sequelize } from '@/lib/models/index.js';
import { Op } from 'sequelize';

export async function GET(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.USER_ID || session.id || session.ID;
        
        const types = await ExpenseType.findAll({
            where: {
                userId: userId,
                isDeleted: {
                    [Op.or]: [0, null]
                }
            },
            attributes: ['id', 'name', 'description'],
            order: [['name', 'ASC']]
        });

        const formatted = types.map(t => {
            const raw = t.get({ plain: true });
            return {
                id: (raw.id || '').trim(),
                name: raw.name,
                description: raw.description
            };
        });

        return Response.json({ success: true, types: formatted });
    } catch (error) {
        console.error("GET ExpenseTypes error:", error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.isDemo === 'Y' || session.isDemo === true) {
        return Response.json({ success: false, error: 'Demo users cannot perform write operations' }, { status: 403 });
    }

    try {
        const { name, description } = await request.json();

        if (!name) {
            return Response.json({ success: false, error: 'Name is mandatory' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;

        const newType = await ExpenseType.create({
            userId: userId,
            name: name,
            description: description || ''
        });

        return Response.json({ success: true, message: 'Expense type added successfully' });
    } catch (error) {
        console.error("POST ExpenseType error:", error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    const session = await getSession(request);
    if (!session) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.isDemo === 'Y' || session.isDemo === true) {
        return Response.json({ success: false, error: 'Demo users cannot perform write operations' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return Response.json({ success: false, error: 'ID is required' }, { status: 400 });
        }

        const userId = session.USER_ID || session.id || session.ID;

        await ExpenseType.update(
            { isDeleted: 1, updatedAt: new Date() },
            { 
                where: sequelize.and(
                    { id: String(id).trim() },
                    { userId: String(userId).trim() }
                )
            }
        );

        return Response.json({ success: true, message: 'Expense type removed successfully' });
    } catch (error) {
        console.error("DELETE ExpenseType error:", error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
