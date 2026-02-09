// settings_manager.js - Settings Management Module
// Handles loading and saving of user settings

import { DEFAULT_SCREENSHOT_DELAY } from '../../config.js';
import { t } from './i18n.js';
import { getMasterPassword } from '../../utils/password_manager.js';
import { decryptSettings, encryptSettings, decryptCexAccounts, encryptCexAccounts } from '../../utils/encryption.js';

/**
 * Parse wallet CSV/text input into structured array
 * @param {string} rawInput - Raw CSV/text input
 * @returns {Array} - Array of wallet objects
 */
export function parseWalletInput(rawInput) {
    const rows = rawInput.trim().split('\n');
    const wallets = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.trim()) continue;

        // Split by: comma, tab, OR 2+ spaces
        const cols = row.split(/[,\t]+|\s{2,}/).map(s => s.trim()).filter(s => s.length > 0);

        // Skip header row (first row with common header names)
        if (i === 0 && cols.length >= 2) {
            const firstCol = cols[0].toLowerCase();
            if (firstCol === 'address' || firstCol === '地址' || firstCol === 'wallet') {
                continue; // Skip header row
            }
        }

        if (cols.length >= 2) {
            wallets.push({
                address: cols[0],
                chain_type: cols[1].toLowerCase(),
                remark: cols[2] || '',
                wallet_type: cols[3] ? cols[3].toLowerCase() : 'hot',
                balance: 0,
                last_updated: null,
                status: 'pending'
            });
        }
    }

    return wallets;
}

/**
 * Convert wallets array back to CSV format for display
 * @param {Array} wallets - Array of wallet objects
 * @returns {string} - CSV formatted string
 */
export function walletsToCSV(wallets) {
    return wallets.map(w =>
        `${w.address}, ${w.chain_type}, ${w.remark || ''}, ${w.wallet_type || 'hot'}`
    ).join('\n');
}

/**
 * Load settings from Chrome storage
 * Uses timestamp-based merge: newer data wins (Last-Write-Wins strategy)
 * @returns {Promise<{settings: Object, wallets: Array, cexAccounts: Array}>}
 */
export async function loadSettingsFromStorage() {
    // 1. Load Local data first (fastest, offline support)
    const localData = await chrome.storage.local.get(['settings', 'wallets', 'cexAccounts']);
    let settings = localData.settings || {};
    let wallets = localData.wallets || [];
    let cexAccounts = localData.cexAccounts || [];

    const localTimestamp = settings._timestamp || 0;

    // 2. Check sync storage and compare timestamps
    try {
        const syncData = await chrome.storage.sync.get(['settings', 'wallets', 'cexAccounts']);
        const syncSettings = syncData.settings || {};
        const cloudTimestamp = syncSettings._timestamp || 0;

        console.log('Sync comparison:', { localTimestamp, cloudTimestamp });

        // Only apply cloud data if it's newer than local
        if (cloudTimestamp > localTimestamp) {
            console.log('☁️ Cloud data is newer, applying...');

            // Merge settings (cloud wins)
            settings = { ...settings, ...syncSettings };

            // Wallets: Apply if sync option is enabled
            if (syncSettings.syncWallets !== false && syncData.wallets && syncData.wallets.length > 0) {
                wallets = syncData.wallets;
            }

            // CEX Accounts: Only apply if explicitly enabled (security)
            if (syncSettings.syncCexApi === true && syncData.cexAccounts && syncData.cexAccounts.length > 0) {
                cexAccounts = syncData.cexAccounts;
            }

            console.log('Synced data applied:', {
                settingsKeys: Object.keys(settings).length,
                walletsCount: wallets.length,
                cexAccountsCount: cexAccounts.length
            });

            // Update local cache with cloud data
            await chrome.storage.local.set({ settings, wallets, cexAccounts });
        } else if (localTimestamp > 0) {
            console.log('💾 Local data is newer or equal, keeping local');
        } else if (cloudTimestamp > 0) {
            // Local has no timestamp but cloud has data - this is a new device
            console.log('🆕 New device detected, applying cloud data...');
            settings = { ...settings, ...syncSettings };
            if (syncData.wallets && syncData.wallets.length > 0) {
                wallets = syncData.wallets;
            }
            await chrome.storage.local.set({ settings, wallets, cexAccounts });
        }
    } catch (e) {
        console.warn('Failed to check sync storage:', e);
    }

    // Decrypt settings if encrypted and session is valid
    if (settings.isEncrypted) {
        try {
            const password = await getMasterPassword();
            if (password) {
                settings = decryptSettings(settings, password);
                console.log('✅ Settings decrypted successfully');
            } else {
                console.warn('⚠️ Settings are encrypted but no active session found');
            }
        } catch (error) {
            console.error('❌ Failed to decrypt settings:', error);
        }
    }

    // Decrypt CEX accounts if encrypted and session is valid
    if (cexAccounts && cexAccounts.length > 0 && cexAccounts[0]?.isEncrypted) {
        try {
            const password = await getMasterPassword();
            if (password) {
                cexAccounts = decryptCexAccounts(cexAccounts, password);
                console.log('✅ CEX accounts decrypted successfully');
            } else {
                console.warn('⚠️ CEX accounts are encrypted but no active session found');
            }
        } catch (error) {
            console.error('❌ Failed to decrypt CEX accounts:', error);
        }
    }

    return { settings, wallets, cexAccounts };
}

