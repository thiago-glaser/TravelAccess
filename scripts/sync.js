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
    });
}

// Dynamically generate a MERGE INTO (Upsert) statement to handle updates and inserts
async function generateMergeSql(connection, tableName) {
    // 1. Get column names dynamically from Oracle Data Dictionary
    const colResult = await connection.execute(
        `SELECT COLUMN_NAME, DATA_TYPE FROM USER_TAB_COLUMNS WHERE TABLE_NAME = :tableName ORDER BY COLUMN_ID`,
        { tableName: tableName.toUpperCase() }
    );

    // Most tables use 'ID' as primary key. DEVICES uses 'DEVICE_ID'. PARAMETER uses 'KEY'. USER_DEVICES uses both.
    // For a generic sync, you would look up the primary keys dynamically from ALL_CONSTRAINTS, but let's hardcode the known PKs for simplicity:
    let pkCols = ['ID'];
    if (tableName === 'DEVICES') pkCols = ['DEVICE_ID'];
    if (tableName === 'PARAMETER') pkCols = ['KEY'];
    if (tableName === 'USER_DEVICES') pkCols = ['USER_ID', 'DEVICE_ID'];

    const columns = colResult.rows.map(r => r[0]);
    const updateCols = columns.filter(c => !pkCols.includes(c)); // We don't update primary keys

    const matchCondition = pkCols.map(pk => `target.${pk} = source.${pk}`).join(' AND ');

    const updateSet = updateCols.length > 0
        ? `UPDATE SET ${updateCols.map(c => `target.${c} = source.${c}`).join(', ')}`
        : ''; // Some mapping tables might only have primary keys

    const insertCols = columns.join(', ');
    const insertVals = columns.map(c => `source.${c}`).join(', ');

    return `
        MERGE INTO ${tableName} target
        USING (
            SELECT ${columns.map(c => `:${c} AS ${c}`).join(', ')} FROM DUAL
        ) source
        ON (${matchCondition})
        WHEN MATCHED THEN
            ${updateSet}
        WHEN NOT MATCHED THEN
            INSERT (${insertCols})
            VALUES (${insertVals})
    `;
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
        const mergeSql = await generateMergeSql(localConn, tableName);
        for (const row of cloudChanges.rows) {
            // Bind everything as-is. 
            // NOTE: Dates/Timestamps might require explicit mapping in a full script, 
            // but the Oracle DB driver handles basic JS Dates perfectly most of the time.
            const binds = {};
            Object.keys(row).forEach(k => { binds[k] = row[k] === undefined ? null : row[k] });
            await localConn.execute(mergeSql, binds, { autoCommit: true });
        }
    }

    // 2. Push changes from Local -> Cloud
    const localChanges = await localConn.execute(
        `SELECT * FROM ${tableName} WHERE UPDATED_AT > TO_TIMESTAMP(:lastSync, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"')`,
        { lastSync: lastSyncDate },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log(`[Local -> Cloud] Found ${localChanges.rows.length} rows to sync.`);

    if (localChanges.rows.length > 0) {
        const mergeSql = await generateMergeSql(cloudConn, tableName);
        for (const row of localChanges.rows) {
            const binds = {};
            Object.keys(row).forEach(k => { binds[k] = row[k] === undefined ? null : row[k] });
            await cloudConn.execute(mergeSql, binds, { autoCommit: true });
        }
    }
}

async function startSync() {
    let localConn, cloudConn;

    try {
        console.log("Connecting to databases...");
        localConn = await getDbConnection(false); // Uses standard ORACLE_*
        cloudConn = await getDbConnection(true);  // Uses CLOUD_ORACLE_*

        // 1. Load the last sync time (defaulting to start of your app's life if it doesn't exist)
        const stateFile = './sync-state.json';
        let lastSync = "2020-01-01T00:00:00.000Z";
        if (fs.existsSync(stateFile)) {
            lastSync = JSON.parse(fs.readFileSync(stateFile)).lastSync;
        }

        console.log(`Starting Sync from: ${lastSync}`);

        // 2. Start the sync operation time recording
        const currentTime = new Date().toISOString();

        // 3. Process every table bidirectionally
        for (const table of SYNC_TABLES) {
            await syncTable(localConn, cloudConn, table, lastSync);
        }

        // 4. Save the new sync marker
        fs.writeFileSync(stateFile, JSON.stringify({ lastSync: currentTime }));
        console.log(`\n✅ Sync complete! New sync marker: ${currentTime}`);

    } catch (e) {
        console.error("Fatal Sync Error:", e);
    } finally {
        if (localConn) await localConn.close();
        if (cloudConn) await cloudConn.close();
    }
}

startSync();
