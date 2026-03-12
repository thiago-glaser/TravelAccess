import { Location, LocationGeocode, SessionData, SessionCalc, sequelize } from '@/lib/models';
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
        // We fetch candidates that are not geocoded yet, ordered by timestamp descending.
        const pendingLocations = await Location.findAll({
            where: { locationGeocodeId: null },
            order: [['timestampUtcStart', 'DESC']],
            limit: 100
        });

        const locResult = [];
        for (const loc of pendingLocations) {
            // Check if this is the absolute latest location for its device. We want to skip the currently open/latest location.
            const newerLoc = await Location.findOne({
                where: {
                    deviceId: loc.deviceId,
                    [Op.or]: [
                        { timestampUtcStart: { [Op.gt]: loc.timestampUtcStart } },
                        { timestampUtcStart: loc.timestampUtcStart, id: { [Op.gt]: loc.id } }
                    ]
                }
            });

            // If a newer location was found, then this `loc` is NOT the latest, so we should geocode it.
            if (newerLoc) {
                locResult.push({
                    ID: loc.id,
                    LATITUDE: loc.latitude,
                    LONGITUDE: loc.longitude
                });
            }

            if (locResult.length >= 10) {
                break;
            }
        }

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
        const sessionsStart = await SessionCalc.findAll({
            where: { geocodeStart: null, startLocationUtc: { [Op.not]: null } }
        });

        const sessionsEnd = await SessionCalc.findAll({
            where: { geocodeEnd: null, endLocationUtc: { [Op.not]: null } }
        });

        const sessionsResult = [
            ...sessionsStart.map(s => ({
                ID: s.id,
                LATITUDE: s.startLatitude,
                LONGITUDE: s.startLongitude,
                STATUS: 'S'
            })),
            ...sessionsEnd.map(s => ({
                ID: s.id,
                LATITUDE: s.endLatitude,
                LONGITUDE: s.endLongitude,
                STATUS: 'E'
            }))
        ];

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
