require('dotenv').config({ path: '.env.local' });
const oracledb = require('oracledb');

async function testConnection() {
    let connection;
    try {
        console.log("Attempting to connect to Cloud Database...");
        console.log(`Using USER: ${process.env.CLOUD_ORACLE_USER}`);

        // Try using the pure connection string directly instead
        // This is Oracle's "Easy Connect Plus" or EZConnect string matching the sample you provided
        connection = await oracledb.getConnection({
            user: process.env.CLOUD_ORACLE_USER,
            password: process.env.CLOUD_ORACLE_PASSWORD,
            connectString: process.env.CLOUD_ORACLE_CONNECTION_STRING
        });

        console.log("✅ Successfully connected to Oracle Cloud!");

        // Test a simple query
        const result = await connection.execute(`select * from dual`);
        console.log("Query rows:", result.rows);

    } catch (e) {
        console.error("❌ Failed to connect to Oracle Cloud.");
        console.error(e.message);
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log("Connection closed successfully.");
            } catch (e) {
                console.error("Error closing connection", e);
            }
        }
    }
}

testConnection();
