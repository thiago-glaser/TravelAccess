import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class SchedulerLog extends Model {}

SchedulerLog.init({

    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4, field: 'ID' },
    jobName: { type: DataTypes.STRING(100), field: 'JOB_NAME' },
    runDate: { type: DataTypes.DATE, field: 'RUN_DATE' },
    rowsUpdated: { type: DataTypes.INTEGER, field: 'ROWS_UPDATED' },
    notes: { type: DataTypes.STRING(4000), field: 'NOTES' }
    
}, {
    sequelize,
    modelName: 'SchedulerLog',
    tableName: 'SCHEDULER_LOG',
    timestamps: false,
    
    
});

export default SchedulerLog;
