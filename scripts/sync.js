require('dotenv').config({ path: '.env.local' });
const oracledb = require('oracledb');
const fs = require('fs');

// The tables we want to sync (order doesn't matter tightly anymore since you removed FKs)
const SYNC_TABLES = [
    'USERS', 'API_KEYS', 'DEVICES', 'USER_DEVICES', 'CARS',
    'BLUETOOTH', 'FUEL', 'LOCATION', 'LOCATION_DATA',
    'LOCATION_GEOCODE', 'SESSION_DATA', 'PARAMETER'
];

async function getDbConnection(isCloud) {
    const prefix = isCloud ? 'CLOUD_' : '';
    return await oracledb.getConnection({
        user: process.env[`${prefix}ORACLE_USER`],
        password: process.env[`${prefix}ORACLE_PASSWORD`],
        connectionString: process.env[`${prefix}ORACLE_CONNECTION_STRING`],
        ...(isCloud ? {
            walletLocation: process.env.CLOUD_ORACLE_WALLET_DIR,
            walletPassword: process.env.CLOUD_ORACLE_WALLET_PASSWORD
        } : {})
    });
}

// We will explicitly do UPDATE then INSERT because Oracle MERGE INTO with DUAL and BLOBs throws ORA-00942 / ORA-12801
async function performUpsert(connection, tableName, rows) {
    if (rows.length === 0) return;

    // 1. Get column names dynamically
    const colResult = await connection.execute(
        `SELECT COLUMN_NAME, DATA_TYPE FROM USER_TAB_COLUMNS WHERE TABLE_NAME = :tableName ORDER BY COLUMN_ID`,
        { tableName: tableName.toUpperCase() }
    );

    let pkCols = ['ID'];
    if (tableName === 'DEVICES') pkCols = ['DEVICE_ID'];
    if (tableName === 'PARAMETER') pkCols = ['KEY'];
    if (tableName === 'USER_DEVICES') pkCols = ['USER_ID', 'DEVICE_ID'];

    // Filter out RECEIPT_IMAGE to avoid ORA-00942 temporary LOB permission errors during Node syncing
    const columns = colResult.rows.map(r => r[0]).filter(c => c !== 'RECEIPT_IMAGE' && c !== 'RECEIPT_MIME');
    const updateCols = columns.filter(c => !pkCols.includes(c));

    const matchCondition = pkCols.map(pk => `${pk} = :${pk}`).join(' AND ');
    const updateSet = updateCols.map(c => `${c} = :${c}`).join(', ');

    const updateSql = updateCols.length > 0
        ? `UPDATE ${tableName} SET ${updateSet} WHERE ${matchCondition}`
        : null;

    const insertCols = columns.join(', ');
    const insertVals = columns.map(c => `:${c}`).join(', ');
    const insertSql = `INSERT INTO ${tableName} (${insertCols}) VALUES (${insertVals})`;

    for (const row of rows) {
        const binds = {};
        columns.forEach(k => {
            let val = row[k];
            if (val === undefined) {
                binds[k] = null;
            } else if (Buffer.isBuffer(val)) {
                binds[k] = { type: oracledb.BLOB, dir: oracledb.BIND_IN, val: val };
            } else {
                binds[k] = val;
            }
        });

        try {
            let updated = 0;
            if (updateSql) {
                const result = await connection.execute(updateSql, binds, { autoCommit: true });
                updated = result.rowsAffected;
            }

            if (updated === 0) {
                await connection.execute(insertSql, binds, { autoCommit: true });
            }
        } catch (e) {
            console.error(`\n❌ Failed to sync row in table ${tableName}. Error: ${e.message}`);

            // Format row data for logging without dumping huge BLOBs 
            const rowDataStr = JSON.stringify(row, (key, value) => {
                if (Buffer.isBuffer(value)) return '[BLOB Data]';
                return value;
            });
            console.error(`Row Data: ${rowDataStr}\n`);
        }
    }
}

