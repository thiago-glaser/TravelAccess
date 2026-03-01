import oracledb from 'oracledb';

// Global defaults for all connections
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

/**
 * Get a connection using the correct config based on USE_CLOUD_DB env flag.
 * Config is built lazily at call time so env vars are always resolved.
 * @returns {Promise<oracledb.Connection>}
 */
export async function getConnection() {
    const useCloudDb = process.env.USE_CLOUD_DB === 'true';
    const config = {
        user: useCloudDb ? process.env.CLOUD_ORACLE_USER : process.env.ORACLE_USER,
        password: useCloudDb ? process.env.CLOUD_ORACLE_PASSWORD : process.env.ORACLE_PASSWORD,
        connectionString: useCloudDb ? process.env.CLOUD_ORACLE_CONNECTION_STRING : process.env.ORACLE_CONNECTION_STRING,
    };
    if (useCloudDb && process.env.CLOUD_ORACLE_WALLET_DIR) {
        config.walletLocation = process.env.CLOUD_ORACLE_WALLET_DIR;
        config.walletPassword = process.env.CLOUD_ORACLE_WALLET_PASSWORD;
    }
    return await oracledb.getConnection(config);
}

/**
 * Execute a query with parameters
 * @param {string} sql 
 * @param {Array|Object} binds 
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
export async function query(sql, binds = [], options = {}) {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(sql, binds, options);
        return result;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
}

export { query, oracledb, getConnection };
