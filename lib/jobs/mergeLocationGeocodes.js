import { oracledb } from '@/lib/db';

const dbConfig = {
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectionString: process.env.ORACLE_CONNECTION_STRING,
};

export async function runMergeLocationGeocodesJob() {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        const targetGeocodeId = '4479335CB9F43EF3E063020011ACF2F3';

        // The list of geocode IDs that need to be merged into the target
        const sourceGeocodeIds = [
            '4479335CB9A33EF3E063020011ACF2F3',
            '4479335CBAF13EF3E063020011ACF2F3',
            '4479335CBCA93EF3E063020011ACF2F3',
            '4479335CBD253EF3E063020011ACF2F3',
            '4479335CBC5F3EF3E063020011ACF2F3',
            '4479335CBAFF3EF3E063020011ACF2F3',
            '4479335CBDC63EF3E063020011ACF2F3',
            '454B219E17052C3FE063020011AC1047',
            '454FECE27659651AE063020011AC245A',
            '45B40D5253542890E063020011AC0D86',
            '4594DD36FFE6EB70E063020011AC250D',
            '45A74DD6F088403DE063020011ACE290',
            '454FECE2762A651AE063020011AC245A',
            '45C0DFCCD1D6C020E063020011ACC48F',
            '45F2570B794284A8E063020011AC2A9F'
        ];

        // Let's create an IN clause string: :id0, :id1, etc.
        const binds = {};
        const inClauseMarks = sourceGeocodeIds.map((id, index) => {
            const bindKey = `id${index}`;
            binds[bindKey] = id;
            return `:${bindKey}`;
        }).join(', ');

        binds.targetId = targetGeocodeId;

        // 1. Update LOCATION table
        const updateLocationSql = `
            UPDATE location
            SET location_geocode_id = :targetId
            WHERE location_geocode_id IN (${inClauseMarks})
        `;
        const resultLoc = await connection.execute(updateLocationSql, binds, { autoCommit: true });

        // 2. Update SESSION_DATA geocode_start
        const updateSessionStartSql = `
            UPDATE session_data
            SET geocode_start = :targetId
            WHERE geocode_start IN (${inClauseMarks})
        `;
        const resultSessStart = await connection.execute(updateSessionStartSql, binds, { autoCommit: true });

        // 3. Update SESSION_DATA geocode_end
        const updateSessionEndSql = `
            UPDATE session_data
            SET geocode_end = :targetId
            WHERE geocode_end IN (${inClauseMarks})
        `;
        const resultSessEnd = await connection.execute(updateSessionEndSql, binds, { autoCommit: true });

        return {
            status: 'success',
            locationsUpdated: resultLoc.rowsAffected,
            sessionsStartUpdated: resultSessStart.rowsAffected,
            sessionsEndUpdated: resultSessEnd.rowsAffected
        };

    } catch (err) {
        console.error('Error in runMergeLocationGeocodesJob:', err);
        throw err;
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { }
        }
    }
}
