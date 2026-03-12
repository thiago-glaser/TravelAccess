import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class SessionView extends Model {}

SessionView.init({
    id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        field: 'ID'
    },
    deviceId: {
        type: DataTypes.STRING(20),
        field: 'DEVICE_ID'
    },
    carId: {
        type: DataTypes.CHAR(36),
        field: 'CAR_ID'
    },
    carDescription: {
        type: DataTypes.STRING(100),
        field: 'CAR_DESCRIPTION'
    },
    startUtc: {
        type: DataTypes.DATE,
        field: 'START_UTC'
    },
    endUtc: {
        type: DataTypes.DATE,
        field: 'END_UTC'
    },
    sessionType: {
        type: DataTypes.CHAR(1),
        field: 'SESSION_TYPE'
    },
    locationStart: {
        type: DataTypes.STRING(1000),
        field: 'LOCATION_START'
    },
    locationEnd: {
        type: DataTypes.STRING(1000),
        field: 'LOCATION_END'
    },
    cost: {
        type: DataTypes.DECIMAL,
        field: 'COST'
    },
    distance: {
        type: DataTypes.DECIMAL,
        field: 'DISTANCE'
    },
    timeTraveled: {
        type: DataTypes.DECIMAL,
        field: 'TIME_TRAVELED'
    }
}, {
    sequelize,
    modelName: 'SessionView',
    tableName: 'V_SESSIONS',
    timestamps: false
});

export default SessionView;
