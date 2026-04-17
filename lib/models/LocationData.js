import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class LocationData extends Model { }

LocationData.init({

    deviceId: { type: DataTypes.STRING(20), allowNull: false, primaryKey: true, field: 'DEVICE_ID' },
    timestampUtc: { type: DataTypes.DATE(3), allowNull: false, primaryKey: true, field: 'TIMESTAMP_UTC' },
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
