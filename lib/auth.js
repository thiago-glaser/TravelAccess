import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';
import crypto from 'crypto';

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
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('JWT_SECRET environment variable must be set to a secure value (minimum 32 characters)');
    }
    return jwt.sign(
        { id: user.ID, username: user.USERNAME, isAdmin: user.IS_ADMIN, isDemo: user.IS_DEMO },
        secret,
        { expiresIn: '7d' }
    );
}

/**
 * Verify a JWT token
 * @param {string} token 
 * @returns {Object|null}
 */
export function verifyToken(token) {
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret || secret.length < 32) {
            console.error('JWT_SECRET environment variable must be set to a secure value (minimum 32 characters)');
            return null;
        }
        const decoded = jwt.verify(token, secret);
        if (decoded) {
            if (decoded.id) decoded.id = String(decoded.id);
            if (decoded.ID) decoded.ID = String(decoded.ID);
            if (decoded.USER_ID) decoded.USER_ID = String(decoded.USER_ID);

            // Normalize isAdmin and isDemo
            if (decoded.IS_ADMIN !== undefined) decoded.isAdmin = decoded.IS_ADMIN;
            if (decoded.admin !== undefined) decoded.isAdmin = decoded.admin;

            if (decoded.IS_DEMO !== undefined) decoded.isDemo = decoded.IS_DEMO;
            if (decoded.demo !== undefined) decoded.isDemo = decoded.demo;
        }
        return decoded;
    } catch (e) {
        return null;
    }
}

/**
 * Generate a random API key
 * @returns {string}
 */
export function generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate an API key and update last_used
 * @param {string} key 
 * @returns {Promise<Object|null>}
 */
export async function validateApiKey(key) {
    if (!key) return null;

    const sql = `
        SELECT ak.*, u.USERNAME, u.IS_ADMIN, u.IS_DEMO
        FROM API_KEYS ak
        JOIN USERS u ON TRIM(ak.USER_ID) = TRIM(u.ID)
        WHERE TRIM(ak.KEY_VALUE) = TRIM(:key) 
          AND (ak.IS_ACTIVE = 1 OR ak.IS_ACTIVE IS NULL) 
          AND (ak.IS_DELETED = 0 OR ak.IS_DELETED IS NULL)
          AND (u.IS_DELETED = 0 OR u.IS_DELETED IS NULL)
    `;

    try {
        const result = await query(sql, { key });

        if (result.rows && result.rows.length > 0) {
            const apiKeyInfo = result.rows[0];

            // Normalize flags
            apiKeyInfo.isAdmin = apiKeyInfo.IS_ADMIN === 1;
            apiKeyInfo.isDemo = apiKeyInfo.IS_DEMO === 'Y' || apiKeyInfo.IS_DEMO === true;

            // Update last used asynchronously (don't wait for it)
            query('UPDATE API_KEYS SET LAST_USED = UTC_TIMESTAMP() WHERE TRIM(ID) = TRIM(:id)', { id: apiKeyInfo.ID })
                .catch(err => console.error('Failed to update last_used:', err));

            return apiKeyInfo;
        }
    } catch (err) {
        console.error(`[Auth error] API key validation query failed:`, err.message);
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
        if (decoded) {
            const userId = decoded.id || decoded.ID || decoded.USER_ID;
            if (userId) {
                const check = await query('SELECT IS_DELETED FROM USERS WHERE TRIM(ID) = TRIM(:id)', { id: userId });
                if (check.rows && check.rows[0] && (check.rows[0].IS_DELETED === 1 || check.rows[0].IS_DELETED === '1')) {
                    return null;
                }
            }
            return { ...decoded, authType: 'jwt' };
        }
    }

    // 3. Check for Cookie (for browsers)
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
        const tokenMatch = cookieHeader.match(/auth_token=([^;]+)/);
        if (tokenMatch) {
            const decoded = verifyToken(tokenMatch[1]);
            if (decoded) {
                const userId = decoded.id || decoded.ID || decoded.USER_ID;
                if (userId) {
                    const check = await query('SELECT IS_DELETED FROM USERS WHERE TRIM(ID) = TRIM(:id)', { id: userId });
                    if (check.rows && check.rows[0] && (check.rows[0].IS_DELETED === 1 || check.rows[0].IS_DELETED === '1')) {
                        return null;
                    }
                }
                return { ...decoded, authType: 'cookie' };
            }
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

    const userId = session.USER_ID || session.id || session.ID;
    const checkSql = `SELECT 1 FROM USER_DEVICES WHERE TRIM(USER_ID) = TRIM(:userId) AND DEVICE_ID = :deviceId AND (IS_DELETED = 0 OR IS_DELETED IS NULL)`;

    let result;
    if (dbConnection) {
        const [rows] = await dbConnection.execute(checkSql, { userId, deviceId });
        result = { rows };
    } else {
        result = await query(checkSql, { userId, deviceId });
    }

    return result.rows && result.rows.length > 0;
}
