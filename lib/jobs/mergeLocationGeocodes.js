import { SessionData } from '@/lib/models';
import { Op } from 'sequelize';

export async function runMergeLocationGeocodesJob() {
    try {
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

        // 2. Update SESSION_DATA geocode_start
        const [sessionsStartUpdated] = await SessionData.update(
            { geocodeStart: targetGeocodeId },
            { where: { geocodeStart: { [Op.in]: sourceGeocodeIds } } }
        );

        // 3. Update SESSION_DATA geocode_end
        const [sessionsEndUpdated] = await SessionData.update(
            { geocodeEnd: targetGeocodeId },
            { where: { geocodeEnd: { [Op.in]: sourceGeocodeIds } } }
        );

        return {
            status: 'success',
            sessionsStartUpdated,
            sessionsEndUpdated
        };

    } catch (err) {
        console.error('Error in runMergeLocationGeocodesJob:', err);
        throw err;
    }
}
