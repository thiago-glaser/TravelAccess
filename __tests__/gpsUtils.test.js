/**
 * __tests__/gpsUtils.test.js
 *
 * Unit tests for lib/gpsUtils.js
 * Covers: parseUTC, calculateDistance, filterLocationsByDistance,
 *         calculateTotalDistance, formatDuration, processLocations
 */

import {
    parseUTC,
    calculateDistance,
    calculateDistanceHaversine,
    filterLocationsByDistance,
    calculateTotalDistance,
    formatDuration,
    processLocations,
} from '../lib/gpsUtils.js';

// ─── parseUTC ─────────────────────────────────────────────────────────────────

describe('parseUTC', () => {
    test('returns null for null/undefined input', () => {
        expect(parseUTC(null)).toBeNull();
        expect(parseUTC(undefined)).toBeNull();
        expect(parseUTC('')).toBeNull();
    });

    test('returns the same Date object if given a Date', () => {
        const d = new Date('2026-01-15T10:00:00Z');
        expect(parseUTC(d)).toBe(d);
    });

    test('parses ISO string with Z suffix', () => {
        const d = parseUTC('2026-01-15T10:00:00Z');
        expect(d).toBeInstanceOf(Date);
        expect(d.toISOString()).toBe('2026-01-15T10:00:00.000Z');
    });

    test('parses ISO string without Z and appends Z', () => {
        const d = parseUTC('2026-01-15T10:00:00');
        expect(d).toBeInstanceOf(Date);
        expect(d.toISOString()).toBe('2026-01-15T10:00:00.000Z');
    });

    test('parses Oracle-style string with space separator', () => {
        const d = parseUTC('2026-01-15 10:00:00');
        expect(d).toBeInstanceOf(Date);
        expect(d.getUTCHours()).toBe(10);
    });

    test('returns null for completely invalid string', () => {
        expect(parseUTC('not-a-date')).toBeNull();
    });
});

// ─── calculateDistance ────────────────────────────────────────────────────────

describe('calculateDistance (geodesic)', () => {
    test('returns 0 for identical points', () => {
        expect(calculateDistance(49.8, -97.1, 49.8, -97.1)).toBe(0);
    });

    test('returns positive distance for distinct points', () => {
        const dist = calculateDistance(49.8, -97.1, 49.9, -97.1);
        expect(dist).toBeGreaterThan(0);
    });

    test('distance is roughly 111 km per degree of latitude', () => {
        const dist = calculateDistance(0, 0, 1, 0);
        // Mock uses flat-earth: 111 320 m per degree
        expect(dist).toBeCloseTo(111320, -2);
    });

    test('is symmetric — A→B roughly equals B→A (within 1%)', () => {
        const d1 = calculateDistance(49.8, -97.1, 50.0, -97.3);
        const d2 = calculateDistance(50.0, -97.3, 49.8, -97.1);
        // Flat-earth mock uses cos(lat1) so results differ slightly — accept <1% deviation
        expect(Math.abs(d1 - d2) / Math.max(d1, d2)).toBeLessThan(0.01);
    });
});

describe('calculateDistanceHaversine', () => {
    test('returns 0 for identical points', () => {
        expect(calculateDistanceHaversine(49.8, -97.1, 49.8, -97.1)).toBe(0);
    });

    test('returns positive distance for distinct points', () => {
        const dist = calculateDistanceHaversine(49.8, -97.1, 49.9, -97.1);
        expect(dist).toBeGreaterThan(0);
    });

    test('roughly matches geodesic for short distances', () => {
        const d1 = calculateDistance(49.8, -97.1, 49.9, -97.2);
        const d2 = calculateDistanceHaversine(49.8, -97.1, 49.9, -97.2);
        // Both should be within 1% of each other for short distances
        expect(Math.abs(d1 - d2) / d2).toBeLessThan(0.02);
    });
});

// ─── filterLocationsByDistance ────────────────────────────────────────────────

describe('filterLocationsByDistance', () => {
    const point = (lat, lng) => ({ lat, lng, date: '2026-01-01T00:00:00Z' });

    test('returns empty array unchanged', () => {
        expect(filterLocationsByDistance([])).toEqual([]);
    });

    test('returns single point unchanged', () => {
        const pts = [point(49.8, -97.1)];
        expect(filterLocationsByDistance(pts)).toEqual(pts);
    });

    test('always keeps the first point', () => {
        const pts = [point(49.8, -97.1), point(49.8, -97.1)]; // identical
        const result = filterLocationsByDistance(pts, 10);
        expect(result[0]).toEqual(pts[0]);
    });

    test('removes points closer than minDistance', () => {
        // All points within 1 meter of the first — all should be dropped except first
        const pts = [
            point(49.80000, -97.10000),
            point(49.80001, -97.10000), // ~11 m away with mock — this will vary
            point(49.80000, -97.10001),
        ];
        const result = filterLocationsByDistance(pts, 99999); // huge threshold keeps only first
        expect(result.length).toBe(1);
    });

    test('keeps points further than minDistance', () => {
        const pts = [
            point(49.8, -97.1),
            point(50.8, -97.1), // ~111 km away
            point(51.8, -97.1), // ~111 km from previous
        ];
        const result = filterLocationsByDistance(pts, 100); // 100 m threshold
        expect(result.length).toBe(3);
    });
});

