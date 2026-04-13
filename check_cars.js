import dotenv from 'dotenv';
dotenv.config();
import { Car } from './lib/models/index.js';

async function test() {
    try {
        const cars = await Car.findAll({ raw: true });
        console.log("All cars in DB:", cars);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
test();
