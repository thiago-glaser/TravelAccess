import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class Bluetooth extends Model {}

Bluetooth.init({

    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4, field: 'ID' },
    userId: { type: DataTypes.CHAR(36), allowNull: false, field: 'USER_ID' },
    name: { type: DataTypes.STRING(100), field: 'NAME' },
    description: { type: DataTypes.STRING(255), field: 'DESCRIPTION' },
    address: { type: DataTypes.STRING(100), field: 'ADDRESS' },
    carId: { type: DataTypes.CHAR(36), field: 'CAR_ID' },
    createdAt: { type: DataTypes.DATE, field: 'CREATED_AT' },
    updatedAt: { type: DataTypes.DATE, field: 'UPDATED_AT' },
    isDeleted: { type: DataTypes.INTEGER, defaultValue: 0, field: 'IS_DELETED' }
    
}, {
    sequelize,
    modelName: 'Bluetooth',
    tableName: 'BLUETOOTH',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default Bluetooth;
