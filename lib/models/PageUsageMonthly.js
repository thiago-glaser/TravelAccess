import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class PageUsageMonthly extends Model {}

PageUsageMonthly.init({
    id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        field: 'ID'
    },
    path: {
        type: DataTypes.STRING(500),
        allowNull: false,
        field: 'PATH'
    },
    yearNum: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'YEAR_NUM'
    },
    monthNum: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'MONTH_NUM'
    },
    hitCount: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        field: 'HIT_COUNT'
    },
    createdAt: {
        type: DataTypes.DATE,
        field: 'CREATED_AT'
    },
    updatedAt: {
        type: DataTypes.DATE,
        field: 'UPDATED_AT'
    }
}, {
    sequelize,
    modelName: 'PageUsageMonthly',
    tableName: 'PAGE_USAGE_MONTHLY',
    timestamps: false    // we manage createdAt/updatedAt ourselves in the DB
});

export default PageUsageMonthly;
