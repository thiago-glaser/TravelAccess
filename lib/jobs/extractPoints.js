import { getConnection, oracledb } from '@/lib/db';
import { calculateDistance } from '@/lib/gpsUtils';

export async function runExtractPointsJob() {
    let connection;
    try {
        connection = await getConnection();

        // 1. Delete empty locations
        await connection.execute(`DELETE FROM location l WHERE l.timestamp_utc_start=l.timestamp_utc_end`, [], { autoCommit: true });

        // 2. Get distinct devices
        const rawDevices = await connection.execute(
            `SELECT DISTINCT DEVICE_ID FROM LOCATION_DATA ORDER BY DEVICE_ID`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const devices = rawDevices.rows.map(r => r.DEVICE_ID);

        const C_MAX_RADIUS = 1000;
        let totalSegmentsInserted = 0;

        for (const deviceId of devices) {
            // Find the last closed end ts
            const lastClosedResult = await connection.execute(`
                SELECT ID, TIMESTAMP_UTC_END
                FROM LOCATION
                WHERE DEVICE_ID = :deviceId
                AND TIMESTAMP_UTC_END = (
                    SELECT MAX(TIMESTAMP_UTC_END)
                    FROM LOCATION l2
                    WHERE l2.DEVICE_ID = :deviceId
                    AND l2.ID <> (SELECT MAX(ID) FROM LOCATION l3 WHERE l3.DEVICE_ID = :deviceId)
                )
            `, { deviceId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

            let lastClosedEndTs = null;
            if (lastClosedResult.rows.length > 0) {
                lastClosedEndTs = lastClosedResult.rows[0].TIMESTAMP_UTC_END;
            }

            // Delete only the current open segment
            await connection.execute(`
                DELETE FROM LOCATION
                WHERE DEVICE_ID = :deviceId
                AND TIMESTAMP_UTC_END = (SELECT MAX(TIMESTAMP_UTC_END) FROM LOCATION WHERE DEVICE_ID = :deviceId)
            `, { deviceId }, { autoCommit: true });

            // Get points
            let pointsQuery = `
                SELECT LATITUDE, LONGITUDE, ALTITUDE, TIMESTAMP_UTC
                FROM LOCATION_DATA
                WHERE DEVICE_ID = :deviceId
                AND LATITUDE IS NOT NULL
                AND LONGITUDE IS NOT NULL
            `;
            const binds = { deviceId };

            if (lastClosedEndTs) {
                pointsQuery += ` AND TIMESTAMP_UTC > :lastClosedEndTs`;
                binds.lastClosedEndTs = lastClosedEndTs;
            }

            pointsQuery += ` ORDER BY TIMESTAMP_UTC`;

            const pointsResult = await connection.execute(pointsQuery, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
            const points = pointsResult.rows;

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
                        segmentsToInsert.push([
                            deviceId,
                            openStartTs,
                            loc.TIMESTAMP_UTC,
                            Number((openSumLat / openCount).toFixed(8)),
                            Number((openSumLon / openCount).toFixed(8)),
                            Number((openSumAlt / openCount).toFixed(2))
                        ]);

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
                segmentsToInsert.push([
                    deviceId,
                    openStartTs,
                    latestTs,
                    Number((openSumLat / openCount).toFixed(8)),
                    Number((openSumLon / openCount).toFixed(8)),
                    Number((openSumAlt / openCount).toFixed(2))
                ]);
            }

            if (segmentsToInsert.length > 0) {
                totalSegmentsInserted += segmentsToInsert.length;
                const insertSql = `
                    INSERT INTO LOCATION (ID, DEVICE_ID, TIMESTAMP_UTC_START, TIMESTAMP_UTC_END, LATITUDE, LONGITUDE, ALTITUDE)
                    VALUES (SYS_GUID(), :1, :2, :3, :4, :5, :6)
                `;

                await connection.executeMany(insertSql, segmentsToInsert, { autoCommit: true });
            }
        }

        return { status: 'success', devicesProcessed: devices.length, segmentsInserted: totalSegmentsInserted };
    } catch (err) {
        console.error('Error extracting points:', err);
        throw err;
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { }
        }
    }
}
