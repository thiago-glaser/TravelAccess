import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class SessionCalc extends Model {}

SessionCalc.init({
    id: { type: DataTypes.CHAR(36), primaryKey: true, field: 'SESSION_ID' },
    geocodeStart: { type: DataTypes.CHAR(32), field: 'GEOCODE_START' },
    geocodeEnd: { type: DataTypes.CHAR(32), field: 'GEOCODE_END' },
    startLatitude: { type: DataTypes.DECIMAL, field: 'START_LATITUDE' },
    startLongitude: { type: DataTypes.DECIMAL, field: 'START_LONGITUDE' },
    startLocationUtc: { type: DataTypes.DATE, field: 'START_LOCATION_UTC' },
    endLatitude: { type: DataTypes.DECIMAL, field: 'END_LATITUDE' },
    endLongitude: { type: DataTypes.DECIMAL, field: 'END_LONGITUDE' },
    endLocationUtc: { type: DataTypes.DATE, field: 'END_LOCATION_UTC' }
}, {
    sequelize,
    modelName: 'SessionCalc',
    tableName: 'V_SESSION_CALC',
    timestamps: false
});

export default SessionCalc;
