import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class Location extends Model {}

Location.init({

    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4, field: 'ID' },
    deviceId: { type: DataTypes.STRING(20), allowNull: false, field: 'DEVICE_ID' },
    timestampUtcStart: { type: DataTypes.DATE, field: 'TIMESTAMP_UTC_START' },
    timestampUtcEnd: { type: DataTypes.DATE, field: 'TIMESTAMP_UTC_END' },
    latitude: { type: DataTypes.DECIMAL, field: 'LATITUDE' },
    longitude: { type: DataTypes.DECIMAL, field: 'LONGITUDE' },
    altitude: { type: DataTypes.DECIMAL, field: 'ALTITUDE' },
    locationGeocodeId: { type: DataTypes.CHAR(32), field: 'LOCATION_GEOCODE_ID' },
    createdAt: { type: DataTypes.DATE, field: 'CREATED_AT' },
    updatedAt: { type: DataTypes.DATE, field: 'UPDATED_AT' },
    isDeleted: { type: DataTypes.INTEGER, defaultValue: 0, field: 'IS_DELETED' }
    
}, {
    sequelize,
    modelName: 'Location',
    tableName: 'LOCATION',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default Location;
