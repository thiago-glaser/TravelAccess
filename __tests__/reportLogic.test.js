/**
 * __tests__/reportLogic.test.js
 *
 * Unit tests for the fuel cost assignment logic used in app/reports/page.js.
 * The logic is extracted here as pure functions so it can be unit tested
 * without rendering any React components.
 *
 * Covers:
 *   - selectApplicableFuelLog  (which fuel record determines a session's cost)
 *   - computeSessionCost       (price × distance)
 *   - deriveValueConfirmed     (Y/N based on whether the log has a real price)
 */

// ─── Pure functions extracted from reports/page.js ────────────────────────────
// (These mirror the logic inline in generateReport exactly)

/**
 * Returns the fuel log whose timestamp comes AFTER the session end,
 * i.e., the log that "accounts for" the fuel consumed during the session.
 */
function selectApplicableFuelLog(carFuelLogs, sessionEnd) {
    return carFuelLogs.find(f => {
        const fTimeStr = f.timestampUtc.endsWith('Z') ? f.timestampUtc : f.timestampUtc + 'Z';
        return new Date(fTimeStr).getTime() > sessionEnd.getTime();
    }) ?? null;
}

/**
 * Determines whether the session cost is confirmed (Y) or estimated (N).
 */
function deriveValueConfirmed(applicableLog, isProjected) {
    if (!applicableLog) return 'N';
    if (isProjected) return 'N';
    if (parseFloat(applicableLog.pricePerKilometer) <= 0) return 'N';
    return 'Y';
}

/**
 * Picks the best price-per-km to use for a session:
 *   - If there's a valid applicable log  → confirmed price
 *   - Otherwise project from nearest known price
 */
