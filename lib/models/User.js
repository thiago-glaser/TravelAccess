import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class User extends Model {}

User.init({

    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4, field: 'ID' },
    username: { type: DataTypes.STRING(50), allowNull: false, unique: true, field: 'USERNAME' },
    passwordHash: { type: DataTypes.STRING(255), field: 'PASSWORD_HASH' },
    email: { type: DataTypes.STRING(100), field: 'EMAIL' },
    createdAt: { type: DataTypes.DATE, field: 'CREATED_AT' },
    isAdmin: { type: DataTypes.INTEGER, field: 'IS_ADMIN' },
    googleId: { type: DataTypes.STRING(255), field: 'GOOGLE_ID' },
    googleAvatarUrl: { type: DataTypes.STRING(500), field: 'GOOGLE_AVATAR_URL' },
    updatedAt: { type: DataTypes.DATE, field: 'UPDATED_AT' },
    isDeleted: { type: DataTypes.INTEGER, defaultValue: 0, field: 'IS_DELETED' }
    
}, {
    sequelize,
    modelName: 'User',
    tableName: 'USERS',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default User;
