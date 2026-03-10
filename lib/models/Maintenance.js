import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';
import Car from './Car.js';

class Maintenance extends Model {}

Maintenance.init({
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
    maintenanceDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'MAINTENANCE_DATE'
    },
    amount: {
        type: DataTypes.DECIMAL,
        allowNull: false,
        field: 'AMOUNT'
    },
    description: {
        type: DataTypes.STRING(1000),
        allowNull: false,
        field: 'DESCRIPTION'
    },
    receiptImage: {
        type: DataTypes.BLOB,
        field: 'RECEIPT_IMAGE'
    },
    receiptMime: {
        type: DataTypes.STRING(50),
        field: 'RECEIPT_MIME'
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
    modelName: 'Maintenance',
    tableName: 'MAINTENANCE',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

Maintenance.belongsTo(Car, { foreignKey: 'carId', as: 'car' });
Car.hasMany(Maintenance, { foreignKey: 'carId', as: 'maintenanceEntries' });

export default Maintenance;
