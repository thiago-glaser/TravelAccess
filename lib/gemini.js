import { LocationData, LocationGeocode, SessionData, SessionView, SessionAiDescription, sequelize } from '@/lib/models';
import { Op } from 'sequelize';
import { calculateTotalDistance, formatDuration, filterLocationsByDistance } from '@/lib/gpsUtils';

/**
 * Format a date/time into a specified timezone.
 * Uses native Intl.DateTimeFormat (supported in Node.js 18+ and modern browsers).
 *
 * @param {Date|string} dateVal - Date to format
 * @param {string} timeZone - IANA timezone (e.g. 'America/Sao_Paulo')
 * @param {'full'|'timeOnly'} formatType - Format mode
 * @returns {string} Formatted date/time in local time
 */
export function formatInTimezone(dateVal, timeZone = 'America/Sao_Paulo', formatType = 'full') {
    if (!dateVal) return '';
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    try {
        if (formatType === 'timeOnly') {
            return new Intl.DateTimeFormat('en-GB', {
                timeZone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).format(d);
        }
        return new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).format(d).replace(',', '');
    } catch {
        return d.toISOString().replace('T', ' ').substring(0, 19);
    }
}

/**
 * Call the Google Gemini API to generate text based on a prompt.
 * Uses native fetch so no extra dependencies are required.
 * Defaults to 'gemini-3.8-flash'.
 */
export async function callGeminiApi(prompt, model = process.env.GEMINI_MODEL || 'gemini-3.8-flash') {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in environment variables.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const payload = {
        contents: [
            {
                role: 'user',
                parts: [{ text: prompt }]
            }
        ],
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 3000
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidate) {
        throw new Error('Gemini API returned an empty response or unexpected structure.');
    }

    return candidate.trim();
}

/**
 * Analyzes session telemetry (GPS points + timestamps) and generates
 * a comprehensive resume/summary of the trip using Google Gemini,
 * saving the result to the SESSION_AI_DESCRIPTION table.
 *
 * @param {string} sessionId - The UUID/ID of the SESSION_DATA row.
 * @param {object} options - Optional overrides (locale, model, tz).
 */
