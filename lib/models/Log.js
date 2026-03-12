import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class Log extends Model {}

Log.init({

    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4, field: 'ID' },
    dateTime: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'DATE_TIME' },
    message: { type: DataTypes.STRING(2000), field: 'MESSAGE' }
    
}, {
    sequelize,
    modelName: 'Log',
    tableName: 'LOG',
    timestamps: false,
    
    
});

export default Log;
