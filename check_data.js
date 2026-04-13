import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: 'c:/Code/Proxy/.env.dev' }); // the user's view log says Proxy/.env.dev is where it has the db connection
// If it fails, we fall back
dotenv.config();

import { query } from './lib/db.js';

async function check() {
    try {
        const users = await query('SELECT ID FROM USERS LIMIT 1');
        console.log("Users:", users.rows);
        const cars = await query('SELECT ID, USER_ID FROM CARS LIMIT 5');
        console.log("Cars:", cars.rows);
        const usersCarsMatch = await query('SELECT c.* FROM CARS c JOIN USERS u ON c.USER_ID = u.ID');
        console.log("Cars joined to Users (strictly equal):", usersCarsMatch.rows?.length);
        const usersCarsTrimMatch = await query('SELECT c.* FROM CARS c JOIN USERS u ON TRIM(c.USER_ID) = TRIM(u.ID)');
        console.log("Cars joined to Users (TRIM equal):", usersCarsTrimMatch.rows?.length);

    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
check();
