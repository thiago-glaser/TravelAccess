// Robust UTC parsing and formatting
export const parseUTC = (dateVal) => {
    if (!dateVal) return null;
    try {
        if (dateVal instanceof Date) return dateVal;
        let dateStr = String(dateVal).trim();
        if (!dateStr.includes('T')) dateStr = dateStr.replace(' ', 'T');
        if (!dateStr.endsWith('Z') && !dateStr.includes('+')) dateStr += 'Z';
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    } catch (e) {
        console.error('Date parsing error:', e);
        return null;
    }
};

// Calculate distance between two points in meters using Haversine formula
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
};

// Filter locations to remove points closer than minDistance meters apart
export const filterLocationsByDistance = (locations, minDistance = 10) => {
    if (locations.length <= 1) return locations;

    const filtered = [locations[0]]; // Always keep the first point

    for (let i = 1; i < locations.length; i++) {
        const lastFiltered = filtered[filtered.length - 1];
        const distance = calculateDistance(
            lastFiltered.lat,
            lastFiltered.lng,
            locations[i].lat,
            locations[i].lng
        );

        if (distance >= minDistance) {
            filtered.push(locations[i]);
        }
    }

    return filtered;
};

// Calculate total distance traveled between consecutive points
export const calculateTotalDistance = (locations) => {
    if (locations.length <= 1) return 0;

    let totalDistance = 0;
    for (let i = 1; i < locations.length; i++) {
        const distance = calculateDistance(
            locations[i - 1].lat,
            locations[i - 1].lng,
            locations[i].lat,
            locations[i].lng
        );
        totalDistance += distance;
    }

    return totalDistance;
};

// Format ms to h:mm:ss
export const formatDuration = (ms) => {
    if (ms < 0) ms = 0;
    let totalSeconds = Math.floor(ms / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Process points to compute incremental time, distance, and speed
export const processLocations = (locations) => {
    const processed = [];
    const windowSize = Math.min(2, Math.floor((locations.length - 1) / 2));

    let cumulativeDistanceMeters = 0;
    const startTimeMs = locations.length > 0 ? parseUTC(locations[0].date).getTime() : 0;

    for (let i = 0; i < locations.length; i++) {
        const current = locations[i];

        let incrementalDistance = 0;
        let incrementalTimeSeconds = 0;
        let speedKmH = 0;

        // Calculate point-to-point incremental data
        if (i > 0) {
            const previous = locations[i - 1];
            incrementalDistance = calculateDistance(
                previous.lat, previous.lng, current.lat, current.lng
            );

            const time1 = parseUTC(previous.date).getTime();
            const time2 = parseUTC(current.date).getTime();
            incrementalTimeSeconds = (time2 - time1) / 1000;
        }

        cumulativeDistanceMeters += incrementalDistance;
        const cumulativeTimeMs = startTimeMs > 0 ? parseUTC(current.date).getTime() - startTimeMs : 0;

        // Apply average speed rule (window of ±windowSize) if possible
        if (locations.length >= 3 && i >= windowSize && i < locations.length - windowSize) {
            const point1 = locations[i - windowSize];
            const point2 = locations[i + windowSize];

            const windowDistance = calculateDistance(
                point1.lat, point1.lng, point2.lat, point2.lng
            );

            const time1 = parseUTC(point1.date).getTime();
            const time2 = parseUTC(point2.date).getTime();
            const timeDiffSeconds = (time2 - time1) / 1000;

            if (timeDiffSeconds > 0) {
                speedKmH = (windowDistance / timeDiffSeconds) * 3.6;
            }
        }

        const dateObj = parseUTC(current.date);

        processed.push({
            ...current,
            localDate: dateObj,
            incrementalDistance,
            incrementalTimeSeconds,
            cumulativeDistanceKm: cumulativeDistanceMeters / 1000,
            cumulativeTimeMs: cumulativeTimeMs,
            formattedCumulativeTime: formatDuration(cumulativeTimeMs),
            speedKmH
        });
    }

    return processed;
};
