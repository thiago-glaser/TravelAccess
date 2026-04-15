/**
 * __tests__/auth.test.js
 *
 * Unit tests for lib/auth.js
 * Covers: hashPassword, verifyPassword, generateToken, verifyToken, generateApiKey
 * 
 * NOTE: getSession, validateApiKey, and verifyDeviceOwnership require a DB
 * connection and are covered separately by integration tests.
 */

// Stub lib/db.js so auth.js can be imported without a real DB connection
jest.mock('../lib/db.js', () => ({
    query: jest.fn(),
    getConnection: jest.fn(),
    __esModule: true,
}));

const { hashPassword, verifyPassword, generateToken, verifyToken, generateApiKey } =
    require('../lib/auth.js');

// ─── hashPassword / verifyPassword ────────────────────────────────────────────

describe('hashPassword + verifyPassword', () => {
    test('hashes a password and verifies it correctly', async () => {
        const hash = await hashPassword('MySecret123!');
        expect(typeof hash).toBe('string');
        expect(hash).not.toBe('MySecret123!');

        const valid = await verifyPassword('MySecret123!', hash);
        expect(valid).toBe(true);
    });

    test('rejects an incorrect password', async () => {
        const hash = await hashPassword('CorrectHorse');
        const valid = await verifyPassword('WrongPassword', hash);
        expect(valid).toBe(false);
    });

    test('produces a different hash each call (salt)', async () => {
        const h1 = await hashPassword('same');
        const h2 = await hashPassword('same');
        expect(h1).not.toBe(h2);
    });
});

// ─── generateToken / verifyToken ─────────────────────────────────────────────

describe('generateToken + verifyToken', () => {
    const mockUser = { ID: 'abc-123', USERNAME: 'thiago', IS_ADMIN: 0 };

    test('generates a non-empty JWT string', () => {
        const token = generateToken(mockUser);
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3); // header.payload.signature
    });

    test('decoded token contains expected fields', () => {
        const token = generateToken(mockUser);
        const decoded = verifyToken(token);
        expect(decoded).not.toBeNull();
        expect(decoded.id).toBe('abc-123');
        expect(decoded.username).toBe('thiago');
        expect(decoded.isAdmin).toBe(0);
    });

    test('returns null for a tampered token', () => {
        const token = generateToken(mockUser);
        const tampered = token.slice(0, -5) + 'XXXXX';
        expect(verifyToken(tampered)).toBeNull();
    });

    test('returns null for a completely invalid string', () => {
        expect(verifyToken('not.a.token')).toBeNull();
        expect(verifyToken('')).toBeNull();
        expect(verifyToken(null)).toBeNull();
    });

    test('id is always returned as a string (not number)', () => {
        const token = generateToken({ ID: 42, USERNAME: 'u', IS_ADMIN: 0 });
        const decoded = verifyToken(token);
        expect(typeof decoded.id).toBe('string');
        expect(decoded.id).toBe('42');
    });
});

// ─── generateApiKey ───────────────────────────────────────────────────────────

describe('generateApiKey', () => {
    test('returns a 64-character hex string', () => {
        const key = generateApiKey();
        expect(typeof key).toBe('string');
        expect(key).toHaveLength(64);
        expect(/^[0-9a-f]+$/.test(key)).toBe(true);
    });

    test('generates a unique key each call', () => {
        const keys = new Set(Array.from({ length: 20 }, generateApiKey));
        expect(keys.size).toBe(20);
    });
});