/**
 * Save settings to Chrome storage
 * Supports granular sync options for different data categories
 * @param {Object} settings - Settings object
 * @param {Array} wallets - Wallets array
 * @param {Array} cexAccounts - CEX accounts array (optional)
 */
export async function saveSettingsToStorage(settings, wallets, cexAccounts = null) {
    // Get cexAccounts from storage if not provided
    if (cexAccounts === null) {
        const data = await chrome.storage.local.get(['cexAccounts']);
        cexAccounts = data.cexAccounts || [];
    }

    // Add timestamp for sync comparison (Last-Write-Wins)
    settings._timestamp = Date.now();

    // Encrypt sensitive data before saving
    let settingsToSave = settings;
    let cexAccountsToSave = cexAccounts;

    try {
        const password = await getMasterPassword();
        if (password) {
            // Encrypt settings if they contain password-type API keys (AI only)
            if (settings.openRouterApiKey || settings.siliconFlowApiKey) {
                settingsToSave = encryptSettings(settings, password);
                console.log('🔐 Settings encrypted before saving (AI API keys only)');
            }

            // Encrypt CEX accounts if they exist
            if (cexAccounts && cexAccounts.length > 0) {
                cexAccountsToSave = encryptCexAccounts(cexAccounts, password);
                console.log('🔐 CEX accounts encrypted before saving');
            }
        } else {
            console.warn('⚠️ No active session - saving unencrypted (backward compatibility)');
        }
    } catch (error) {
        console.error('❌ Encryption failed, saving unencrypted:', error);
    }

    // 1. Always save to Local
    await chrome.storage.local.set({ settings: settingsToSave, wallets, cexAccounts: cexAccountsToSave });

    // 2. If Sync Enabled, save to Cloud based on sub-options
    if (settingsToSave.syncEnabled) {
        try {
            // Build sync data based on enabled options
            const syncData = { settings: { ...settingsToSave } }; // Always sync settings (encrypted if password is set)

            // Sync wallets if enabled (default: true)
            if (settingsToSave.syncWallets !== false) {
                syncData.wallets = wallets;
            }

            // Sync CEX accounts only if explicitly enabled (default: false)
            if (settingsToSave.syncCexApi === true) {
                syncData.cexAccounts = cexAccountsToSave; // Use encrypted version
            }

            // Note: AI API, EVM API, SOL API are part of settings object
            // They will be synced as part of settings if their respective options are enabled

            await chrome.storage.sync.set(syncData);
            console.log("Settings synced to cloud", {
                walletsCount: syncData.wallets?.length || 0,
                cexAccountsCount: syncData.cexAccounts?.length || 0,
                syncOptions: {
                    wallets: settings.syncWallets !== false,
                    aiApi: settings.syncAiApi !== false,
                    evmApi: settings.syncEvmApi !== false,
                    solApi: settings.syncSolApi !== false,
                    cexApi: settings.syncCexApi === true
                }
            });
        } catch (e) {
            console.error("Sync save failed (quota exceeded?):", e);
        }
    }
}

/**
 * Collect settings from form elements
 * @returns {Object|null} - Settings object or null if validation fails
 */