export async function generateSessionSummary(sessionId, options = {}) {
    if (!sessionId) {
        throw new Error('sessionId is required to generate session summary.');
    }

    // 1. Fetch Session details
    const session = await SessionData.findOne({
        where: { id: sessionId, isDeleted: 0 },
        raw: true
    });

    if (!session) {
        console.warn(`[Gemini AI] Session ${sessionId} not found or deleted.`);
        return null;
    }

    // 2. Resolve local timezone
    let tz = options.tz || options.timezone || null;

    if (!tz && (session.geocodeStart || session.geocodeEnd)) {
        const geoId = session.geocodeStart || session.geocodeEnd;
        const geo = await LocationGeocode.findOne({
            where: { id: geoId },
            attributes: ['timezoneName'],
            raw: true
        }).catch(() => null);
        if (geo?.timezoneName) {
            tz = geo.timezoneName;
        }
    }

    if (!tz) {
        tz = process.env.APP_TIMEZONE || 'America/Sao_Paulo';
    }

    // Attempt to get friendly location / vehicle names from SessionView if available
    const sessionView = await SessionView.findOne({
        where: { id: sessionId },
        raw: true
    }).catch(() => null);

    const deviceId = session.deviceId || session.DEVICE_ID;
    const startUtc = session.startUtc || session.START_UTC;
    const endUtc = session.endUtc || session.END_UTC || new Date();
    const carDescription = sessionView?.carDescription || session.carId || 'Vehicle';
    const startLocation = sessionView?.locationStart || null;
    const endLocation = sessionView?.locationEnd || null;

    // 3. Fetch LocationData points for this session
    const rawPoints = await LocationData.findAll({
        attributes: ['latitude', 'longitude', 'altitude', 'timestampUtc'],
        where: {
            deviceId,
            timestampUtc: {
                [Op.gte]: startUtc,
                [Op.lte]: endUtc
            }
        },
        order: [['timestampUtc', 'ASC']],
        raw: true
    });

    if (!rawPoints || rawPoints.length === 0) {
        console.log(`[Gemini AI] No GPS points found for session ${sessionId} (${startUtc} - ${endUtc}).`);
    }

    // 4. Format and sample points to build trip telemetry insights
    const locations = rawPoints.map(p => ({
        lat: Number(p.latitude),
        lng: Number(p.longitude),
        date: p.timestampUtc instanceof Date ? p.timestampUtc.toISOString() : String(p.timestampUtc)
    }));

    // Filter noise (at least 10m movement) for distance calculation
    const filteredPoints = filterLocationsByDistance(locations, 10);
    const totalDistanceMeters = calculateTotalDistance(filteredPoints);
    const totalDistanceKm = (totalDistanceMeters / 1000).toFixed(2);

    const startTimeMs = new Date(startUtc).getTime();
    const endTimeMs = new Date(endUtc).getTime();
    const durationMs = Math.max(0, endTimeMs - startTimeMs);
    const durationFormatted = formatDuration(durationMs);

    // Sample waypoints so prompt stays concise and focused (~30-50 points max)
    // Note: waypoints are strictly formatted in local time
    const sampleTarget = 40;
    const step = Math.max(1, Math.floor(locations.length / sampleTarget));
    const sampledWaypoints = [];
    for (let i = 0; i < locations.length; i += step) {
        sampledWaypoints.push({
            time: formatInTimezone(locations[i].date, tz, 'timeOnly'),
            lat: locations[i].lat.toFixed(5),
            lng: locations[i].lng.toFixed(5)
        });
    }

    // Always ensure final point is in the sampled list
    if (locations.length > 1) {
        const last = locations[locations.length - 1];
        sampledWaypoints.push({
            time: formatInTimezone(last.date, tz, 'timeOnly'),
            lat: last.lat.toFixed(5),
            lng: last.lng.toFixed(5)
        });
    }

    const waypointsText = sampledWaypoints.length > 0
        ? sampledWaypoints.map(w => `• [${w.time}] (${w.lat}, ${w.lng})`).join('\n')
        : 'No intermediate GPS telemetry points recorded.';

    const startLocal = formatInTimezone(startUtc, tz, 'full');
    const endLocal = formatInTimezone(endUtc, tz, 'full');

    const prompt = `You are an expert vehicle telemetry and travel assistant.
Analyze the following travel session data and write a clear, informative, and engaging summary/resume of this trip.

=== TRIP TELEMETRY DATA ===
- Vehicle / Car:             ${carDescription}
- Session Start (Local Time): ${startLocal} (${tz}) ${startLocation ? `(Location: ${startLocation})` : ''}
- Session End (Local Time):   ${endLocal} (${tz}) ${endLocation ? `(Location: ${endLocation})` : ''}
- Duration:                  ${durationFormatted} (${Math.round(durationMs / 60000)} minutes)
- Total Distance:            ${totalDistanceKm} km
- Total Raw GPS Points:      ${locations.length} points recorded

=== SAMPLE OF ROUTE WAYPOINTS (Local Time: ${tz}) ===
${waypointsText}

=== INSTRUCTIONS ===
1. Local Time (MANDATORY):
   - All timestamps and waypoints above are already in the local timezone (${tz}).
   - You MUST ALWAYS use local time in your description for all timestamps, start/end times, driving intervals, and stops.
   - NEVER mention "UTC", never output "UTC", and never convert or shift times to UTC.

2. Units of Distance (STRICT RULE):
   - Exclusively and ONLY use kilometers (km) for all distances (e.g., "${totalDistanceKm} km", "0,5 km").
   - NEVER use miles (mi), meters (m), or feet to express any distance. Even for very short distances, express them in fractions of kilometers (e.g. "0,2 km", NOT "200 metros").
   - For speeds, only use km/h.

3. Completeness & Length:
   - Provide a complete, fully finished travel resume.
   - Never cut off mid-sentence or mid-thought; conclude all paragraphs cleanly.
   - Keep the total response between 1,200 and 3,000 characters (strictly under 4,000 characters).

4. Structure & Language:
   - Trip overview: Departure & arrival locations, trip purpose/context (commute, road trip, local errand), total distance in km and duration.
   - Route and movement details: Main streets, avenues, or highways traversed, and any notable stops or stationary periods observed from timestamps/coordinates.
   - Driving flow: Pacing, continuity, and driving characteristics.
   - Language: If coordinates or locations indicate Brazil or Portuguese language context, write the description entirely in Portuguese (pt-BR); otherwise write in English.`;

    // 5. Call Gemini
    console.log(`[Gemini AI] Calling Gemini for session ${sessionId} (${locations.length} points, tz: ${tz})...`);
    const aiDescription = await callGeminiApi(prompt, options.model);

    // 6. Save into SESSION_AI_DESCRIPTION table
    // Ensure table exists (creates table in MySQL if not exists)
    await SessionAiDescription.sync().catch(err => {
        console.warn('[Gemini AI] SessionAiDescription sync warning:', err.message);
    });

    const truncatedDescription = aiDescription.slice(0, 4000);

    await SessionAiDescription.upsert({
        sessionDataId: sessionId,
        description: truncatedDescription,
        isDeleted: 0,
        updatedAt: new Date()
    });

    console.log(`[Gemini AI] Successfully generated and stored description for session ${sessionId}.`);
    return {
        sessionId,
        description: truncatedDescription
    };
}

