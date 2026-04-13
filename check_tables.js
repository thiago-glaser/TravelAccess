import { query } from './lib/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkTables() {
    try {
        const result = await query('SHOW TABLES;');
        console.log(result.rows);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
checkTables();