export function collectSettingsFromForm() {
    // Get form element values
    const evmEtherscanRadio = document.getElementById('evm-source-etherscan');
    const evmSource = evmEtherscanRadio && evmEtherscanRadio.checked ? 'etherscan' : 'debank';

    const solHeliusRadio = document.getElementById('sol-source-helius');
    const solSource = solHeliusRadio && solHeliusRadio.checked ? 'helius' : 'jup';

    const inputCustomSolanaRpc = document.getElementById('custom-solana-rpc');
    const solanaRpc = inputCustomSolanaRpc ? inputCustomSolanaRpc.value.trim() : '';

    const inputEtherscanApiKey = document.getElementById('etherscan-api-key');
    const etherscanKey = inputEtherscanApiKey ? inputEtherscanApiKey.value.trim() : '';

    const debankDelayInput = document.getElementById('debank-delay');
    const debankDelay = debankDelayInput ? parseInt(debankDelayInput.value) || DEFAULT_SCREENSHOT_DELAY : DEFAULT_SCREENSHOT_DELAY;

    const jupDelayInput = document.getElementById('jup-delay');
    const jupDelay = jupDelayInput ? parseInt(jupDelayInput.value) || DEFAULT_SCREENSHOT_DELAY : DEFAULT_SCREENSHOT_DELAY;

    const aiOpenRouterRadio = document.getElementById('ai-provider-openrouter');
    const aiProvider = aiOpenRouterRadio && aiOpenRouterRadio.checked ? 'openrouter' : 'siliconflow';

    const inputOpenRouterApiKey = document.getElementById('openrouter-api-key');
    const openRouterKey = inputOpenRouterApiKey ? inputOpenRouterApiKey.value.trim() : '';

    const siliconFlowKeyInput = document.getElementById('siliconflow-api-key');
    const siliconFlowApiKey = siliconFlowKeyInput ? siliconFlowKeyInput.value.trim() : '';

    const syncCheckbox = document.getElementById('enable-cloud-sync');
    const syncEnabled = syncCheckbox ? syncCheckbox.checked : false;

    // Validation
    if (solSource === 'helius' && !solanaRpc) {
        return { error: "Solana RPC URL is required when using Helius!" };
    }
    if (evmSource === 'etherscan' && !etherscanKey) {
        return { error: "Etherscan API Key is required when using Etherscan!" };
    }
    if (aiProvider === 'openrouter' && !openRouterKey) {
        return { error: "OpenRouter API Key is required!" };
    }
    if (aiProvider === 'siliconflow' && !siliconFlowApiKey) {
        return { error: "SiliconFlow API Key is required!" };
    }

    // Collect sync sub-options
    const syncWallets = document.getElementById('sync-wallets');
    const syncAiApi = document.getElementById('sync-ai-api');
    const syncEvmApi = document.getElementById('sync-evm-api');
    const syncSolApi = document.getElementById('sync-sol-api');
    const syncCexApi = document.getElementById('sync-cex-api');

    return {
        ocr_enabled: true,
        update_interval: 24,
        aiProvider,
        openRouterApiKey: openRouterKey,
        siliconFlowApiKey,
        customSolanaRpc: solanaRpc,
        debankDelay,
        jupDelay,
        evmSource,
        etherscanApiKey: etherscanKey,
        solSource,
        syncEnabled,
        // Sync sub-options (default: true except cexApi)
        syncWallets: syncWallets ? syncWallets.checked : true,
        syncAiApi: syncAiApi ? syncAiApi.checked : true,
        syncEvmApi: syncEvmApi ? syncEvmApi.checked : true,
        syncSolApi: syncSolApi ? syncSolApi.checked : true,
        syncCexApi: syncCexApi ? syncCexApi.checked : false
    };
}

/**
 * Populate form with settings values
 * @param {Object} settings - Settings object
 */
