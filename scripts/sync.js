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

        let updated = 0;
        if (updateSql) {
            try {
                const result = await connection.execute(updateSql, binds, { autoCommit: true });
                updated = result.rowsAffected;
            } catch (e) {
                console.error(`Error executing UPDATE for ${tableName}:\n${updateSql}\nBinds:`, Object.keys(binds));
                throw e;
            }
        }

        if (updated === 0) {
            try {
                await connection.execute(insertSql, binds, { autoCommit: true });
            } catch (e) {
                console.error(`Error executing INSERT for ${tableName}:\n${insertSql}\nBinds:`, Object.keys(binds));
                throw e;
            }
        }
    }
}

async function syncTable(localConn, cloudConn, tableName, lastSyncDate) {
    console.log(`\n--- Syncing Table: ${tableName} ---`);

    // 1. Pull changes from Cloud -> Local
    const cloudChanges = await cloudConn.execute(
        `SELECT * FROM ${tableName} WHERE UPDATED_AT > TO_TIMESTAMP(:lastSync, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"')`,
        { lastSync: lastSyncDate },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log(`[Cloud -> Local] Found ${cloudChanges.rows.length} rows to sync.`);

    if (cloudChanges.rows.length > 0) {
        await performUpsert(localConn, tableName, cloudChanges.rows);
    }

    // 2. Push changes from Local -> Cloud
    const localChanges = await localConn.execute(
        `SELECT * FROM ${tableName} WHERE UPDATED_AT > TO_TIMESTAMP(:lastSync, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"')`,
        { lastSync: lastSyncDate },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log(`[Local -> Cloud] Found ${localChanges.rows.length} rows to sync.`);

    if (localChanges.rows.length > 0) {
        await performUpsert(cloudConn, tableName, localChanges.rows);
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
                    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
        } catch (e) { if (e.errorNum !== 955) console.error(e); } // ignore already exists

        try {
            await cloudConn.execute(`
                CREATE TABLE SYNC_STATE (
                    ID VARCHAR2(50) PRIMARY KEY,
                    LAST_SYNC TIMESTAMP,
                    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
        } catch (e) { if (e.errorNum !== 955) console.error(e); } // ignore already exists

        let lastSync = "2020-01-01T00:00:00.000Z";
        try {
            const syncStateRes = await localConn.execute(
                `SELECT TO_CHAR(LAST_SYNC, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"') AS LAST_SYNC FROM SYNC_STATE WHERE ID = 'DEFAULT'`
            );
            if (syncStateRes.rows && syncStateRes.rows.length > 0 && syncStateRes.rows[0][0]) {
                lastSync = syncStateRes.rows[0][0];
            }
        } catch (e) {
            console.log("Empty or missing local SYNC_STATE rows.");
        }

        console.log(`Starting Sync from: ${lastSync}`);

        // 2. Start the sync operation time recording
        const currentTime = new Date().toISOString();

        // 3. Process every table bidirectionally
        for (const table of SYNC_TABLES) {
            await syncTable(localConn, cloudConn, table, lastSync);
        }

        // 4. Save the new sync marker to the database instances
        const updateSyncSql = `
            MERGE INTO SYNC_STATE target
            USING (SELECT 'DEFAULT' AS ID, TO_TIMESTAMP(:currentTime, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"') AS LAST_SYNC FROM DUAL) source
            ON (target.ID = source.ID)
            WHEN MATCHED THEN
                UPDATE SET target.LAST_SYNC = source.LAST_SYNC, target.UPDATED_AT = CURRENT_TIMESTAMP
            WHEN NOT MATCHED THEN
                INSERT (ID, LAST_SYNC) VALUES (source.ID, source.LAST_SYNC)
        `;

        await localConn.execute(updateSyncSql, { currentTime: currentTime }, { autoCommit: true });
        await cloudConn.execute(updateSyncSql, { currentTime: currentTime }, { autoCommit: true });

        console.log(`\n✅ Sync complete! New sync marker saved to databases: ${currentTime}`);

    } catch (e) {
        console.error("Fatal Sync Error:", e);
    } finally {
        if (localConn) await localConn.close();
        if (cloudConn) await cloudConn.close();
    }
}

startSync();
