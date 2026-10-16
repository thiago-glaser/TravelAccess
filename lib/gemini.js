import { LocationData, SessionData, SessionView, SessionAiDescription, sequelize } from '@/lib/models';
import { Op } from 'sequelize';
import { calculateTotalDistance, formatDuration, filterLocationsByDistance } from '@/lib/gpsUtils';

/**
 * Call the Google Gemini API to generate text based on a prompt.
 * Uses native fetch so no extra dependencies are required.
 * Defaults to 'gemini-2.5-flash'.
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
            maxOutputTokens: 1200
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
 * @param {object} options - Optional overrides (locale, model).
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

    // 2. Fetch LocationData points for this session
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

    // 3. Format and sample points to build trip telemetry insights
    const locations = rawPoints.map(p => ({
        lat: Number(p.latitude),
        lng: Number(p.longitude),
        alt: p.altitude ? Number(p.altitude) : null,
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
    const sampleTarget = 40;
    const step = Math.max(1, Math.floor(locations.length / sampleTarget));
    const sampledWaypoints = [];
    for (let i = 0; i < locations.length; i += step) {
        sampledWaypoints.push({
            time: locations[i].date.replace('T', ' ').substring(11, 19) + ' UTC',
            lat: locations[i].lat.toFixed(5),
            lng: locations[i].lng.toFixed(5),
            alt: locations[i].alt !== null ? `${locations[i].alt}m` : null
        });
    }

    // Always ensure final point is in the sampled list
    if (locations.length > 1) {
        const last = locations[locations.length - 1];
        sampledWaypoints.push({
            time: last.date.replace('T', ' ').substring(11, 19) + ' UTC',
            lat: last.lat.toFixed(5),
            lng: last.lng.toFixed(5),
            alt: last.alt !== null ? `${last.alt}m` : null
        });
    }

    // 4. Construct the prompt for Gemini
    const waypointsText = sampledWaypoints.length > 0
        ? sampledWaypoints.map(w => `• [${w.time}] (${w.lat}, ${w.lng}${w.alt ? ', alt ' + w.alt : ''})`).join('\n')
        : 'No intermediate GPS telemetry points recorded.';

    const prompt = `You are an expert vehicle telemetry and travel assistant.
Analyze the following travel session data and write a clear, informative, and engaging summary/resume of this trip.

=== TRIP TELEMETRY DATA ===
- Vehicle / Car: ${carDescription}
- Session Start: ${startUtc} ${startLocation ? `(Location: ${startLocation})` : ''}
- Session End:   ${endUtc} ${endLocation ? `(Location: ${endLocation})` : ''}
- Duration:      ${durationFormatted} (${Math.round(durationMs / 60000)} minutes)
- Distance:      ~${totalDistanceKm} km
- Total Raw GPS Points: ${locations.length} points recorded

=== SAMPLE OF ROUTE WAYPOINTS ===
${waypointsText}

=== INSTRUCTIONS ===
1. Provide a concise travel resume/description:
   - Trip overview: Departure & arrival points, purpose/context (e.g., commute, errand, road trip), total distance and duration.
   - Route and movement details: General path, highways/streets or neighborhoods traversed, and any notable stops or stationary periods observed from timestamps/coordinates.
   - Driving flow and characteristics: Pacing, elevation or speed dynamics if apparent.
2. Structure the summary cleanly with concise paragraphs or bullet points.
3. Keep the total response under 4,000 characters.
4. If coordinates or locations indicate Brazil or Portuguese language context, write the description in Portuguese (pt-BR); otherwise write in English.`;

    // 5. Call Gemini
    console.log(`[Gemini AI] Calling Gemini for session ${sessionId} (${locations.length} points)...`);
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
