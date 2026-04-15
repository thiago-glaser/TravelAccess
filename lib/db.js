import mysql from 'mysql2/promise';

let pool;

export async function getConnection() {
    if (!pool) {
        pool = mysql.createPool({
            host: process.env.MYSQL_HOST || 'localhost',
            port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            waitForConnections: true,
            connectionLimit: 10,
            namedPlaceholders: true
        });
    }
    return pool;
}

export async function query(sql, binds = {}, options = {}) {
    try {
        const p = await getConnection();
        const [rows, fields] = await p.query(sql, binds);
        return { rows, fields };
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}
