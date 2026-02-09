// cex_manager.js - CEX Account Management Module
// Handles adding, removing, testing, and rendering CEX accounts

import { testCexApi } from '../../utils/cex_api.js';
import { encryptCexAccounts, decryptCexAccounts } from '../../utils/encryption.js';
import { getMasterPassword } from '../../utils/password_manager.js';

// CEX account type labels
const CEX_ACCOUNT_TYPES = {
    'binance': 'Spot',
    'okx': 'Trading+Funding+Savings',
    'bybit': 'Unified+Funding+Earn',
    'bitget': 'Spot+Earn',
    'backpack': 'Collateral'
};

/**
 * Add a new CEX account from the form
 */
export async function addCexAccount() {
    const cexName = document.getElementById('cex-name').value;
    const apiKey = document.getElementById('cex-api-key').value.trim();
    const apiSecret = document.getElementById('cex-api-secret').value.trim();
    const passphrase = document.getElementById('cex-passphrase').value.trim();
    const remark = document.getElementById('cex-remark').value.trim() || `${cexName.toUpperCase()} Wallet`;

    if (!apiKey || !apiSecret) {
        alert('API Key and API Secret are required!');
        return;
    }

    if ((cexName === 'okx' || cexName === 'bitget') && !passphrase) {
        alert('Passphrase is required for OKX and Bitget!');
        return;
    }

    // Load existing accounts
    const data = await chrome.storage.local.get(['cexAccounts']);
    let accounts = data.cexAccounts || [];

    // IMPORTANT: Decrypt existing accounts if encrypted
    // Otherwise we'll create a corrupted mixed array (encrypted old + plaintext new)
    if (accounts.length > 0 && accounts[0]?.isEncrypted) {
        const password = await getMasterPassword();
        if (password) {
            accounts = decryptCexAccounts(accounts, password);
            console.log('🔓 Decrypted existing CEX accounts before adding new one');
        } else {
            console.error('⚠️  Cannot add CEX account: existing accounts encrypted but no session');
            alert('Please unlock your password first (Settings → Enter Password)');
            return;
        }
    }

    // Add new account (plaintext)
    accounts.push({
        id: Date.now().toString(),
        cexName: cexName,
        apiKey: apiKey,
        apiSecret: apiSecret,
        passphrase: passphrase,
        remark: remark
    });

    // Encrypt and save ALL accounts
    await saveCexAccounts(accounts);
    renderCexAccountsList(accounts);

    // Clear form
    document.getElementById('cex-api-key').value = '';
    document.getElementById('cex-api-secret').value = '';
    document.getElementById('cex-passphrase').value = '';
    document.getElementById('cex-remark').value = '';

    console.log('CEX account added:', cexName, remark);
}

/**
 * Remove a CEX account by ID
 */
export async function removeCexAccount(id) {
    const data = await chrome.storage.local.get(['cexAccounts']);
    let accounts = data.cexAccounts || [];

    // Decrypt if encrypted
    const password = await getMasterPassword();
    if (password && accounts.length > 0 && accounts[0]?.isEncrypted) {
        accounts = decryptCexAccounts(accounts, password);
    }

    // Remove account
    accounts = accounts.filter(a => a.id !== id);

    // Encrypt and save
    await saveCexAccounts(accounts);
    renderCexAccountsList(accounts);
    console.log('CEX account removed:', id);
}

/**
 * Render the list of CEX accounts
 */
export function renderCexAccountsList(accounts) {
    const list = document.getElementById('cex-accounts-list');
    if (!list) return;

    if (accounts.length === 0) {
        list.innerHTML = '<p class="text-xs text-gray-400 text-center py-2">No CEX accounts configured</p>';
        return;
    }

    // Build HTML without inline event handlers (CSP compliance)
    list.innerHTML = accounts.map((acc, index) => {
        const cexName = (acc.cexName || '').toLowerCase();
        const accountTypes = CEX_ACCOUNT_TYPES[cexName] || '';
        return `
        <div class="flex items-center justify-between bg-white rounded border border-gray-200 px-3 py-2">
            <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-gray-700 uppercase">${acc.cexName}</span>
                ${accountTypes ? `<span class="text-xs text-blue-500">(${accountTypes})</span>` : ''}
                <span class="text-xs text-gray-500">${acc.remark}</span>
                <span class="text-xs text-gray-400">${acc.apiKey.slice(0, 8)}...${acc.apiKey.slice(-4)}</span>
            </div>
            <div class="flex items-center gap-2">
                <span id="cex-test-result-${index}" class="text-xs"></span>
                <button class="cex-test-btn text-blue-500 hover:text-blue-700 text-xs font-medium" 
                    data-index="${index}" id="cex-test-btn-${index}">Test</button>
                <button class="cex-delete-btn text-red-500 hover:text-red-700 text-xs font-medium" 
                    data-id="${acc.id}">Delete</button>
            </div>
        </div>
    `;
    }).join('');

    // Attach event listeners (CSP compliant)
    list.querySelectorAll('.cex-test-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            testCexAccount(index);
        });
    });

    list.querySelectorAll('.cex-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            removeCexAccount(id);
        });
    });
}

