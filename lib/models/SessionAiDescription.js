import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class SessionAiDescription extends Model {}

SessionAiDescription.init({
    sessionDataId: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        allowNull: false,
        field: 'SESSION_DATA_ID'
    },
    description: {
        type: DataTypes.STRING(4000),
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
    modelName: 'SessionAiDescription',
    tableName: 'SESSION_AI_DESCRIPTION',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default SessionAiDescription;
