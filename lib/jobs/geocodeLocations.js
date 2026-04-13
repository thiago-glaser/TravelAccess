import { LocationGeocode, SessionData, sequelize } from '@/lib/models';
import { Op } from 'sequelize';
import crypto from 'crypto';

async function getGeocodeJSON(lat, lon, apiKey) {
    const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${apiKey}`;
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Node.js',
                'Accept': 'application/json'
            }
        });
        if (!response.ok) {
            console.error(`Geoapify error: ${response.status} ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        if (data && data.features && data.features.length > 0) {
            return data.features[0].properties;
        }
        return null;
    } catch (err) {
        console.error('getGeocodeJSON exception:', err.message);
        return null;
    }
}

async function getClosestLocation(deviceId, targetTimeUtc) {
    const query = `
        (
            SELECT latitude, longitude, timestamp_utc 
            FROM LOCATION_DATA 
            WHERE device_id = :deviceId AND timestamp_utc <= :targetTimeUtc
            ORDER BY timestamp_utc DESC LIMIT 1
        )
        UNION ALL
        (
            SELECT latitude, longitude, timestamp_utc 
            FROM LOCATION_DATA 
            WHERE device_id = :deviceId AND timestamp_utc > :targetTimeUtc
            ORDER BY timestamp_utc ASC LIMIT 1
        )
    `;
    const result = await sequelize.query(query, {
        replacements: { deviceId, targetTimeUtc },
        type: sequelize.QueryTypes.SELECT
    });

    if (!result || result.length === 0) return null;

    const targetMs = new Date(targetTimeUtc).getTime();
    let closestRow = null;
    let minDiff = Infinity;

    for (const row of result) {
        const rowMs = new Date(row.timestamp_utc).getTime();
        const diff = Math.abs(targetMs - rowMs);
        if (diff < minDiff) {
            minDiff = diff;
            closestRow = row;
        }
    }

    return closestRow;
}

export async function runGeocodeLocationsJob() {
    try {
        const apiKey = process.env.GEOAPIFY_API_KEY;

        if (!apiKey) {
            console.log('No GEOAPIFY_API_KEY found in environment variables.');
            return { error: 'No API_KEY provided' };
        }

        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        let callCount = 0;

        // Fetch all SessionData rows that need geocoding
        const sessionsToGeocode = await SessionData.findAll({
            where: {
                [Op.or]: [
                    { geocodeStart: null },
                    { geocodeEnd: null, endUtc: { [Op.not]: null } }
                ],
                isDeleted: { [Op.or]: [0, null] },
                deviceId: { [Op.ne]: 'DEMO-GPS-01' }
            }
        });

        const sessionsResult = [];

        // Geocode limits: dynamically find closest valid coordinates
        for (const session of sessionsToGeocode) {
            if (!session.geocodeStart && session.startUtc) {
                const loc = await getClosestLocation(session.deviceId, session.startUtc);
                if (loc) {
                    sessionsResult.push({
                        ID: session.id,
                        LATITUDE: loc.latitude,
                        LONGITUDE: loc.longitude,
                        STATUS: 'S'
                    });
                }
            }

            if (!session.geocodeEnd && session.endUtc) {
                const loc = await getClosestLocation(session.deviceId, session.endUtc);
                if (loc) {
                    sessionsResult.push({
                        ID: session.id,
                        LATITUDE: loc.latitude,
                        LONGITUDE: loc.longitude,
                        STATUS: 'E'
                    });
                }
            }
        }

        for (const sess of sessionsResult) {
            if (callCount > 0) await sleep(500);
            callCount++;

            const feat = await getGeocodeJSON(sess.LATITUDE, sess.LONGITUDE, apiKey);
            if (!feat) continue;

            let geocodeId = null;
            const placeId = feat.place_id;

            const existingGeocode = await LocationGeocode.findOne({ where: { placeId } });

            if (!existingGeocode) {
                geocodeId = crypto.randomBytes(16).toString('hex').toUpperCase();

                await LocationGeocode.create({
                    id: geocodeId,
                    placeId: feat.place_id,
                    plusCode: feat.plus_code,
                    formattedAddress: feat.formatted,
                    addressLine1: feat.address_line1 || null,
                    addressLine2: feat.address_line2 || null,
                    housenumber: feat.housenumber || null,
                    street: feat.street || null,
                    suburb: feat.suburb || null,
                    city: feat.city || null,
                    postcode: feat.postcode || null,
                    county: feat.county || null,
                    state: feat.state || null,
                    country: feat.country || null,
                    resultType: feat.result_type || null,
                    geocodeDistanceM: feat.distance || null,
                    timezoneName: feat.timezone?.name || null,
                    timezoneOffsetStd: feat.timezone?.offset_STD || null,
                    timezoneOffsetDst: feat.timezone?.offset_DST || null,
                    geocodedAt: new Date()
                });
                console.log('[Geocode] NEW Session -> ' + feat.formatted);
            } else {
                geocodeId = existingGeocode.id;
                console.log('[Geocode] REUSE Session -> ' + feat.formatted);
            }

            if (geocodeId) {
                if (sess.STATUS === 'S') {
                    await SessionData.update(
                        { geocodeStart: geocodeId },
                        { where: { id: sess.ID } }
                    );
                } else {
                    await SessionData.update(
                        { geocodeEnd: geocodeId },
                        { where: { id: sess.ID } }
                    );
                }
            }
        }

        return { status: 'success', callsMade: callCount };

    } catch (err) {
        console.error('Error in runGeocodeLocationsJob:', err);
        throw err;
    }
}
