import dotenv from 'dotenv';
dotenv.config({ path: 'c:/Code/Proxy/.env.dev' });
import { Car } from './lib/models/index.js';

async function test() {
    try {
        const userId32 = '4BDF0936BAA603F3E063030011AC8A1B';
        const userId36 = '4BDF0936BAA603F3E063030011AC8A1B    ';

        const cars32 = await Car.findAll({ where: { userId: userId32 }, raw: true });
        console.log("Cars with 32 chars:", cars32.length);

        const cars36 = await Car.findAll({ where: { userId: userId36 }, raw: true });
        console.log("Cars with 36 chars (padded):", cars36.length);

    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
test();
