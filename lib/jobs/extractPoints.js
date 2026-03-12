import { Location, LocationData, sequelize } from '@/lib/models';
import { Op } from 'sequelize';
import { calculateDistance } from '@/lib/gpsUtils';

export async function runExtractPointsJob() {
    try {
        // 1. Delete empty locations
        await Location.destroy({
            where: {
                timestampUtcStart: {
                    [Op.eq]: sequelize.col('timestampUtcEnd')
                }
            }
        });

        // 2. Get distinct devices
        const rawDevices = await LocationData.findAll({
            attributes: [
                [sequelize.fn('DISTINCT', sequelize.col('deviceId')), 'deviceId']
            ],
            order: [['deviceId', 'ASC']],
            raw: true
        });
        const devices = rawDevices.map(r => r.deviceId);

        const C_MAX_RADIUS = 1000;
        let totalSegmentsInserted = 0;

        for (const deviceId of devices) {
            // Find the last closed end ts:
            // This is the max timestamp strictly excluding the row with the maximum ID.
            const maxIdRow = await Location.findOne({
                attributes: ['id'],
                where: { deviceId },
                order: [['id', 'DESC']]
            });

            let lastClosedEndTs = null;
            if (maxIdRow) {
                const lastClosedRow = await Location.findOne({
                    attributes: ['timestampUtcEnd'],
                    where: {
                        deviceId,
                        id: { [Op.ne]: maxIdRow.id }
                    },
                    order: [['timestampUtcEnd', 'DESC']]
                });
                if (lastClosedRow) {
                    lastClosedEndTs = lastClosedRow.timestampUtcEnd;
                }
            }

            // Delete only the current open segment (the one with the max timestamp)
            const maxTimestampRow = await Location.findOne({
                attributes: ['timestampUtcEnd'],
                where: { deviceId },
                order: [['timestampUtcEnd', 'DESC']]
            });
            if (maxTimestampRow) {
                await Location.destroy({
                    where: {
                        deviceId,
                        timestampUtcEnd: maxTimestampRow.timestampUtcEnd
                    }
                });
            }

            // Get points
            const pointsWhere = {
                deviceId,
                latitude: { [Op.not]: null },
                longitude: { [Op.not]: null }
            };

            if (lastClosedEndTs) {
                pointsWhere.timestampUtc = { [Op.gt]: lastClosedEndTs };
            }

            const points = await LocationData.findAll({
                attributes: ['latitude', 'longitude', 'altitude', 'timestampUtc'],
                where: pointsWhere,
                order: [['timestampUtc', 'ASC']],
                raw: true
            });

            let openStartTs = null;
            let openLat = null, openLon = null;
            let openSumLat = 0, openSumLon = 0, openSumAlt = 0;
            let openCount = 0;
            let latestTs = null;

            const segmentsToInsert = [];

            for (const loc of points) {
                latestTs = loc.timestampUtc;
                const alt = loc.altitude || 0;

                if (!openStartTs) {
                    openStartTs = loc.timestampUtc;
                    openLat = loc.latitude;
                    openLon = loc.longitude;
                    openSumLat = loc.latitude;
                    openSumLon = loc.longitude;
                    openSumAlt = alt;
                    openCount = 1;
                } else {
                    const dist = calculateDistance(openLat, openLon, loc.latitude, loc.longitude);

                    if (dist > C_MAX_RADIUS) {
                        segmentsToInsert.push({
                            deviceId,
                            timestampUtcStart: openStartTs,
                            timestampUtcEnd: loc.timestampUtc,
                            latitude: Number((openSumLat / openCount).toFixed(8)),
                            longitude: Number((openSumLon / openCount).toFixed(8)),
                            altitude: Number((openSumAlt / openCount).toFixed(2))
                        });

                        openStartTs = loc.timestampUtc;
                        openLat = loc.latitude;
                        openLon = loc.longitude;
                        openSumLat = loc.latitude;
                        openSumLon = loc.longitude;
                        openSumAlt = alt;
                        openCount = 1;
                    } else {
                        openSumLat += loc.latitude;
                        openSumLon += loc.longitude;
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
