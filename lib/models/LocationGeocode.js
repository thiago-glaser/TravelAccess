import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class LocationGeocode extends Model {}

LocationGeocode.init({

    id: { type: DataTypes.CHAR(32), primaryKey: true, field: 'ID' },
    placeId: { type: DataTypes.STRING(350), field: 'PLACE_ID' },
    plusCode: { type: DataTypes.STRING(20), field: 'PLUS_CODE' },
    plusCodeShort: { type: DataTypes.STRING(50), field: 'PLUS_CODE_SHORT' },
    formattedAddress: { type: DataTypes.STRING(500), field: 'FORMATTED_ADDRESS' },
    addressLine1: { type: DataTypes.STRING(200), field: 'ADDRESS_LINE1' },
    addressLine2: { type: DataTypes.STRING(200), field: 'ADDRESS_LINE2' },
    housenumber: { type: DataTypes.STRING(200), field: 'HOUSENUMBER' },
    street: { type: DataTypes.STRING(200), field: 'STREET' },
    suburb: { type: DataTypes.STRING(100), field: 'SUBURB' },
    city: { type: DataTypes.STRING(100), field: 'CITY' },
    postcode: { type: DataTypes.STRING(20), field: 'POSTCODE' },
    county: { type: DataTypes.STRING(100), field: 'COUNTY' },
    state: { type: DataTypes.STRING(100), field: 'STATE' },
    country: { type: DataTypes.STRING(100), field: 'COUNTRY' },
    resultType: { type: DataTypes.STRING(50), field: 'RESULT_TYPE' },
    geocodeDistanceM: { type: DataTypes.DECIMAL, field: 'GEOCODE_DISTANCE_M' },
    timezoneName: { type: DataTypes.STRING(50), field: 'TIMEZONE_NAME' },
    timezoneOffsetStd: { type: DataTypes.STRING(10), field: 'TIMEZONE_OFFSET_STD' },
    timezoneOffsetDst: { type: DataTypes.STRING(10), field: 'TIMEZONE_OFFSET_DST' },
    geocodedAt: { type: DataTypes.DATE, field: 'GEOCODED_AT' },
    createdAt: { type: DataTypes.DATE, field: 'CREATED_AT' },
    updatedAt: { type: DataTypes.DATE, field: 'UPDATED_AT' },
    isDeleted: { type: DataTypes.INTEGER, defaultValue: 0, field: 'IS_DELETED' }
    
}, {
    sequelize,
    modelName: 'LocationGeocode',
    tableName: 'LOCATION_GEOCODE',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

export default LocationGeocode;
