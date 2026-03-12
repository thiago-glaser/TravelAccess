import { Location, LocationData, sequelize } from '@/lib/models';
import { QueryTypes } from 'sequelize';
import { calculateDistance } from '@/lib/gpsUtils';

export async function runExtractPointsJob() {
    try {
        // 1. Delete empty locations
        await sequelize.query(
            `DELETE FROM location l WHERE l.timestamp_utc_start=l.timestamp_utc_end`
        );

        // 2. Get distinct devices
        const rawDevices = await sequelize.query(
            `SELECT DISTINCT DEVICE_ID as "DEVICE_ID" FROM LOCATION_DATA ORDER BY DEVICE_ID`,
            { type: QueryTypes.SELECT }
        );
        const devices = rawDevices.map(r => r.DEVICE_ID);

        const C_MAX_RADIUS = 1000;
        let totalSegmentsInserted = 0;

        for (const deviceId of devices) {
            // Find the last closed end ts
            const lastClosedResult = await sequelize.query(`
                SELECT ID as "ID", TIMESTAMP_UTC_END as "TIMESTAMP_UTC_END"
                FROM LOCATION
                WHERE DEVICE_ID = :deviceId
                AND TIMESTAMP_UTC_END = (
                    SELECT MAX(TIMESTAMP_UTC_END)
                    FROM LOCATION l2
                    WHERE l2.DEVICE_ID = :deviceId
                    AND l2.ID <> (SELECT MAX(ID) FROM LOCATION l3 WHERE l3.DEVICE_ID = :deviceId)
                )
            `, {
                replacements: { deviceId },
                type: QueryTypes.SELECT
            });

            let lastClosedEndTs = null;
            if (lastClosedResult.length > 0) {
                lastClosedEndTs = lastClosedResult[0].TIMESTAMP_UTC_END;
            }

            // Delete only the current open segment
            await sequelize.query(`
                DELETE FROM LOCATION
                WHERE DEVICE_ID = :deviceId
                AND TIMESTAMP_UTC_END = (SELECT MAX(TIMESTAMP_UTC_END) FROM LOCATION WHERE DEVICE_ID = :deviceId)
            `, {
                replacements: { deviceId }
            });

            // Get points
            let pointsQuery = `
                SELECT LATITUDE as "LATITUDE", LONGITUDE as "LONGITUDE", ALTITUDE as "ALTITUDE", TIMESTAMP_UTC as "TIMESTAMP_UTC"
                FROM LOCATION_DATA
                WHERE DEVICE_ID = :deviceId
                AND LATITUDE IS NOT NULL
                AND LONGITUDE IS NOT NULL
            `;
            const replacements = { deviceId };

            if (lastClosedEndTs) {
                pointsQuery += ` AND TIMESTAMP_UTC > :lastClosedEndTs`;
                replacements.lastClosedEndTs = lastClosedEndTs;
            }

            pointsQuery += ` ORDER BY TIMESTAMP_UTC`;

            const points = await sequelize.query(pointsQuery, {
                replacements,
                type: QueryTypes.SELECT
            });

            let openStartTs = null;
            let openLat = null, openLon = null;
            let openSumLat = 0, openSumLon = 0, openSumAlt = 0;
            let openCount = 0;
            let latestTs = null;

            const segmentsToInsert = [];

            for (const loc of points) {
                latestTs = loc.TIMESTAMP_UTC;
                const alt = loc.ALTITUDE || 0;

                if (!openStartTs) {
                    openStartTs = loc.TIMESTAMP_UTC;
                    openLat = loc.LATITUDE;
                    openLon = loc.LONGITUDE;
                    openSumLat = loc.LATITUDE;
                    openSumLon = loc.LONGITUDE;
                    openSumAlt = alt;
                    openCount = 1;
                } else {
                    const dist = calculateDistance(openLat, openLon, loc.LATITUDE, loc.LONGITUDE);

                    if (dist > C_MAX_RADIUS) {
                        segmentsToInsert.push({
                            deviceId,
                            timestampUtcStart: openStartTs,
                            timestampUtcEnd: loc.TIMESTAMP_UTC,
                            latitude: Number((openSumLat / openCount).toFixed(8)),
                            longitude: Number((openSumLon / openCount).toFixed(8)),
                            altitude: Number((openSumAlt / openCount).toFixed(2))
                        });

                        openStartTs = loc.TIMESTAMP_UTC;
                        openLat = loc.LATITUDE;
                        openLon = loc.LONGITUDE;
                        openSumLat = loc.LATITUDE;
                        openSumLon = loc.LONGITUDE;
                        openSumAlt = alt;
                        openCount = 1;
                    } else {
                        openSumLat += loc.LATITUDE;
                        openSumLon += loc.LONGITUDE;
                        openSumAlt += alt;
                        openCount += 1;
                    }
                }
            }

            if (openStartTs) {
                segmentsToInsert.push({
                    deviceId,
                    timestampUtcStart: openStartTs,
                    timestampUtcEnd: latestTs,
                    latitude: Number((openSumLat / openCount).toFixed(8)),
                    longitude: Number((openSumLon / openCount).toFixed(8)),
                    altitude: Number((openSumAlt / openCount).toFixed(2))
                });
            }

            if (segmentsToInsert.length > 0) {
                totalSegmentsInserted += segmentsToInsert.length;
                await Location.bulkCreate(segmentsToInsert);
            }
        }

        return { status: 'success', devicesProcessed: devices.length, segmentsInserted: totalSegmentsInserted };
    } catch (err) {
        console.error('Error extracting points:', err);
        throw err;
    }
}
