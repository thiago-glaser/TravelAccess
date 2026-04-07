import User from './User.js';
import Device from './Device.js';
import UserDevice from './UserDevice.js';
import ApiKey from './ApiKey.js';
import Fuel from './Fuel.js';
import Bluetooth from './Bluetooth.js';
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
import SessionView from './SessionView.js';
import SessionCalc from './SessionCalc.js';
import DemoAccessLog from './DemoAccessLog.js';
import PageUsageMonthly from './PageUsageMonthly.js';
import ExpenseType from './ExpenseType.js';
import OtherExpense from './OtherExpense.js';
import sequelize from '../sequelize.js';

// Setup defined Associations
// Maintenance <-> Car
Maintenance.belongsTo(Car, { foreignKey: 'carId', as: 'car' });
Car.hasMany(Maintenance, { foreignKey: 'carId', as: 'maintenanceEntries' });

// Insurance <-> Car
Insurance.belongsTo(Car, { foreignKey: 'carId', as: 'car' });
Car.hasMany(Insurance, { foreignKey: 'carId', as: 'insurances' });

// OtherExpense <-> Car
OtherExpense.belongsTo(Car, { foreignKey: 'carId', as: 'car' });
Car.hasMany(OtherExpense, { foreignKey: 'carId', as: 'otherExpenses' });

// OtherExpense <-> ExpenseType
OtherExpense.belongsTo(ExpenseType, { foreignKey: 'expenseTypeId', as: 'expenseType' });
ExpenseType.hasMany(OtherExpense, { foreignKey: 'expenseTypeId', as: 'expenses' });

// Bluetooth <-> Car
Bluetooth.belongsTo(Car, { foreignKey: 'carId', as: 'car' });
Car.hasMany(Bluetooth, { foreignKey: 'carId', as: 'bluetoothDevices' });

// Fuel <-> Car
Fuel.belongsTo(Car, { foreignKey: 'carId', as: 'car' });
Car.hasMany(Fuel, { foreignKey: 'carId', as: 'fuelEntries' });

// UserDevice <-> Device
UserDevice.belongsTo(Device, { foreignKey: 'deviceId', targetKey: 'deviceId', as: 'deviceInfo' });
Device.hasMany(UserDevice, { foreignKey: 'deviceId', sourceKey: 'deviceId', as: 'userDevices' });

// SessionView associations
SessionView.belongsTo(SessionData, { foreignKey: 'id', targetKey: 'id', as: 'sessionData' });
SessionView.belongsTo(Device, { foreignKey: 'deviceId', targetKey: 'deviceId', as: 'deviceInfo' });
SessionData.hasOne(SessionView, { foreignKey: 'id', sourceKey: 'id', as: 'sessionView' });

// SessionCalc associations
SessionCalc.belongsTo(SessionData, { foreignKey: 'id', targetKey: 'id', as: 'sessionData' });
SessionData.hasOne(SessionCalc, { foreignKey: 'id', sourceKey: 'id', as: 'sessionCalc' });

export {
    User,
    Device,
    UserDevice,
    ApiKey,
    Fuel,
    Bluetooth,
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
    SessionView,
    SessionCalc,
    DemoAccessLog,
    PageUsageMonthly,
    ExpenseType,
    OtherExpense,
    sequelize
};
