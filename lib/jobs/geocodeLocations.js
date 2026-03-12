import { Location, LocationGeocode, SessionData, sequelize } from '@/lib/models';
import { QueryTypes } from 'sequelize';
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

export async function runGeocodeLocationsJob() {
    try {
        const apiKey = process.env.GEOAPIFY_API_KEY;

        if (!apiKey) {
            console.log('No GEOAPIFY_API_KEY found in environment variables.');
            return { error: 'No API_KEY provided' };
        }

        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        let callCount = 0;

        // 1. GEOCODE_FIRST_10_LOCATIONS
        const locationsQuery = `
            SELECT l.ID as "ID", l.LATITUDE as "LATITUDE", l.LONGITUDE as "LONGITUDE", l.timestamp_utc_start as "TIMESTAMP_UTC_START"
            FROM LOCATION l
            WHERE l.LOCATION_GEOCODE_ID IS NULL
              AND l.ID <> (
                  SELECT MAX(m.ID) KEEP (DENSE_RANK LAST ORDER BY m.TIMESTAMP_UTC_START)
                  FROM LOCATION m
                  WHERE m.DEVICE_ID = l.DEVICE_ID
              )
            ORDER BY l.timestamp_utc_start DESC
            FETCH FIRST 10 ROWS ONLY
        `;

        const locResult = await sequelize.query(locationsQuery, { type: QueryTypes.SELECT });

        for (const loc of locResult) {
            if (callCount > 0) await sleep(500); // Wait 500ms to respect rate limit of approx 2/sec
            callCount++;

            const feat = await getGeocodeJSON(loc.LATITUDE, loc.LONGITUDE, apiKey);
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
                console.log('[Geocode] NEW -> ' + feat.formatted);
            } else {
                geocodeId = existingGeocode.id;
                console.log('[Geocode] REUSE -> ' + feat.formatted);
            }

            if (geocodeId) {
                await Location.update(
                    { locationGeocodeId: geocodeId },
                    { where: { id: loc.ID } }
                );
            }
        }

        // 2. GEOCODE_SESSION
        const sessionsQuery = `
            SELECT 
            SESSION_ID AS "ID",
            GEOCODE_START AS "GEOCODE_START",
            START_LATITUDE AS "LATITUDE",
            START_LONGITUDE AS "LONGITUDE",
            'S' AS "STATUS"
            FROM V_SESSION_CALC
            WHERE GEOCODE_START IS NULL AND START_LOCATION_UTC IS NOT NULL
            UNION ALL 
            SELECT 
            SESSION_ID AS "ID",
            GEOCODE_END AS "GEOCODE_END",
            END_LATITUDE AS "LATITUDE",
            END_LONGITUDE AS "LONGITUDE",
            'E' AS "STATUS"
            FROM V_SESSION_CALC
            WHERE GEOCODE_END IS NULL AND END_LOCATION_UTC IS NOT NULL
        `;

        const sessionsResult = await sequelize.query(sessionsQuery, { type: QueryTypes.SELECT });

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