/**
 * Test a CEX account API connection
 */
export async function testCexAccount(index) {
    const data = await chrome.storage.local.get(['cexAccounts']);
    let accounts = data.cexAccounts || [];

    // Decrypt if encrypted
    if (accounts.length > 0 && accounts[0]?.isEncrypted) {
        const password = await getMasterPassword();
        if (password) {
            accounts = decryptCexAccounts(accounts, password);
        } else {
            console.error('Cannot test CEX account: encrypted but no active session');
            return;
        }
    }

    if (index < 0 || index >= accounts.length) {
        console.error('Invalid CEX account index');
        return;
    }

    const acc = accounts[index];
    const resultEl = document.getElementById(`cex-test-result-${index}`);
    const btnEl = document.getElementById(`cex-test-btn-${index}`);

    // Show loading state
    if (resultEl) resultEl.innerHTML = '<span class="text-gray-400">Testing...</span>';
    if (btnEl) btnEl.disabled = true;

    try {
        const result = await testCexApi(acc.cexName, acc.apiKey, acc.apiSecret, acc.passphrase || '');

        if (result.success) {
            // Format breakdown for display
            const breakdownStr = Object.entries(result.breakdown)
                .map(([type, val]) => `${type}: $${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
                .join(' | ');

            if (resultEl) {
                resultEl.innerHTML = `<span class="text-green-600" title="${breakdownStr}">✓ $${result.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>`;
            }
            console.log(`✅ ${acc.cexName} test success:`, result.breakdown);
        } else {
            if (resultEl) {
                resultEl.innerHTML = `<span class="text-red-500" title="${result.error}">✗ Error</span>`;
            }
            console.error(`❌ ${acc.cexName} test failed:`, result.error);
        }
    } catch (err) {
        if (resultEl) {
            resultEl.innerHTML = `<span class="text-red-500" title="${err.message}">✗ Error</span>`;
        }
        console.error('Test CEX account error:', err);
    } finally {
        if (btnEl) btnEl.disabled = false;
    }
}

/**
 * Save CEX accounts with encryption
 * @param {Array} accounts - CEX accounts to save
 */
export async function saveCexAccounts(accounts) {
    try {
        const password = await getMasterPassword();
        if (password && accounts.length > 0) {
            // Encrypt before saving
            const encrypted = encryptCexAccounts(accounts, password);
            await chrome.storage.local.set({ cexAccounts: encrypted });
            console.log('🔐 CEX accounts encrypted and saved:', accounts.length, 'accounts');
        } else {
            // No password or no accounts - save unencrypted
            await chrome.storage.local.set({ cexAccounts: accounts });
            console.log('⚠️  CEX accounts saved unencrypted (no password set)');
        }
    } catch (error) {
        console.error('Failed to save CEX accounts:', error);
        // Fallback to unencrypted save
        await chrome.storage.local.set({ cexAccounts: accounts });
    }
}

/**
 * Load CEX accounts from storage and render
 */
export async function loadCexAccounts() {
    const data = await chrome.storage.local.get(['cexAccounts']);
    let accounts = data.cexAccounts || [];

    // Decrypt if encrypted
    if (accounts.length > 0 && accounts[0]?.isEncrypted) {
        try {
            const password = await getMasterPassword();
            if (password) {
                accounts = decryptCexAccounts(accounts, password);
                console.log('🔓 CEX accounts decrypted:', accounts.length, 'accounts');
            } else {
                console.warn('⚠️  CEX accounts are encrypted but no active session');
            }
        } catch (error) {
            console.error('Failed to decrypt CEX accounts:', error);
        }
    }

    renderCexAccountsList(accounts);
    return accounts;
}

/**
 * Initialize CEX UI event listeners
 */
export function initCexUI() {
    const btnAddCex = document.getElementById('btn-add-cex');
    if (btnAddCex) {
        btnAddCex.addEventListener('click', addCexAccount);
    }
}

// Expose globally for legacy compatibility
window.removeCexAccount = removeCexAccount;
window.testCexAccount = testCexAccount;
window.addCexAccount = addCexAccount;

export default {
    initCexUI,
    addCexAccount,
    removeCexAccount,
    testCexAccount,
    loadCexAccounts,
    renderCexAccountsList
};