function resolveSessionPrice(carFuelLogs, sessionEnd) {
    const validLogs = carFuelLogs.filter(f => parseFloat(f.pricePerKilometer) > 0);
    const applicableLog = selectApplicableFuelLog(carFuelLogs, sessionEnd);

    if (applicableLog && parseFloat(applicableLog.pricePerKilometer) > 0) {
        return { pricePerKm: parseFloat(applicableLog.pricePerKilometer), isProjected: false, applicableLog };
    }

    if (validLogs.length === 0) return { pricePerKm: 0, isProjected: false, applicableLog: null };

    // Is session AFTER the last fuel log?  Project using newest price.
    if (!applicableLog) {
        return { pricePerKm: parseFloat(validLogs[validLogs.length - 1].pricePerKilometer), isProjected: true, applicableLog: null };
    }

    // Session is BEFORE the first evaluated log → project backwards.
    return { pricePerKm: parseFloat(validLogs[0].pricePerKilometer), isProjected: true, applicableLog };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fuelLog = (timestampUtc, pricePerKilometer) => ({ timestampUtc, pricePerKilometer });

// ─── selectApplicableFuelLog ──────────────────────────────────────────────────

describe('selectApplicableFuelLog', () => {
    const sessionEnd = new Date('2026-02-15T10:00:00Z');

    test('returns the first log AFTER session end', () => {
        const logs = [
            fuelLog('2026-02-01T00:00:00Z', '0.15'), // before session — skip
            fuelLog('2026-02-20T00:00:00Z', '0.18'), // after session ✓
            fuelLog('2026-03-01T00:00:00Z', '0.20'), // after session but not first
        ];
        const result = selectApplicableFuelLog(logs, sessionEnd);
        expect(result.timestampUtc).toBe('2026-02-20T00:00:00Z');
    });

    test('returns null when all logs are before session end', () => {
        const logs = [
            fuelLog('2026-01-01T00:00:00Z', '0.15'),
            fuelLog('2026-02-10T00:00:00Z', '0.16'),
        ];
        expect(selectApplicableFuelLog(logs, sessionEnd)).toBeNull();
    });

    test('returns null for an empty log list', () => {
        expect(selectApplicableFuelLog([], sessionEnd)).toBeNull();
    });

    test('handles timestampUtc without Z suffix', () => {
        const logs = [fuelLog('2026-02-20T00:00:00', '0.18')]; // no Z
        const result = selectApplicableFuelLog(logs, sessionEnd);
        expect(result).not.toBeNull();
    });
});

// ─── deriveValueConfirmed ─────────────────────────────────────────────────────

describe('deriveValueConfirmed', () => {
    test('Y when applicable log has a positive price and not projected', () => {
        const log = fuelLog('2026-02-20T00:00:00Z', '0.18');
        expect(deriveValueConfirmed(log, false)).toBe('Y');
    });

    test('N when isProjected is true even with a valid log', () => {
        const log = fuelLog('2026-02-20T00:00:00Z', '0.18');
        expect(deriveValueConfirmed(log, true)).toBe('N');
    });

    test('N when applicable log has zero price', () => {
        const log = fuelLog('2026-02-20T00:00:00Z', '0');
        expect(deriveValueConfirmed(log, false)).toBe('N');
    });

    test('N when there is no applicable log', () => {
        expect(deriveValueConfirmed(null, false)).toBe('N');
    });
});

// ─── resolveSessionPrice ──────────────────────────────────────────────────────

describe('resolveSessionPrice', () => {
    const sessionEnd = new Date('2026-02-15T10:00:00Z');

    test('uses confirmed price when applicable log exists after session', () => {
        const logs = [
            fuelLog('2026-01-01T00:00:00Z', '0.10'), // before
            fuelLog('2026-02-20T00:00:00Z', '0.18'), // after ← applicable
        ];
        const { pricePerKm, isProjected } = resolveSessionPrice(logs, sessionEnd);
        expect(pricePerKm).toBeCloseTo(0.18);
        expect(isProjected).toBe(false);
    });

    test('projects forward using latest price when session is after all logs', () => {
        const futureSession = new Date('2026-12-01T00:00:00Z');
        const logs = [
            fuelLog('2026-01-01T00:00:00Z', '0.10'),
            fuelLog('2026-03-01T00:00:00Z', '0.20'), // newest
        ];
        const { pricePerKm, isProjected } = resolveSessionPrice(logs, futureSession);
        expect(pricePerKm).toBeCloseTo(0.20);
        expect(isProjected).toBe(true);
    });

    test('projects backward using earliest known price for old sessions', () => {
        const oldSession = new Date('2025-01-01T00:00:00Z');
        const logs = [
            // Both logs come AFTER the old session.
            // The applicable log (first after session = 2025-06-01) has price=0
            // (not yet calculated), so it cannot be used → falls through to backward projection
            // using the first validLog (2025-09-01 with price=0.15).
            fuelLog('2025-06-01T00:00:00Z', '0'),   // applicable but uncalculated
            fuelLog('2025-09-01T00:00:00Z', '0.15'), // valid — used as projected price
        ];
        const { pricePerKm, isProjected } = resolveSessionPrice(logs, oldSession);
        expect(isProjected).toBe(true);
        expect(pricePerKm).toBeCloseTo(0.15);
    });

    test('returns zero price when no valid logs exist', () => {
        const logs = [
            fuelLog('2026-02-20T00:00:00Z', '0'), // applicable but zero
        ];
        const { pricePerKm, isProjected } = resolveSessionPrice(logs, sessionEnd);
        expect(pricePerKm).toBe(0);
        expect(isProjected).toBe(false);
    });

    test('returns zero price for completely empty log list', () => {
        const { pricePerKm } = resolveSessionPrice([], sessionEnd);
        expect(pricePerKm).toBe(0);
    });

    test('cost calculation: pricePerKm × distanceKm', () => {
        const logs = [fuelLog('2026-02-20T00:00:00Z', '0.20')];
        const { pricePerKm } = resolveSessionPrice(logs, sessionEnd);
        const distanceKm = 50;
        expect(pricePerKm * distanceKm).toBeCloseTo(10.0);
    });
});
