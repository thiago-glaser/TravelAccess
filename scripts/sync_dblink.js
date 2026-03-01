require('dotenv').config({ path: '.env.local' });
const oracledb = require('oracledb');

async function syncTableViaDbLink(tableName) {
    if (!tableName) {
        console.error("Please provide a table name. Example: node scripts/sync_dblink.js USERS");
        process.exit(1);
    }

    tableName = tableName.toUpperCase();
    console.log(`\n--- Starting DB Link Sync for Table: ${tableName} ---`);

    let localConn;

    try {
        console.log("Connecting to local database...");
        localConn = await oracledb.getConnection({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectionString: process.env.ORACLE_CONNECTION_STRING
        });

        // 1. Get column names dynamically
        const colResult = await localConn.execute(
            `SELECT COLUMN_NAME, DATA_TYPE FROM USER_TAB_COLUMNS WHERE TABLE_NAME = :tableName ORDER BY COLUMN_ID`,
            { tableName: tableName }
        );

        if (colResult.rows.length === 0) {
            console.error(`Table ${tableName} not found in local schema.`);
            return;
        }

        let pkCols = ['ID'];
        if (tableName === 'DEVICES') pkCols = ['DEVICE_ID'];
        if (tableName === 'PARAMETER') pkCols = ['KEY'];
        if (tableName === 'USER_DEVICES') pkCols = ['USER_ID', 'DEVICE_ID'];

        // Exclude BLOB fields over DB Link due to ORA-22992
        const columns = colResult.rows.map(r => r[0]).filter(c => c !== 'RECEIPT_IMAGE' && c !== 'RECEIPT_MIME');
        const updateCols = columns.filter(c => !pkCols.includes(c));

        const matchCondition = pkCols.map(pk => `t.${pk} = s.${pk}`).join(' AND ');
        const updateSet = updateCols.map(c => `t.${c} = s.${c}`).join(', ');

        const insertCols = columns.join(', ');
        const insertVals = columns.map(c => `s.${c}`).join(', ');

        const updateClause = updateCols.length > 0 ? `WHEN MATCHED THEN UPDATE SET ${updateSet}` : '';
        const DB_LINK = "CLOUD_LINK";

        // 2. Determine Sync Marker
        try {
            await localConn.execute(`
                CREATE TABLE SYNC_STATE (
                    ID VARCHAR2(50) PRIMARY KEY,
                    LAST_SYNC TIMESTAMP,
                    UPDATED_AT TIMESTAMP DEFAULT SYS_EXTRACT_UTC(SYSTIMESTAMP)
                )
            `);
        } catch (e) { if (e.errorNum !== 955) console.error(e); }

        let lastSync = "2020-01-01T00:00:00.000Z";
        try {
            const syncStateRes = await localConn.execute(
                `SELECT TO_CHAR(LAST_SYNC, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"') AS LAST_SYNC FROM SYNC_STATE WHERE ID = :tableName`,
                { tableName }
            );
            if (syncStateRes.rows && syncStateRes.rows.length > 0 && syncStateRes.rows[0][0]) {
                lastSync = syncStateRes.rows[0][0];
            }
        } catch (e) { }

        console.log(`[${tableName}] Last sync marker: ${lastSync}`);

        // Get max dates before the merge
        let maxCloudDate = lastSync;
        let maxLocalDate = lastSync;

        try {
            const pullMaxDateQuery = await localConn.execute(
                `SELECT TO_CHAR(MAX(UPDATED_AT), 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"') FROM ${tableName}@${DB_LINK} WHERE UPDATED_AT > TO_TIMESTAMP(:lastSync, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"')`,
                { lastSync: lastSync }
            );
            if (pullMaxDateQuery.rows[0] && pullMaxDateQuery.rows[0][0]) maxCloudDate = pullMaxDateQuery.rows[0][0];

            const pushMaxDateQuery = await localConn.execute(
                `SELECT TO_CHAR(MAX(UPDATED_AT), 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"') FROM ${tableName} WHERE UPDATED_AT >  TO_TIMESTAMP(:lastSync, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"')`,
                { lastSync: lastSync }
            );
            if (pushMaxDateQuery.rows[0] && pushMaxDateQuery.rows[0][0]) maxLocalDate = pushMaxDateQuery.rows[0][0];
        } catch (e) {
            console.error("Could not fetch MAX dates. Probably no rows changed.", e.message);
        }

        // 3. Cloud -> Local (Pull)
        const pullSql = `
            MERGE INTO ${tableName} t
            USING (SELECT ${columns.join(', ')} FROM ${tableName}@${DB_LINK} WHERE UPDATED_AT > TO_TIMESTAMP(:lastSync, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"')) s
            ON (${matchCondition})
            ${updateClause}
            WHEN NOT MATCHED THEN INSERT (${insertCols}) VALUES (${insertVals})
        `;

        let pullAffected = 0;
        try {
            const pullRes = await localConn.execute(pullSql, { lastSync: lastSync }, { autoCommit: true });
            pullAffected = pullRes.rowsAffected;
            console.log(`[Cloud -> Local] Successfully merged ${pullAffected} records.`);
        } catch (e) {
            console.error(`[Cloud -> Local] MERGE Error: ${e.message}`);
        }

        // 4. Local -> Cloud (Push)
        const pushSql = `
            MERGE INTO ${tableName}@${DB_LINK} t
            USING (SELECT ${columns.join(', ')} FROM ${tableName} WHERE UPDATED_AT > TO_TIMESTAMP(:lastSync, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"')) s
            ON (${matchCondition})
            ${updateClause}
            WHEN NOT MATCHED THEN INSERT (${insertCols}) VALUES (${insertVals})
        `;

        let pushAffected = 0;
        try {
            const pushRes = await localConn.execute(pushSql, { lastSync: lastSync }, { autoCommit: true });
            pushAffected = pushRes.rowsAffected;
            console.log(`[Local -> Cloud] Successfully merged ${pushAffected} records.`);
        } catch (e) {
            console.error(`[Local -> Cloud] MERGE Error: ${e.message}`);
        }

        const maxDateStr = (new Date(maxCloudDate).getTime() > new Date(maxLocalDate).getTime()) ? maxCloudDate : maxLocalDate;

        // 5. Update marker
        if (new Date(maxDateStr).getTime() > new Date(lastSync).getTime()) {
            console.log(`[${tableName}] Advancing sync marker to: ${maxDateStr}`);
            const updateSyncSql = `
                MERGE INTO SYNC_STATE target
                USING (SELECT :tableName AS ID, TO_TIMESTAMP(:newSyncTime, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"') AS LAST_SYNC FROM DUAL) source
                ON (target.ID = source.ID)
                WHEN MATCHED THEN
                    UPDATE SET target.LAST_SYNC = source.LAST_SYNC, target.UPDATED_AT = SYS_EXTRACT_UTC(SYSTIMESTAMP)
                WHEN NOT MATCHED THEN
                    INSERT (ID, LAST_SYNC, UPDATED_AT) VALUES (source.ID, source.LAST_SYNC, SYS_EXTRACT_UTC(SYSTIMESTAMP))
            `;
            await localConn.execute(updateSyncSql, { tableName: tableName, newSyncTime: maxDateStr }, { autoCommit: true });

            // Replicate marker to cloud if possible
            try {
                await localConn.execute(updateSyncSql.replace('SYNC_STATE target', `SYNC_STATE@${DB_LINK} target`), { tableName: tableName, newSyncTime: maxDateStr }, { autoCommit: true });
            } catch (e) { /* ignore */ }
        } else {
            console.log(`[${tableName}] No new records synced. Marker remains: ${lastSync}`);
        }

        // Output overall summary
        console.log(`\n=================================================`);
        console.log(`✅ SYNC SUMMARY FOR TABLE: ${tableName}`);
        console.log(`   🔸 Cloud to Local Transferred: ${pullAffected}`);
        console.log(`   🔸 Local to Cloud Transferred: ${pushAffected}`);
        console.log(`   🔸 Total Records Transferred:  ${pullAffected + pushAffected}`);
        console.log(`=================================================`);

        return pullAffected + pushAffected;

    } catch (e) {
        console.error("Fatal Error during DB link Sync:", e);
    } finally {
        if (localConn) {
            await localConn.close();
            console.log("Connection closed.");
        }
    }
}

// Check if running directly from CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length > 0) {
        syncTableViaDbLink(args[0]).then(amount => {
            // Exited successfully 
        });
    } else {
        console.error("Please provide a table name. Example: node scripts/sync_dblink.js USERS");
        process.exit(1);
    }
}

module.exports = { syncTableViaDbLink };
