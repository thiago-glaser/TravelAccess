import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class Parameter extends Model {}

Parameter.init({

    key: { type: DataTypes.STRING(30), primaryKey: true, field: 'KEY' },
    value: { type: DataTypes.STRING(512), field: 'VALUE' },
    createdAt: { type: DataTypes.DATE, field: 'CREATED_AT' },
    updatedAt: { type: DataTypes.DATE, field: 'UPDATED_AT' },
    isDeleted: { type: DataTypes.INTEGER, defaultValue: 0, field: 'IS_DELETED' }
    
}, {
    sequelize,
    modelName: 'Parameter',
    tableName: 'PARAMETER',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default Parameter;
