import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class Car extends Model {}

Car.init({
    id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        field: 'ID'
    },
    userId: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        field: 'USER_ID'
    },
    description: {
        type: DataTypes.STRING(100),
        field: 'DESCRIPTION'
    },
    licensePlate: {
        type: DataTypes.STRING(20),
        field: 'LICENSE_PLATE'
    },
    createdAt: {
        type: DataTypes.DATE,
        field: 'CREATED_AT'
    },
    updatedAt: {
        type: DataTypes.DATE,
        field: 'UPDATED_AT'
    },
    isDeleted: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'IS_DELETED'
    }
}, {
    sequelize,
    modelName: 'Car',
    tableName: 'CARS',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default Car;