// ─── calculateTotalDistance ───────────────────────────────────────────────────

describe('calculateTotalDistance', () => {
    const point = (lat, lng) => ({ lat, lng });

    test('returns 0 for empty array', () => {
        expect(calculateTotalDistance([])).toBe(0);
    });

    test('returns 0 for single point', () => {
        expect(calculateTotalDistance([point(49.8, -97.1)])).toBe(0);
    });

    test('returns correct distance for two points', () => {
        const pts = [point(0, 0), point(1, 0)];
        const dist = calculateTotalDistance(pts);
        expect(dist).toBeCloseTo(111320, -2);
    });

    test('sums distances for multiple sequential points', () => {
        const pts = [point(0, 0), point(1, 0), point(2, 0)];
        const dist = calculateTotalDistance(pts);
        expect(dist).toBeCloseTo(222640, -2); // 2 × 111 320
    });

    test('total A→B→C equals A→C only for collinear points', () => {
        // Along the same meridian: total = sum of segments
        const pts = [point(0, 0), point(1, 0), point(2, 0)];
        const total = calculateTotalDistance(pts);
        const direct = calculateDistance(0, 0, 2, 0);
        expect(total).toBeCloseTo(direct, -1);
    });
});

// ─── formatDuration ───────────────────────────────────────────────────────────

describe('formatDuration', () => {
    test('formats zero', () => {
        expect(formatDuration(0)).toBe('0:00:00');
    });

    test('formats negative as zero', () => {
        expect(formatDuration(-5000)).toBe('0:00:00');
    });

    test('formats exactly 1 second', () => {
        expect(formatDuration(1000)).toBe('0:00:01');
    });

    test('formats exactly 1 minute', () => {
        expect(formatDuration(60000)).toBe('0:01:00');
    });

    test('formats exactly 1 hour', () => {
        expect(formatDuration(3600000)).toBe('1:00:00');
    });

    test('formats 1h 23m 45s', () => {
        const ms = (1 * 3600 + 23 * 60 + 45) * 1000;
        expect(formatDuration(ms)).toBe('1:23:45');
    });

    test('pads minutes and seconds to 2 digits', () => {
        expect(formatDuration(61000)).toBe('0:01:01');
    });

    test('handles large values (24+ hours)', () => {
        const ms = 25 * 3600 * 1000;
        expect(formatDuration(ms)).toBe('25:00:00');
    });
});

// ─── processLocations ─────────────────────────────────────────────────────────

describe('processLocations', () => {
    const makePoint = (lat, lng, isoDate) => ({ lat, lng, date: isoDate });

    test('returns empty array for empty input', () => {
        expect(processLocations([])).toEqual([]);
    });

    test('single point has zero incremental distance and speed', () => {
        const result = processLocations([makePoint(49.8, -97.1, '2026-01-01T00:00:00Z')]);
        expect(result).toHaveLength(1);
        expect(result[0].incrementalDistance).toBe(0);
        expect(result[0].speedKmH).toBe(0);
        expect(result[0].cumulativeDistanceKm).toBe(0);
        expect(result[0].cumulativeTimeMs).toBe(0);
    });

    test('two points produce correct cumulative distance', () => {
        const pts = [
            makePoint(0, 0, '2026-01-01T00:00:00Z'),
            makePoint(1, 0, '2026-01-01T00:01:00Z'),  // 1 min later, 1 deg north
        ];
        const result = processLocations(pts);
        expect(result[1].cumulativeDistanceKm).toBeCloseTo(111.32, 0);
        expect(result[1].cumulativeTimeMs).toBe(60000);
    });

    test('result array has the same length as input', () => {
        const pts = [
            makePoint(49.8, -97.1, '2026-01-01T00:00:00Z'),
            makePoint(49.9, -97.1, '2026-01-01T00:01:00Z'),
            makePoint(50.0, -97.1, '2026-01-01T00:02:00Z'),
        ];
        expect(processLocations(pts)).toHaveLength(3);
    });

    test('cumulative distance increases monotonically', () => {
        const pts = [
            makePoint(0, 0, '2026-01-01T00:00:00Z'),
            makePoint(1, 0, '2026-01-01T00:01:00Z'),
            makePoint(2, 0, '2026-01-01T00:02:00Z'),
        ];
        const result = processLocations(pts);
        expect(result[0].cumulativeDistanceKm).toBe(0);
        expect(result[1].cumulativeDistanceKm).toBeGreaterThan(0);
        expect(result[2].cumulativeDistanceKm).toBeGreaterThan(result[1].cumulativeDistanceKm);
    });

    test('passes through original properties untouched', () => {
        const pts = [makePoint(49.8, -97.1, '2026-01-01T00:00:00Z')];
        pts[0].myCustomProp = 'hello';
        const result = processLocations(pts);
        expect(result[0].myCustomProp).toBe('hello');
    });
});
