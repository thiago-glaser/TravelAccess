import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';
import Car from './Car.js';

class Insurance extends Model {}

Insurance.init({
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
    carId: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        field: 'CAR_ID'
    },
    paymentDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'PAYMENT_DATE'
    },
    period: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'PERIOD'
    },
    amount: {
        type: DataTypes.DECIMAL,
        allowNull: false,
        field: 'AMOUNT'
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
    modelName: 'Insurance',
    tableName: 'INSURANCE',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});


export default Insurance;
