const oracledb = require('oracledb');
(async () => {
    require('dotenv').config({ path: '.env.local' });
    const conn = await oracledb.getConnection({
        user: process.env.ORACLE_USER,
        password: process.env.ORACLE_PASSWORD,
        connectionString: process.env.ORACLE_CONNECTION_STRING
    });
    const res = await conn.execute(`SELECT ID, TO_CHAR(START_UTC, 'YYYY-MM-DD HH24:MI:SS') AS START_UTC FROM V_SESSIONS ORDER BY START_UTC DESC FETCH NEXT 5 ROWS ONLY`);
    console.log(res.rows);
    await conn.close();
})();
