import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class LocationData extends Model {}

LocationData.init({

    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4, field: 'ID' },
    deviceId: { type: DataTypes.STRING(20), allowNull: false, field: 'DEVICE_ID' },
    timestampUtc: { type: DataTypes.DATE, field: 'TIMESTAMP_UTC' },
    latitude: { type: DataTypes.DECIMAL, field: 'LATITUDE' },
    longitude: { type: DataTypes.DECIMAL, field: 'LONGITUDE' },
    altitude: { type: DataTypes.DECIMAL, field: 'ALTITUDE' }
    
}, {
    sequelize,
    modelName: 'LocationData',
    tableName: 'LOCATION_DATA',
    timestamps: false
});

export default LocationData;
