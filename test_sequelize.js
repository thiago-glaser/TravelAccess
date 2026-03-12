import { Sequelize } from 'sequelize';

const useCloudDb = process.env.USE_CLOUD_DB === 'true';
const config = {
    dialect: 'oracle',
    username: useCloudDb ? process.env.CLOUD_ORACLE_USER : process.env.ORACLE_USER,
    password: useCloudDb ? process.env.CLOUD_ORACLE_PASSWORD : process.env.ORACLE_PASSWORD,
    dialectOptions: {
        connectString: useCloudDb ? process.env.CLOUD_ORACLE_CONNECTION_STRING : process.env.ORACLE_CONNECTION_STRING
    }
};

const sequelize = new Sequelize(config);

sequelize.authenticate()
    .then(() => {
        console.log('Connection has been established successfully.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Unable to connect to the database:', err);
        process.exit(1);
    });
