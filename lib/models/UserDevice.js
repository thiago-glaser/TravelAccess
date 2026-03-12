import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class UserDevice extends Model {}

UserDevice.init({

    userId: { type: DataTypes.CHAR(36), primaryKey: true, field: 'USER_ID' },
    deviceId: { type: DataTypes.STRING(50), primaryKey: true, field: 'DEVICE_ID' },
    createdAt: { type: DataTypes.DATE, field: 'CREATED_AT' },
    updatedAt: { type: DataTypes.DATE, field: 'UPDATED_AT' },
    isDeleted: { type: DataTypes.INTEGER, defaultValue: 0, field: 'IS_DELETED' }
    
}, {
    sequelize,
    modelName: 'UserDevice',
    tableName: 'USER_DEVICES',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default UserDevice;
