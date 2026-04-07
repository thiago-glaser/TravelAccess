import { LocationGeocode, SessionData, SessionCalc, sequelize } from '@/lib/models';
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

        // 2. GEOCODE_SESSION
        const sessionsStart = await SessionCalc.findAll({
            include: [{
                model: SessionData,
                as: 'sessionData',
                attributes: [],
                where: { isDeleted: { [Op.or]: [0, null] } }
            }],
            where: { 
                geocodeStart: null, 
                startLocationUtc: { [Op.not]: null },
                deviceId: { [Op.ne]: 'DEMO-GPS-01' }
            }
        });

        const sessionsEnd = await SessionCalc.findAll({
            include: [{
                model: SessionData,
                as: 'sessionData',
                attributes: [],
                where: { isDeleted: { [Op.or]: [0, null] } }
            }],
            where: { 
                geocodeEnd: null, 
                endLocationUtc: { [Op.not]: null },
                deviceId: { [Op.ne]: 'DEMO-GPS-01' }
            }
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
