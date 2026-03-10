import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class SessionData extends Model {}

SessionData.init({

    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4, field: 'ID' },
    deviceId: { type: DataTypes.STRING(20), allowNull: false, field: 'DEVICE_ID' },
    carId: { type: DataTypes.CHAR(36), field: 'CAR_ID' },
    startUtc: { type: DataTypes.DATE, field: 'START_UTC' },
    endUtc: { type: DataTypes.DATE, field: 'END_UTC' },
    sessionType: { type: DataTypes.CHAR(1), field: 'SESSION_TYPE' },
    geocodeStart: { type: DataTypes.CHAR(32), field: 'GEOCODE_START' },
    geocodeEnd: { type: DataTypes.CHAR(32), field: 'GEOCODE_END' },
    cost: { type: DataTypes.DECIMAL, field: 'COST' },
    distance: { type: DataTypes.DECIMAL, field: 'DISTANCE' },
    timeTraveled: { type: DataTypes.DECIMAL, field: 'TIME_TRAVELED' },
    valueConfirmed: { type: DataTypes.CHAR(1), field: 'VALUE_CONFIRMED' },
    createdAt: { type: DataTypes.DATE, field: 'CREATED_AT' },
    updatedAt: { type: DataTypes.DATE, field: 'UPDATED_AT' },
    isDeleted: { type: DataTypes.INTEGER, defaultValue: 0, field: 'IS_DELETED' }
    
}, {
    sequelize,
    modelName: 'SessionData',
    tableName: 'SESSION_DATA',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default SessionData;
