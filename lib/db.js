import oracledb from 'oracledb';

const dbConfig = {
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectionString: process.env.ORACLE_CONNECTION_STRING,
};

// Ensure outFormat is set to OBJECT for all queries
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

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
        connection = await oracledb.getConnection(dbConfig);
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

export { query, oracledb };
export default { query, oracledb };
