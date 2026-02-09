import CryptoJS from 'crypto-js';

const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Hash password for storage using SHA-256
 * @param {string} password - Plain text password
 * @returns {string} Hashed password
 */
export function hashPassword(password) {
    return CryptoJS.SHA256(password).toString();
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {{valid: boolean, message: string}} Validation result
 */
export function validatePasswordStrength(password) {
    if (!password) {
        return { valid: false, message: 'Password is required' };
    }
    if (password.length < 8) {
        return { valid: false, message: 'Minimum 8 characters required' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Include at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Include at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Include at least one number' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return { valid: false, message: 'Include at least one special character' };
    }
    return { valid: true, message: 'Strong password' };
}

/**
 * Check if password is set
 * @returns {Promise<boolean>}
 */
export async function isPasswordSet() {
    const data = await chrome.storage.local.get(['passwordHash']);
    return !!data.passwordHash;
}

/**
 * Set up password for first time
 * @param {string} password - Password to set
 * @returns {Promise<void>}
 */
export async function setupPassword(password) {
    const validation = validatePasswordStrength(password);
    if (!validation.valid) {
        throw new Error(validation.message);
    }

    const hash = hashPassword(password);
    await chrome.storage.local.set({ passwordHash: hash });
}

/**
 * Create a new session
 * @param {string} password - Password to validate and create session
 * @returns {Promise<string>} Session token
 */
export async function createSession(password) {
    const hash = hashPassword(password);
    const data = await chrome.storage.local.get(['passwordHash']);

    if (!data.passwordHash) {
        throw new Error('Password not set. Please set up password first.');
    }

    if (data.passwordHash !== hash) {
        throw new Error('Invalid password');
    }

    // Generate session token
    const sessionToken = CryptoJS.lib.WordArray.random(32).toString();
    const expiresAt = Date.now() + SESSION_DURATION;

    // Store in session storage (memory only, cleared on browser close)
    await chrome.storage.session.set({
        sessionToken,
        sessionExpiry: expiresAt,
        masterPassword: password // Keep in memory for encryption/decryption
    });

    return sessionToken;
}

/**
 * Validate current session
 * @returns {Promise<boolean>} True if session is valid
 */
export async function validateSession() {
    try {
        const data = await chrome.storage.session.get(['sessionToken', 'sessionExpiry']);

        if (!data.sessionToken || !data.sessionExpiry) {
            return false;
        }

        // Check if session expired
        if (Date.now() > data.sessionExpiry) {
            await clearSession();
            return false;
        }

        return true;
    } catch (error) {
        console.error('Session validation error:', error);
        return false;
    }
}

/**
 * Clear current session
 * @returns {Promise<void>}
 */
export async function clearSession() {
    await chrome.storage.session.clear();
}

/**
 * Get master password from current session
 * @returns {Promise<string|null>} Password if session is valid, null otherwise
 */
export async function getMasterPassword() {
    const isValid = await validateSession();
    if (!isValid) {
        return null;
    }

    const data = await chrome.storage.session.get(['masterPassword']);
    return data.masterPassword || null;
}

/**
 * Extend session expiry (reset timer)
 * @returns {Promise<void>}
 */
export async function extendSession() {
    const data = await chrome.storage.session.get(['sessionToken']);
    if (data.sessionToken) {
        const expiresAt = Date.now() + SESSION_DURATION;
        await chrome.storage.session.set({ sessionExpiry: expiresAt });
    }
}

/**
 * Change password
 * @param {string} oldPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<void>}
 */
export async function changePassword(oldPassword, newPassword) {
    // Validate old password
    const oldHash = hashPassword(oldPassword);
    const data = await chrome.storage.local.get(['passwordHash']);

    if (data.passwordHash !== oldHash) {
        throw new Error('Current password is incorrect');
    }

    // Validate new password strength
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
        throw new Error(validation.message);
    }

    // Set new password
    const newHash = hashPassword(newPassword);
    await chrome.storage.local.set({ passwordHash: newHash });

    // Clear current session (user needs to re-login)
    await clearSession();
}
