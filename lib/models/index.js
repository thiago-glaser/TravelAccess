import User from './User.js';
import Device from './Device.js';
import UserDevice from './UserDevice.js';
import ApiKey from './ApiKey.js';
import Fuel from './Fuel.js';
import Bluetooth from './Bluetooth.js';
import Location from './Location.js';
import LocationData from './LocationData.js';
import LocationGeocode from './LocationGeocode.js';
import SessionData from './SessionData.js';
import Log from './Log.js';
import Parameter from './Parameter.js';
import SchedulerLog from './SchedulerLog.js';
import SyncState from './SyncState.js';
import Car from './Car.js';
import Maintenance from './Maintenance.js';
import Insurance from './Insurance.js';
import sequelize from '../sequelize.js';

// Setup defined Associations
// Maintenance <-> Car
Maintenance.belongsTo(Car, { foreignKey: 'carId', as: 'car' });
Car.hasMany(Maintenance, { foreignKey: 'carId', as: 'maintenanceEntries' });

// Insurance <-> Car
Insurance.belongsTo(Car, { foreignKey: 'carId', as: 'car' });
Car.hasMany(Insurance, { foreignKey: 'carId', as: 'insurances' });

// Bluetooth <-> Car
Bluetooth.belongsTo(Car, { foreignKey: 'carId', as: 'car' });
Car.hasMany(Bluetooth, { foreignKey: 'carId', as: 'bluetoothDevices' });

// Fuel <-> Car
Fuel.belongsTo(Car, { foreignKey: 'carId', as: 'car' });
Car.hasMany(Fuel, { foreignKey: 'carId', as: 'fuelEntries' });

// UserDevice <-> Device
UserDevice.belongsTo(Device, { foreignKey: 'deviceId', targetKey: 'deviceId', as: 'deviceInfo' });
Device.hasMany(UserDevice, { foreignKey: 'deviceId', sourceKey: 'deviceId', as: 'userDevices' });

export {
    User,
    Device,
    UserDevice,
    ApiKey,
    Fuel,
    Bluetooth,
    Location,
    LocationData,
    LocationGeocode,
    SessionData,
    Log,
    Parameter,
    SchedulerLog,
    SyncState,
    Car,
    Maintenance,
    Insurance,
    sequelize
};
