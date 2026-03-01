require('dotenv').config({ path: '.env.local' });
const oracledb = require('oracledb');

async function createDbLink() {
    let localConn;
    try {
        console.log("Connecting to local database...");
        localConn = await oracledb.getConnection({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectionString: process.env.ORACLE_CONNECTION_STRING
        });

        const linkName = 'CLOUD_LINK';

        // Ensure the path in CLOUD_ORACLE_WALLET_DIR is accessible from the Database Server
        let connectStr = process.env.CLOUD_ORACLE_CONNECTION_STRING;
        // Use the internal path mapped inside the Oracle23ai Docker container
        const walletDir = '/opt/oracle/oracle_wallet';
        const cloudUser = process.env.CLOUD_ORACLE_USER;
        const cloudPassword = process.env.CLOUD_ORACLE_PASSWORD;

        // Inject MY_WALLET_DIRECTORY into the security section of the connection string
        if (connectStr.toLowerCase().includes('(security=')) {
            connectStr = connectStr.replace(/(\(\s*security\s*=)/i, `$1(MY_WALLET_DIRECTORY=${walletDir})`);
        } else {
            // Append security string
            connectStr = `${connectStr.slice(0, -1)}(security=(MY_WALLET_DIRECTORY=${walletDir})))`;
        }

        const createLinkSql = `
            CREATE DATABASE LINK ${linkName}
            CONNECT TO "${cloudUser}" IDENTIFIED BY "${cloudPassword}"
            USING '${connectStr}'
        `;

        console.log(`\nCreating or replacing database link...`);

        try {
            await localConn.execute(`DROP DATABASE LINK ${linkName}`);
            console.log(`Dropped existing link ${linkName}.`);
        } catch (e) {
            // Ignore if it doesn't exist (ORA-02024: database link not found)
            if (e.errorNum !== 2024) {
                console.log("Note: " + e.message);
            }
        }

        try {
            await localConn.execute(createLinkSql);
            console.log(`\n✅ Database Link '${linkName}' created successfully!`);
            console.log(`\nYou can now test it by running a query across the link, for example:`);
            console.log(`SELECT * FROM DUAL@${linkName};`);
            console.log(`\n⚠️ Note: The wallet directory ('${walletDir}') MUST be physically accessible by the Oracle Database server process.`);
            console.log(`If Oracle is running in a Docker container, that path must be mapped inside the container.`);
        } catch (linkError) {
            console.error(`\n❌ Failed to create database link:`, linkError.message);
            if (linkError.message.includes("ORA-01031")) {
                console.log(`\n💡 Troubleshooting:`);
                console.log(`Your local database user (${process.env.ORACLE_USER}) requires the "CREATE DATABASE LINK" privilege.`);
                console.log(`Run this as sysdba: GRANT CREATE DATABASE LINK TO ${process.env.ORACLE_USER};`);
            }
        }

    } catch (e) {
        console.error("Connection Error:", e.message);
    } finally {
        if (localConn) {
            await localConn.close();
            console.log("Connection closed.");
        }
    }
}

createDbLink();
