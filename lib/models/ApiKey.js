import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class ApiKey extends Model {}

ApiKey.init({

    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4, field: 'ID' },
    userId: { type: DataTypes.CHAR(36), field: 'USER_ID' },
    keyValue: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'KEY_VALUE' },
    description: { type: DataTypes.STRING(100), field: 'DESCRIPTION' },
    isActive: { type: DataTypes.INTEGER, field: 'IS_ACTIVE' },
    createdAt: { type: DataTypes.DATE, field: 'CREATED_AT' },
    lastUsed: { type: DataTypes.DATE, field: 'LAST_USED' },
    updatedAt: { type: DataTypes.DATE, field: 'UPDATED_AT' },
    isDeleted: { type: DataTypes.INTEGER, defaultValue: 0, field: 'IS_DELETED' }
    
}, {
    sequelize,
    modelName: 'ApiKey',
    tableName: 'API_KEYS',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default ApiKey;
