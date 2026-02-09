import CryptoJS from 'crypto-js';

/**
 * Encrypt data with AES encryption
 * @param {string} data - Plain text data to encrypt
 * @param {string} password - Password/key for encryption
 * @returns {string|null} Encrypted string or null if inputs invalid
 */
export function encrypt(data, password) {
    if (!data || !password) {
        return null;
    }

    try {
        return CryptoJS.AES.encrypt(data, password).toString();
    } catch (error) {
        console.error('Encryption error:', error);
        return null;
    }
}

/**
 * Decrypt AES encrypted data
 * @param {string} encryptedData - Encrypted data string
 * @param {string} password - Password/key for decryption
 * @returns {string|null} Decrypted string or null if decryption fails
 */
export function decrypt(encryptedData, password) {
    if (!encryptedData || !password) {
        return null;
    }

    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, password);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        return decrypted || null;
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

/**
 * Encrypt all sensitive API keys in settings object
 * Only encrypts password-type input fields (AI API keys)
 * @param {Object} settings - Settings object containing API keys
 * @param {string} password - Master password for encryption
 * @returns {Object} Settings with encrypted API keys
 */
export function encryptSettings(settings, password) {
    if (!settings || !password) {
        return settings;
    }

    const encrypted = { ...settings };

    // Only encrypt AI API Keys (password-type inputs)
    // OpenRouter API key
    if (settings.openRouterApiKey) {
        encrypted.openRouterApiKey = encrypt(settings.openRouterApiKey, password);
    }

    // SiliconFlow API key
    if (settings.siliconFlowApiKey) {
        encrypted.siliconFlowApiKey = encrypt(settings.siliconFlowApiKey, password);
    }

    // DO NOT encrypt:
    // - etherscanApiKey (text input, publicly visible in URLs)
    // - customSolanaRpc (text input, RPC endpoint URL)

    // Mark as encrypted
    encrypted.isEncrypted = true;
    encrypted.encryptionVersion = '1.0';

    return encrypted;
}

/**
 * Decrypt all API keys in settings object
 * @param {Object} settings - Settings object with encrypted API keys
 * @param {string} password - Master password for decryption
 * @returns {Object} Settings with decrypted API keys
 */
export function decryptSettings(settings, password) {
    if (!settings || !password) {
        return settings;
    }

    // If not encrypted, return as-is
    if (!settings.isEncrypted) {
        return settings;
    }

    const decrypted = { ...settings };

    // Decrypt OpenRouter API key
    if (settings.openRouterApiKey) {
        const decryptedKey = decrypt(settings.openRouterApiKey, password);
        if (decryptedKey) {
            decrypted.openRouterApiKey = decryptedKey;
        }
    }

    // Decrypt SiliconFlow API key
    if (settings.siliconFlowApiKey) {
        const decryptedKey = decrypt(settings.siliconFlowApiKey, password);
        if (decryptedKey) {
            decrypted.siliconFlowApiKey = decryptedKey;
        }
    }

    // Remove encryption markers
    delete decrypted.isEncrypted;
    delete decrypted.encryptionVersion;

    return decrypted;
}

/**
 * Encrypt CEX account API credentials
 * Only encrypts password-type fields (secret, passphrase)
 * @param {Object} cexAccount - CEX account object
 * @param {string} password - Master password
 * @returns {Object} CEX account with encrypted credentials
 */
export function encryptCexAccount(cexAccount, password) {
    if (!cexAccount || !password) {
        return cexAccount;
    }

    const encrypted = { ...cexAccount };

    // DO NOT encrypt apiKey (text input, needs to be visible)
    // Only encrypt password-type fields:

    // Encrypt API Secret (password input)
    if (cexAccount.apiSecret) {
        encrypted.apiSecret = encrypt(cexAccount.apiSecret, password);
    }

    // Encrypt Passphrase (password input, OKX/Bitget only)
    if (cexAccount.passphrase) {
        encrypted.passphrase = encrypt(cexAccount.passphrase, password);
    }

    encrypted.isEncrypted = true;

    return encrypted;
}

/**
 * Decrypt CEX account API credentials
 * @param {Object} cexAccount - Encrypted CEX account object
 * @param {string} password - Master password
 * @returns {Object} CEX account with decrypted credentials
 */
export function decryptCexAccount(cexAccount, password) {
    if (!cexAccount || !password || !cexAccount.isEncrypted) {
        return cexAccount;
    }

    const decrypted = { ...cexAccount };

    // apiKey is NOT encrypted, leave as-is

    // Decrypt API Secret
    if (cexAccount.apiSecret) {
        const decryptedSecret = decrypt(cexAccount.apiSecret, password);
        if (decryptedSecret) {
            decrypted.apiSecret = decryptedSecret;
        }
    }

    // Decrypt Passphrase
    if (cexAccount.passphrase) {
        const decryptedPassphrase = decrypt(cexAccount.passphrase, password);
        if (decryptedPassphrase) {
            decrypted.passphrase = decryptedPassphrase;
        }
    }

    delete decrypted.isEncrypted;

    return decrypted;
}

/**
 * Encrypt array of CEX accounts
 * @param {Array} cexAccounts - Array of CEX account objects
 * @param {string} password - Master password
 * @returns {Array} Array with encrypted CEX accounts
 */
export function encryptCexAccounts(cexAccounts, password) {
    if (!cexAccounts || !Array.isArray(cexAccounts) || !password) {
        return cexAccounts;
    }

    return cexAccounts.map(account => encryptCexAccount(account, password));
}

/**
 * Decrypt array of CEX accounts
 * @param {Array} cexAccounts - Array of encrypted CEX account objects
 * @param {string} password - Master password
 * @returns {Array} Array with decrypted CEX accounts
 */
export function decryptCexAccounts(cexAccounts, password) {
    if (!cexAccounts || !Array.isArray(cexAccounts) || !password) {
        return cexAccounts;
    }

    return cexAccounts.map(account => decryptCexAccount(account, password));
}