async function syncTable(localConn, cloudConn, tableName) {
    console.log(`\n--- Syncing Table: ${tableName} ---`);

    // Get last sync for this table
    let lastSync = "2020-01-01T00:00:00.000Z";
    try {
        const syncStateRes = await localConn.execute(
            `SELECT TO_CHAR(LAST_SYNC, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"') AS LAST_SYNC FROM SYNC_STATE WHERE ID = :tableName`,
            { tableName }
        );
        if (syncStateRes.rows && syncStateRes.rows.length > 0 && syncStateRes.rows[0][0]) {
            lastSync = syncStateRes.rows[0][0];
        }
    } catch (e) {
        // Ignore if error, means we start from default
    }

    console.log(`[${tableName}] Last sync marker: ${lastSync}`);

    // Find the newest UPDATED_AT among the synced records
    let maxDateStr = lastSync;
    let maxDateObj = new Date(lastSync);

    const checkMaxDate = (rows) => {
        for (const row of rows) {
            if (row.UPDATED_AT) {
                // Ensure row.UPDATED_AT is parsed properly (it could be a Date object from node-oracledb)
                const rowDate = new Date(row.UPDATED_AT);
                if (rowDate > maxDateObj) {
                    maxDateObj = rowDate;
                    maxDateStr = rowDate.toISOString();
                }
            }
        }
    };

    // 1. Pull changes from Cloud -> Local
    console.log(`[Cloud -> Local] Querying changes...`);
    let cloudRs;
    try {
        const cloudQuery = await cloudConn.execute(
            `SELECT * FROM ${tableName} WHERE UPDATED_AT > TO_TIMESTAMP(:lastSync, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"') ORDER BY UPDATED_AT ASC`,
            { lastSync: lastSync },
            { outFormat: oracledb.OUT_FORMAT_OBJECT, resultSet: true }
        );
        cloudRs = cloudQuery.resultSet;

        let cloudRows;
        let totalCloudFetched = 0;
        while ((cloudRows = await cloudRs.getRows(1000)) && cloudRows.length > 0) {
            totalCloudFetched += cloudRows.length;
            console.log(`[Cloud -> Local] Syncing batch of ${cloudRows.length} rows (Total: ${totalCloudFetched})...`);
            await performUpsert(localConn, tableName, cloudRows);
            checkMaxDate(cloudRows);
        }
    } finally {
        if (cloudRs) {
            try { await cloudRs.close(); } catch (e) { console.error(e); }
        }
    }

    // 2. Push changes from Local -> Cloud
    console.log(`[Local -> Cloud] Querying changes...`);
    let localRs;
    try {
        const localQuery = await localConn.execute(
            `SELECT * FROM ${tableName} WHERE UPDATED_AT > TO_TIMESTAMP(:lastSync, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"') ORDER BY UPDATED_AT ASC`,
            { lastSync: lastSync },
            { outFormat: oracledb.OUT_FORMAT_OBJECT, resultSet: true }
        );
        localRs = localQuery.resultSet;

        let localRows;
        let totalLocalFetched = 0;
        while ((localRows = await localRs.getRows(1000)) && localRows.length > 0) {
            totalLocalFetched += localRows.length;
            console.log(`[Local -> Cloud] Syncing batch of ${localRows.length} rows (Total: ${totalLocalFetched})...`);
            await performUpsert(cloudConn, tableName, localRows);
            checkMaxDate(localRows);
        }
    } finally {
        if (localRs) {
            try { await localRs.close(); } catch (e) { console.error(e); }
        }
    }

    if (maxDateObj.getTime() > new Date(lastSync).getTime()) {
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
        await cloudConn.execute(updateSyncSql, { tableName: tableName, newSyncTime: maxDateStr }, { autoCommit: true });
    } else {
        console.log(`[${tableName}] No new records synced. Sync marker remains: ${lastSync}`);
    }
}

async function startSync() {
    let localConn, cloudConn;

    try {
        console.log("Connecting to databases...");
        localConn = await getDbConnection(false); // Uses standard ORACLE_*
        cloudConn = await getDbConnection(true);  // Uses CLOUD_ORACLE_*

        // Determine sync start time from database instead of JSON file
        try {
            await localConn.execute(`
                CREATE TABLE SYNC_STATE (
                    ID VARCHAR2(50) PRIMARY KEY,
                    LAST_SYNC TIMESTAMP,
                    UPDATED_AT TIMESTAMP DEFAULT SYS_EXTRACT_UTC(SYSTIMESTAMP)
                )
            `);
        } catch (e) { if (e.errorNum !== 955) console.error(e); } // ignore already exists

        try {
            await cloudConn.execute(`
                CREATE TABLE SYNC_STATE (
                    ID VARCHAR2(50) PRIMARY KEY,
                    LAST_SYNC TIMESTAMP,
                    UPDATED_AT TIMESTAMP DEFAULT SYS_EXTRACT_UTC(SYSTIMESTAMP)
                )
            `);
        } catch (e) { if (e.errorNum !== 955) console.error(e); } // ignore already exists

        // 3. Process every table bidirectionally
        for (const table of SYNC_TABLES) {
            await syncTable(localConn, cloudConn, table);
        }

        console.log(`\n✅ Sync complete!`);

    } catch (e) {
        console.error("Fatal Sync Error:", e);
    } finally {
        if (localConn) await localConn.close();
        if (cloudConn) await cloudConn.close();
    }
}

startSync();
