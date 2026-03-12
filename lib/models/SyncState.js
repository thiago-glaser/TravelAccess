import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.js';

class SyncState extends Model {}

SyncState.init({

    id: { type: DataTypes.STRING(50), primaryKey: true, field: 'ID' },
    lastSync: { type: DataTypes.DATE, field: 'LAST_SYNC' },
    updatedAt: { type: DataTypes.DATE, field: 'UPDATED_AT' }
    
}, {
    sequelize,
    modelName: 'SyncState',
    tableName: 'SYNC_STATE',
    timestamps: false,
    
    updatedAt: 'updatedAt'
});

export default SyncState;
