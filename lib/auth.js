import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db';
import { crypto } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-change-me';

/**
 * Hash a password
 * @param {string} password 
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

/**
 * Verify a password
 * @param {string} password 
 * @param {string} hash 
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 * @param {Object} user 
 * @returns {string}
 */
export function generateToken(user) {
    return jwt.sign(
        { id: user.ID, username: user.USERNAME, isAdmin: user.IS_ADMIN },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

/**
 * Verify a JWT token
 * @param {string} token 
 * @returns {Object|null}
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (e) {
        return null;
    }
}

/**
 * Generate a random API key
 * @returns {string}
 */
export function generateApiKey() {
    return require('crypto').randomBytes(32).toString('hex');
}

/**
 * Validate an API key and update last_used
 * @param {string} key 
 * @returns {Promise<Object|null>}
 */
export async function validateApiKey(key) {
    if (!key) return null;

    const sql = `
        SELECT ak.*, u.USERNAME 
        FROM API_KEYS ak
        JOIN USERS u ON ak.USER_ID = u.ID
        WHERE ak.KEY_VALUE = :key AND ak.IS_ACTIVE = 1
    `;

    const result = await query(sql, { key });

    if (result.rows && result.rows.length > 0) {
        const apiKeyInfo = result.rows[0];

        // Update last used asynchronously (don't wait for it)
        query('UPDATE API_KEYS SET LAST_USED = CURRENT_TIMESTAMP WHERE ID = :id', { id: apiKeyInfo.ID })
            .catch(err => console.error('Failed to update last_used:', err));

        return apiKeyInfo;
    }

    return null;
}

/**
 * Middleware-like function to protect API routes
 * @param {Request} request 
 * @returns {Promise<Object|null>} Returns user info if authorized, null otherwise
 */
export async function getSession(request) {
    // 1. Check for API key in headers
    const apiKey = request.headers.get('x-api-key');
    if (apiKey) {
        const keyInfo = await validateApiKey(apiKey);
        if (keyInfo) return { ...keyInfo, authType: 'api-key' };
    }

    // 2. Check for Bearer token
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = verifyToken(token);
        if (decoded) return { ...decoded, authType: 'jwt' };
    }

    // 3. Check for Cookie (for browsers)
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
        const tokenMatch = cookieHeader.match(/auth_token=([^;]+)/);
        if (tokenMatch) {
            const decoded = verifyToken(tokenMatch[1]);
            if (decoded) return { ...decoded, authType: 'cookie' };
        }
    }

    return null;
}

/**
 * Verify if a session user owns the given device
 * @param {Object} session 
 * @param {string} deviceId 
 * @param {Object} [dbConnection=null] Optional existing database connection
 * @returns {Promise<boolean>}
 */
export async function verifyDeviceOwnership(session, deviceId, dbConnection = null) {
    if (!session || !deviceId) return false;

    const userId = session.id || session.ID || session.USER_ID;
    const checkSql = `SELECT 1 FROM USER_DEVICES WHERE USER_ID = :userId AND DEVICE_ID = :deviceId`;

    let result;
    if (dbConnection) {
        result = await dbConnection.execute(checkSql, { userId, deviceId });
    } else {
        result = await query(checkSql, { userId, deviceId });
    }

    return result.rows && result.rows.length > 0;
}
