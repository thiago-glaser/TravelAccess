import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class DemoAccessLog extends Model {}

DemoAccessLog.init({
    id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        field: 'ID'
    },
    accessTime: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'ACCESS_TIME'
    },
    ipAddress: {
        type: DataTypes.STRING(50),
        field: 'IP_ADDRESS'
    },
    userAgent: {
        type: DataTypes.STRING(500),
        field: 'USER_AGENT'
    },
    referer: {
        type: DataTypes.STRING(500),
        field: 'REFERER'
    }
}, {
    sequelize,
    modelName: 'DemoAccessLog',
    tableName: 'DEMO_ACCESS_LOGS',
    timestamps: false
});

export default DemoAccessLog;
