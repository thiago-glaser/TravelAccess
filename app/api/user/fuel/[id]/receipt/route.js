import { getSession } from '@/lib/auth';
import { Fuel, sequelize } from '@/lib/models/index.js';
import { Op } from 'sequelize';

export async function GET(request, { params }) {
    const session = await getSession(request);
    const { id } = await params;

    if (!session) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const userId = session.USER_ID || session.id || session.ID;

        const fuelEntry = await Fuel.findOne({
            attributes: ['receiptImage', 'receiptMime'],
            where: sequelize.and(
                { id: String(id).trim().padEnd(36, " ") },
                { userId: String(userId).trim().padEnd(36, " ") },
                { isDeleted: { [Op.or]: [0, null] } }
            )
        });

        if (!fuelEntry || !fuelEntry.receiptImage) {
            return new Response('No image found', { status: 404 });
        }

        const buffer = fuelEntry.receiptImage;
        const mime = fuelEntry.receiptMime || 'application/octet-stream';

        return new Response(buffer, {
            headers: {
                'Content-Type': mime,
                'Content-Length': buffer.length.toString(),
                'Cache-Control': 'public, max-age=86400',
            }
        });

    } catch (error) {
        console.error('Error fetching receipt:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
