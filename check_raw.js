import dotenv from 'dotenv';
dotenv.config({ path: 'c:/Code/Proxy/.env.dev' });
dotenv.config();

import { query } from './lib/db.js';

async function test() {
    try {
        const testUser = await query('SELECT ID FROM USERS LIMIT 1');
        const userId = testUser.rows[0].ID;

        console.log("Testing with userId:", userId);

        // 1. Raw exact query
        const rawPadded = await query('SELECT ID, IS_DELETED FROM CARS WHERE USER_ID = ?', [userId]);
        console.log("Raw matched exactly?", rawPadded.rows);

        // 2. Trimmed query
        const rawTrimmed = await query('SELECT ID, IS_DELETED FROM CARS WHERE TRIM(USER_ID) = TRIM(?)', [userId]);
        console.log("Raw matched trimmed?", rawTrimmed.rows);

        // 3. Or query
        const rawOr = await query('SELECT ID, IS_DELETED FROM CARS WHERE TRIM(USER_ID) = TRIM(?) AND (IS_DELETED = 0 OR IS_DELETED IS NULL)', [userId]);
        console.log("Raw OR matched?", rawOr.rows);

    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
test();
