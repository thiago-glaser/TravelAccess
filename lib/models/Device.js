import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class Device extends Model {}

Device.init({

    deviceId: { type: DataTypes.STRING(20), primaryKey: true, field: 'DEVICE_ID' },
    description: { type: DataTypes.STRING(50), field: 'DESCRIPTION' },
    createdAt: { type: DataTypes.DATE, field: 'CREATED_AT' },
    updatedAt: { type: DataTypes.DATE, field: 'UPDATED_AT' },
    isDeleted: { type: DataTypes.INTEGER, defaultValue: 0, field: 'IS_DELETED' }
    
}, {
    sequelize,
    modelName: 'Device',
    tableName: 'DEVICES',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default Device;