export function populateFormWithSettings(settings) {
    const inputOpenRouterApiKey = document.getElementById('openrouter-api-key');
    const inputCustomSolanaRpc = document.getElementById('custom-solana-rpc');
    const inputDebankDelay = document.getElementById('debank-delay');
    const inputEtherscanApiKey = document.getElementById('etherscan-api-key');

    if (inputOpenRouterApiKey && settings.openRouterApiKey) {
        inputOpenRouterApiKey.value = settings.openRouterApiKey;
    }
    if (inputCustomSolanaRpc && settings.customSolanaRpc) {
        inputCustomSolanaRpc.value = settings.customSolanaRpc;
    }
    if (inputDebankDelay) {
        inputDebankDelay.value = settings.debankDelay || DEFAULT_SCREENSHOT_DELAY;
    }
    if (inputEtherscanApiKey && settings.etherscanApiKey) {
        inputEtherscanApiKey.value = settings.etherscanApiKey;
    }

    // Load EVM Source radio
    const evmSource = settings.evmSource || 'debank';
    const evmEtherscanRadio = document.getElementById('evm-source-etherscan');
    const evmDebankRadio = document.getElementById('evm-source-debank');
    if (evmEtherscanRadio && evmDebankRadio) {
        evmEtherscanRadio.checked = evmSource === 'etherscan';
        evmDebankRadio.checked = evmSource === 'debank';
    }

    // Load SOL Source radio
    const solSource = settings.solSource || 'jup';
    const solHeliusRadio = document.getElementById('sol-source-helius');
    const solJupRadio = document.getElementById('sol-source-jup');
    if (solHeliusRadio && solJupRadio) {
        solHeliusRadio.checked = solSource === 'helius';
        solJupRadio.checked = solSource === 'jup';
    }

    // Load Jup delay value
    const jupDelayInput = document.getElementById('jup-delay');
    if (jupDelayInput) {
        jupDelayInput.value = settings.jupDelay || DEFAULT_SCREENSHOT_DELAY;
    }

    // Load AI Provider radio
    const aiProvider = settings.aiProvider || 'openrouter';
    const aiOpenRouterRadio = document.getElementById('ai-provider-openrouter');
    const aiSiliconFlowRadio = document.getElementById('ai-provider-siliconflow');
    if (aiOpenRouterRadio && aiSiliconFlowRadio) {
        aiOpenRouterRadio.checked = aiProvider === 'openrouter';
        aiSiliconFlowRadio.checked = aiProvider === 'siliconflow';
    }

    // Load SiliconFlow API Key
    const siliconFlowKeyInput = document.getElementById('siliconflow-api-key');
    if (siliconFlowKeyInput && settings.siliconFlowApiKey) {
        siliconFlowKeyInput.value = settings.siliconFlowApiKey;
    }

    // Load Sync Checkbox and sub-options
    const syncCheckbox = document.getElementById('enable-cloud-sync');
    const syncOptionsPanel = document.getElementById('sync-options');
    const forceSyncBtn = document.getElementById('btn-force-sync');

    if (syncCheckbox) {
        syncCheckbox.checked = settings.syncEnabled || false;

        // Show/hide sync options panel and Force Sync button
        if (syncOptionsPanel) {
            syncOptionsPanel.classList.toggle('hidden', !settings.syncEnabled);
        }
        if (forceSyncBtn) {
            forceSyncBtn.classList.toggle('hidden', !settings.syncEnabled);
        }

        // Update status text
        const syncStatus = document.getElementById('sync-status');
        if (syncStatus) {
            if (settings.syncEnabled) {
                syncStatus.textContent = t('syncActive');
                syncStatus.className = 'text-xs font-mono px-2 py-1 rounded bg-green-100 text-green-700';
            } else {
                syncStatus.textContent = t('localOnly');
                syncStatus.className = 'text-xs font-mono px-2 py-1 rounded bg-gray-200 text-gray-600';
            }
        }
    }

    // Load sync sub-options
    const syncWallets = document.getElementById('sync-wallets');
    const syncAiApi = document.getElementById('sync-ai-api');
    const syncEvmApi = document.getElementById('sync-evm-api');
    const syncSolApi = document.getElementById('sync-sol-api');
    const syncCexApi = document.getElementById('sync-cex-api');

    if (syncWallets) syncWallets.checked = settings.syncWallets !== false;
    if (syncAiApi) syncAiApi.checked = settings.syncAiApi !== false;
    if (syncEvmApi) syncEvmApi.checked = settings.syncEvmApi !== false;
    if (syncSolApi) syncSolApi.checked = settings.syncSolApi !== false;
    if (syncCexApi) syncCexApi.checked = settings.syncCexApi === true; // Default false for security
}

export default {
    parseWalletInput,
    walletsToCSV,
    loadSettingsFromStorage,
    saveSettingsToStorage,
    collectSettingsFromForm,
    populateFormWithSettings
};
