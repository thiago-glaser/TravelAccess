import { User, sequelize } from '@/lib/models/index.js';
import { hashPassword } from '@/lib/auth';

export async function GET(request) {
    try {
        // 1. Try to add the column if it doesn't exist
        try {
            await sequelize.query(`
                ALTER TABLE USERS 
                ADD IS_DEMO CHAR(1) DEFAULT 'N'
            `);
            console.log('Added IS_DEMO column');
        } catch (colErr) {
            // Likely already exists (ORA-01430: column being added already exists in table)
            if (!colErr.message.includes('ORA-01430') && !colErr.message.includes('exists')) {
                console.error('Column creation error:', colErr);
            }
        }


        // 3. Create Demo user
        let demoUser = await User.findOne({ where: { username: 'demo' } });

        if (!demoUser) {
            const passwordHash = await hashPassword('demo123');
            demoUser = await User.create({
                username: 'demo',
                email: 'demo@travelaccess.ddns.net',
                passwordHash: passwordHash,
                isDemo: 'Y'
            });
            return Response.json({ success: true, message: 'Demo user created successfully (demo / demo123).', user: demoUser });
        } else {
            // Make sure the existing demo user has the flag
            if (demoUser.isDemo !== 'Y') {
                demoUser.isDemo = 'Y';
                await demoUser.save();
                return Response.json({ success: true, message: 'Demo user already existed. Updated IS_DEMO flag to Y.', user: demoUser });
            }
            return Response.json({ success: true, message: 'Demo user already exists and is configured.', user: demoUser });
        }
    } catch (error) {
        console.error('Demo setup error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
