import { Sequelize } from 'sequelize';

const useCloudDb = process.env.USE_CLOUD_DB === 'true';

const dialectOptions = {};
if (useCloudDb && process.env.CLOUD_ORACLE_WALLET_DIR) {
    // According to Sequelize Oracle dialect documentation, dialectOptions can take node-oracledb config
    dialectOptions.walletLocation = process.env.CLOUD_ORACLE_WALLET_DIR;
    dialectOptions.walletPassword = process.env.CLOUD_ORACLE_WALLET_PASSWORD;
    dialectOptions.configDir = process.env.CLOUD_ORACLE_WALLET_DIR;
}

const sequelize = new Sequelize({
    dialect: 'oracle',
    username: useCloudDb ? process.env.CLOUD_ORACLE_USER : process.env.ORACLE_USER,
    password: useCloudDb ? process.env.CLOUD_ORACLE_PASSWORD : process.env.ORACLE_PASSWORD,
    host: useCloudDb ? undefined : process.env.ORACLE_CONNECTION_STRING, // Host/connection string depends on format
    dialectOptions,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

// Since node-oracledb often uses connectString directly:
if (useCloudDb) {
    sequelize.config.host = undefined;
    sequelize.config.database = process.env.CLOUD_ORACLE_CONNECTION_STRING;
} else if (process.env.ORACLE_CONNECTION_STRING) {
    sequelize.config.database = process.env.ORACLE_CONNECTION_STRING;
}

export default sequelize;
