import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class ExpenseType extends Model {}

ExpenseType.init({
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
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'NAME'
    },
    description: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'DESCRIPTION'
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
    modelName: 'ExpenseType',
    tableName: 'EXPENSE_TYPES',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default ExpenseType;
