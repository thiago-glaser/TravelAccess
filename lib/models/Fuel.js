import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class Fuel extends Model {}

Fuel.init({

    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4, field: 'ID' },
    userId: { type: DataTypes.CHAR(36), allowNull: false, field: 'USER_ID' },
    carId: { type: DataTypes.CHAR(36), allowNull: false, field: 'CAR_ID' },
    timestampUtc: { type: DataTypes.DATE, allowNull: false, field: 'TIMESTAMP_UTC' },
    totalValue: { type: DataTypes.DECIMAL, allowNull: false, field: 'TOTAL_VALUE' },
    liters: { type: DataTypes.DECIMAL, allowNull: false, field: 'LITERS' },
    totalKilometers: { type: DataTypes.DECIMAL, defaultValue: 0, field: 'TOTAL_KILOMETERS' },
    kilometerPerLiter: { type: DataTypes.DECIMAL, defaultValue: 0, field: 'KILOMETER_PER_LITER' },
    pricePerKilometer: { type: DataTypes.DECIMAL, defaultValue: 0, field: 'PRICE_PER_KILOMETER' },
    receiptImage: { type: DataTypes.BLOB, field: 'RECEIPT_IMAGE' },
    receiptMime: { type: DataTypes.STRING(50), field: 'RECEIPT_MIME' },
    createdAt: { type: DataTypes.DATE, field: 'CREATED_AT' },
    updatedAt: { type: DataTypes.DATE, field: 'UPDATED_AT' },
    isDeleted: { type: DataTypes.INTEGER, defaultValue: 0, field: 'IS_DELETED' }
    
}, {
    sequelize,
    modelName: 'Fuel',
    tableName: 'FUEL',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default Fuel;
