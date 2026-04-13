import dotenv from 'dotenv';
dotenv.config({ path: 'c:/Code/Proxy/.env.dev' });
import { Sequelize, DataTypes } from 'sequelize';

const sequelize = new Sequelize({
    dialect: 'mysql',
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
});

const Car = sequelize.define('Car', {
    id: { type: DataTypes.CHAR(36), primaryKey: true, field: 'ID' },
    userId: { type: DataTypes.CHAR(36), field: 'USER_ID' },
    description: { type: DataTypes.STRING, field: 'DESCRIPTION' },
    licensePlate: { type: DataTypes.STRING, field: 'LICENSE_PLATE' },
    isDeleted: { type: DataTypes.INTEGER, field: 'IS_DELETED' }
}, { tableName: 'CARS', timestamps: false });

async function test() {
    try {
        const userId = '4BDF0936BAA603F3E063030011AC8A1B'; // The one that has cars
        const cars = await Car.findAll({
            where: {
                userId: userId,
                // isDeleted: { [require('sequelize').Op.or]: [0, null] }
            },
            raw: true
        });
        console.log("Cars for A6:", cars.length);

        // test with padded userId
        const carsPadded = await Car.findAll({
            where: {
                userId: userId.padEnd(36, " "),
            },
            raw: true
        });
        console.log("Cars for A6 padded:", carsPadded.length);

    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
test();
