import {
    User,
    Car,
    Device,
    UserDevice,
    SessionData,
    LocationData,
    Fuel,
    Maintenance,
    Insurance,
    sequelize
} from '@/lib/models/index.js';
import { hashPassword, getSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
    const session = await getSession(request);
    
    // getSession now handles both DB API keys and the .env fallback
    if (!session || !session.isAdmin) {
        return Response.json({ success: false, error: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    const clean = searchParams.get('clean') === 'true';

    try {
        // 2. Create/Update Demo user
        let demoUser = await User.findOne({ where: { username: 'demo' } });
        let userCreated = false;

        if (!demoUser) {
            const passwordHash = await hashPassword('demo123');
            demoUser = await User.create({
                username: 'demo',
                email: 'demo@travelaccess.ddns.net',
                passwordHash: passwordHash,
                isDemo: 'Y'
            });
            userCreated = true;
        } else if (demoUser.isDemo !== 'Y') {
            demoUser.isDemo = 'Y';
            await demoUser.save();
        }

        const userId = demoUser.id;
        const deviceId = 'DEMO-GPS-01';

        // 3. Clean or Recreate
        if (clean || force) {
            console.log('Cleaning demo data for user:', userId);
            const { DemoAccessLog } = await import('@/lib/models/index.js');
            await DemoAccessLog.destroy({ where: {}, truncate: true }).catch(() => {});
            
            await Car.destroy({ where: { userId } });
            await Fuel.destroy({ where: { userId } });
            await Maintenance.destroy({ where: { userId } });
            await Insurance.destroy({ where: { userId } });
            await UserDevice.destroy({ where: { userId } });
            await SessionData.destroy({ where: { deviceId } });
            await LocationData.destroy({ where: { deviceId } });

            if (clean) {
                return Response.json({ success: true, message: 'Demo data cleaned successfully.' });
            }
        }

        // 4. Generate Data if new user or force=true
        const carCount = await Car.count({ where: { userId, isDeleted: 0 } });

        if (carCount === 0 || force) {
            console.log('Generating demo data for user:', userId);

            // Create Cars
            const car1 = await Car.create({
                userId,
                description: 'BMW 320i (Demo)',
                licensePlate: 'DEMO-001'
            });

            const car2 = await Car.create({
                userId,
                description: 'Tesla Model 3 (Demo)',
                licensePlate: 'DEMO-002'
            });

            // Create Device mapping
            const deviceExists = await Device.findByPk(deviceId);
            if (!deviceExists) {
                await Device.create({
                    deviceId,
                    description: 'Demo OBD-II Tracker'
                });
            }

            await UserDevice.findOrCreate({
                where: { userId, deviceId },
                defaults: { userId, deviceId }
            });

            // Generate Fuel Records (last 3 months)
            const today = new Date();
            for (let i = 1; i <= 6; i++) {
                const date = new Date();
                date.setDate(today.getDate() - (i * 15));

                await Fuel.create({
                    userId,
                    carId: car1.id,
                    timestampUtc: date,
                    totalValue: (40 + Math.random() * 20).toFixed(2),
                    liters: (30 + Math.random() * 10).toFixed(2),
                    totalKilometers: (450 + Math.random() * 100),
                    kilometerPerLiter: (12 + Math.random() * 2).toFixed(2),
                    pricePerKilometer: (0.3 + Math.random() * 0.1).toFixed(2)
                });
            }

            // Generate Maintenance Records
            await Maintenance.create({
                userId,
                carId: car1.id,
                maintenanceDate: new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000),
                amount: 250.00,
                description: 'Oil change and filter replacement (Periodic Maintenance)'
            });

            await Maintenance.create({
                userId,
                carId: car2.id,
                maintenanceDate: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
                amount: 150.00,
                description: 'Tire rotation and alignment'
            });

            // Generate Insurance Records
            const currentYear = today.getFullYear();
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

            await Insurance.create({
                userId,
                carId: car1.id,
                paymentDate: lastMonth,
                period: `${currentYear}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`,
                amount: 85.50
            });

            await Insurance.create({
                userId,
                carId: car2.id,
                paymentDate: lastMonth,
                period: `${currentYear}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`,
                amount: 110.00
            });

            // Generate Sessions (last 10 days)
            for (let i = 0; i < 15; i++) {
                const start = new Date(today.getTime() - (i * 12 + Math.random() * 10) * 60 * 60 * 1000);
                const durationMinutes = 20 + Math.random() * 40;
                const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
                const distance = 5 + Math.random() * 15;

                // Calculate duration as the difference in hours between end and start
                const calculatedDuration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

                const session = await SessionData.create({
                    deviceId,
                    carId: car1.id,
                    startUtc: start,
                    endUtc: end,
                    sessionType: i % 3 === 0 ? 'B' : 'P', // B = Business, P = Private
                    distance: distance.toFixed(2),
                    timeTraveled: calculatedDuration.toFixed(2),
                    cost: (distance * 0.45).toFixed(2),
                    valueConfirmed: 'Y'
                });

                // Add a few GPS points for each session so it shows on map
                // Simple straight line for demo
                const startLat = -23.55 + (Math.random() - 0.5) * 0.1;
                const startLon = -46.63 + (Math.random() - 0.5) * 0.1;

                for (let j = 0; j < 5; j++) {
                    await LocationData.create({
                        deviceId,
                        timestampUtc: new Date(start.getTime() + (j * durationMinutes / 4) * 60 * 1000),
                        latitude: startLat + (j * 0.01),
                        longitude: startLon + (j * 0.01),
                        altitude: 700 + Math.random() * 50
                    });
                }
            }

            return Response.json({
                success: true,
                message: force ? 'Demo data recreated successfully.' : 'Demo user and data created successfully.',
                user: { username: 'demo', email: 'demo@travelaccess.ddns.net' }
            });
        }

        return Response.json({
            success: true,
            message: 'Demo user already exists and has data. Use ?force=true to recreate.',
            user: demoUser
        });

    } catch (error) {
        console.error('Demo setup error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

