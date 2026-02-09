import { getSolanaBalance, getColdWalletBalance, getBitcoinBalance } from '../utils/chain_api';
import { getEtherscanBalance } from '../utils/etherscan_api';
import { getCexBalance } from '../utils/cex_api';
import { DEBANK_BASE_URL, JUP_BASE_URL, DEFAULT_SCREENSHOT_DELAY } from '../config.js';
import { decryptCexAccounts } from '../utils/encryption.js';
import { getMasterPassword } from '../utils/password_manager.js';

// service_worker.js

// --- State ---
let isUpdating = false;

// --- Event Listeners ---
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: "dashboard.html" });
});

// Listen for messages from Dashboard
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "START_UPDATE") {
        if (isUpdating) {
            sendResponse({ status: "busy" });
            return;
        }
        startUpdateLoop();
        sendResponse({ status: "ok" });
    }
});

// --- Core Logic ---

async function startUpdateLoop() {
    isUpdating = true;
    console.log("Starting update loop...");
    let updateWindow = null;

    try {
        const data = await chrome.storage.local.get(['wallets', 'settings']);
        // Filter out CEX wallets - they will be re-added from cexAccounts
        let wallets = (data.wallets || []).filter(w => !w.isCex && w.chain_type !== 'cex');
        const settings = data.settings || {};

        const evmSource = settings.evmSource || 'etherscan';
        const solSource = settings.solSource || 'helius';

        // Check if we need screenshot window (only for DeBank or Jup.ag)
        const needsScreenshotWindow = wallets.some(w =>
            (w.chain_type === 'evm' && evmSource === 'debank') ||
            (w.chain_type === 'sol' && solSource === 'jup')
        );

        let windowId = null;
        let tabId = null;

        if (needsScreenshotWindow) {
            // Create a dedicated window for screenshot updates
            updateWindow = await createUpdateWindow();
            windowId = updateWindow.windowId;
            tabId = updateWindow.tabId;
            console.log("Screenshot window created for DeBank/Jup.ag");
        } else {
            console.log("Using API-only mode, no screenshot window needed");
        }

        broadcastStatus("Starting Update...", 0, wallets.length);

        for (let i = 0; i < wallets.length; i++) {
            const wallet = wallets[i];
            let balance = 0;
            let status = 'success';

            // Skip unknown chain types
            if (wallet.chain_type !== 'evm' && wallet.chain_type !== 'sol' && wallet.chain_type !== 'btc' && wallet.chain_type !== 'cold wallet') {
                console.warn("Unknown chain type:", wallet.chain_type);
                status = 'skipped';
                continue;
            }

            broadcastStatus(`Processing ${wallet.address || wallet.chain_type}...`, i + 1, wallets.length);

            try {
                if (wallet.chain_type === 'evm') {
                    // Check EVM balance source setting
                    const evmSource = settings.evmSource || 'etherscan'; // Default to etherscan

                    if (evmSource === 'etherscan') {
                        // Use Etherscan API
                        if (!settings.etherscanApiKey) {
                            throw new Error('Etherscan API key required. Please configure in Settings.');
                        }
                        balance = await getEtherscanBalance(wallet.address, settings.etherscanApiKey);
                    } else {
                        // Use DeBank screenshot + OCR
                        const delay = settings.debankDelay || DEFAULT_SCREENSHOT_DELAY;
                        // Broadcast countdown
                        await broadcastCountdown(delay, `DeBank: ${wallet.address.slice(0, 10)}...`);
                        const base64Image = await captureDebank(wallet.address, windowId, tabId, delay);
                        console.log("Sending image to dashboard for OCR...");
                        balance = await requestOCRFromDashboard(base64Image, wallet.address);
                        console.log(`OCR Result for ${wallet.address}:`, balance);
                    }

                } else if (wallet.chain_type === 'sol') {
                    // Check SOL balance source setting
                    const solSource = settings.solSource || 'helius'; // Default to helius

                    if (solSource === 'helius') {
                        // Use Helius RPC
                        balance = await getSolanaBalance(wallet.address);
                    } else {
                        // Use Jup.ag screenshot + OCR (full image, not cropped)
                        const delay = settings.jupDelay || DEFAULT_SCREENSHOT_DELAY;
                        // Broadcast countdown
                        await broadcastCountdown(delay, `Jup.ag: ${wallet.address.slice(0, 10)}...`);
                        const base64Image = await captureJup(wallet.address, windowId, tabId, delay);
                        console.log("Sending Jup.ag image to dashboard for OCR (full image mode)...");
                        // Pass 'jup' type to use full image instead of cropped
                        balance = await requestOCRFromDashboard(base64Image, wallet.address, 'jup');
                        console.log(`Jup.ag OCR Result for ${wallet.address}:`, balance);
                    }

                } else if (wallet.chain_type === 'btc') {
                    // Use new Mempool API
                    balance = await getBitcoinBalance(wallet.address);

                } else if (wallet.chain_type === 'cold wallet') {
                    // Manual logic
                    balance = await getColdWalletBalance(wallet.remark, wallet.chain_type);
                }

                // 3. Update Wallet State
                wallets[i].balance = balance;
                wallets[i].last_updated = Date.now();
                wallets[i].status = status;

                // Save progress incrementally
                await chrome.storage.local.set({ wallets });

                // Refresh Dashboard UI
                chrome.runtime.sendMessage({ action: "REFRESH_DATA" });

            } catch (error) {
                console.error(`Error processing ${wallet.address}:`, error);
                wallets[i].status = 'error';
                await chrome.storage.local.set({ wallets });
            }
        }

        // === Process CEX Accounts ===
        console.log('=== CEX Balance Update Start ===');
        const cexData = await chrome.storage.local.get(['cexAccounts']);
        let cexAccounts = cexData.cexAccounts || [];
        console.log('📦 Raw CEX accounts loaded:', cexAccounts.length, 'accounts');
        console.log('📦 First account encrypted?:', cexAccounts[0]?.isEncrypted);

        // Decrypt CEX accounts if encrypted
        if (cexAccounts.length > 0 && cexAccounts[0]?.isEncrypted) {
            console.log('🔐 CEX accounts are encrypted, attempting to decrypt...');
            try {
                const password = await getMasterPassword();
                console.log('🔑 Master password retrieved?:', !!password);
                if (password) {
                    cexAccounts = decryptCexAccounts(cexAccounts, password);
                    console.log('🔓 CEX accounts decrypted for balance update:', cexAccounts.length);
                    console.log('🔓 First account after decrypt:', {
                        cexName: cexAccounts[0]?.cexName,
                        apiKey: cexAccounts[0]?.apiKey?.substring(0, 8) + '...',
                        hasSecret: !!cexAccounts[0]?.apiSecret,
                        isEncrypted: cexAccounts[0]?.isEncrypted
                    });
                } else {
                    console.error('⚠️  CEX accounts encrypted but no active session - skipping');
                    console.error('⚠️  Please unlock dashboard first (Settings → Enter Password)');
                    cexAccounts = []; // Skip encrypted accounts if no session
                }
            } catch (error) {
                console.error('❌ Failed to decrypt CEX accounts:', error);
                console.error('❌ Error details:', error.message, error.stack);
                cexAccounts = [];
            }
        } else {
            console.log('📝 CEX accounts are not encrypted (or no accounts)');
        }

        if (cexAccounts.length > 0) {
            console.log(`Processing ${cexAccounts.length} CEX accounts...`);

            for (let i = 0; i < cexAccounts.length; i++) {
                const cex = cexAccounts[i];
                broadcastStatus(`Fetching ${cex.cexName.toUpperCase()} balance...`, wallets.length + i + 1, wallets.length + cexAccounts.length);

                try {
                    const result = await getCexBalance(cex.cexName, cex.apiKey, cex.apiSecret, cex.passphrase);

                    // Add CEX as a wallet entry for display
                    const cexWallet = {
                        address: cex.remark,
                        chain_type: `cex`,
                        cexName: cex.cexName,
                        remark: cex.remark,
                        balance: result.balance,
                        last_updated: Date.now(),
                        status: 'success',
                        isCex: true
                    };

                    // Check if this CEX wallet already exists, update or add
                    const existingIndex = wallets.findIndex(w => w.isCex && w.remark === cex.remark && w.cexName === cex.cexName);
                    if (existingIndex >= 0) {
                        wallets[existingIndex] = cexWallet;
                    } else {
                        wallets.push(cexWallet);
                    }

                    console.log(`${cex.cexName.toUpperCase()} ${cex.remark}: $${result.balance.toFixed(2)}`);

                } catch (error) {
                    console.error(`CEX Error (${cex.cexName}):`, error.message);

                    // Add error entry
                    const existingIndex = wallets.findIndex(w => w.isCex && w.remark === cex.remark && w.cexName === cex.cexName);
                    if (existingIndex >= 0) {
                        wallets[existingIndex].status = 'error';
                        wallets[existingIndex].errorMsg = error.message;
                    } else {
                        wallets.push({
                            address: cex.remark,
                            chain_type: 'cex',
                            cexName: cex.cexName,
                            remark: cex.remark,
                            balance: 0,
                            status: 'error',
                            errorMsg: error.message,
                            isCex: true
                        });
                    }
                }

                // Save progress
                await chrome.storage.local.set({ wallets });
                chrome.runtime.sendMessage({ action: "REFRESH_DATA" });
            }
        }

        broadcastStatus("Update Complete!", wallets.length, wallets.length);
        chrome.runtime.sendMessage({ action: "UPDATE_COMPLETE" });

    } catch (e) {
        console.error("Update loop failed:", e);
    } finally {
        if (updateWindow && updateWindow.windowId) {
            chrome.windows.remove(updateWindow.windowId);
        }
        isUpdating = false;
    }
}

function createUpdateWindow() {
    return new Promise(resolve => {
        // Create a new popup window with a placeholder
        // We'll REUSE this tab for all Debank navigations (no extra tabs)
        // focused: false to prevent popup from closing (captureVisibleTab doesn't need focus)
        chrome.windows.create({
            url: 'data:text/html,<html><body style="background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><h1>Loading Debank...</h1></body></html>',
            type: 'popup',
            width: 1280,
            height: 1200,
            focused: false
        }, (win) => {
            // Return both windowId and the initial tabId
            const tabId = win.tabs && win.tabs.length > 0 ? win.tabs[0].id : null;
            resolve({ windowId: win.id, tabId: tabId });
        });
    });
}

/**
 * Generic screenshot capture function
 * @param {string} url - Full URL to navigate to
 * @param {number} windowId - Chrome window ID
 * @param {number} tabId - Chrome tab ID
 * @param {number} delayMs - Delay before capture (for JS rendering)
 * @returns {Promise<string>} - Base64 encoded screenshot
 */
async function captureScreenshot(url, windowId, tabId, delayMs) {
    return new Promise((resolve, reject) => {
        chrome.tabs.update(tabId, { url: url, active: true }, () => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);

            const listener = (updatedTabId, changeInfo, updatedTab) => {
                if (updatedTabId === tabId && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);

                    setTimeout(async () => {
                        try {
                            await chrome.windows.update(windowId, { focused: true });
                            await new Promise(r => setTimeout(r, 500));

                            chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
                                if (chrome.runtime.lastError || !dataUrl) {
                                    console.error("Capture error:", chrome.runtime.lastError);
                                    return reject(chrome.runtime.lastError || "Capture failed");
                                }
                                resolve(dataUrl);
                            });
                        } catch (err) {
                            reject(err);
                        }
                    }, delayMs);
                }
            };

            chrome.tabs.onUpdated.addListener(listener);

            // Fallback timeout
            setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
            }, delayMs + 15000);
        });
    });
}

// Wrapper functions for backward compatibility
async function captureDebank(address, windowId, tabId, delayMs) {
    return captureScreenshot(DEBANK_BASE_URL + address, windowId, tabId, delayMs);
}

async function captureJup(address, windowId, tabId, delayMs) {
    return captureScreenshot(JUP_BASE_URL + address, windowId, tabId, delayMs);
}

async function requestOCRFromDashboard(base64Image, address, screenshotType = 'debank') {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            action: "PROCESS_OCR",
            payload: { imageBase64: base64Image, address: address, screenshotType: screenshotType }
        }, (response) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            if (response && response.error) {
                return reject(new Error(response.error));
            }
            if (response) {
                // Dashboard now parses the balance directly
                const balance = response.balance || 0;
                console.log("Received balance from dashboard OCR:", balance);
                resolve(balance);
            } else {
                reject(new Error("No response from OCR service"));
            }
        });
    });
}

// Note: Balance parsing is now done in dashboard/index.js (cropTopRight + regex)

function broadcastStatus(msg, current, total) {
    chrome.runtime.sendMessage({
        action: "UPDATE_STATUS",
        payload: { msg, current, total }
    });
}

// Broadcast countdown to dashboard (for screenshot delays)
async function broadcastCountdown(delayMs, label) {
    const seconds = Math.ceil(delayMs / 1000);
    for (let i = seconds; i > 0; i--) {
        chrome.runtime.sendMessage({
            action: "COUNTDOWN",
            payload: { remaining: i, label: label }
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    // Clear countdown
    chrome.runtime.sendMessage({
        action: "COUNTDOWN",
        payload: { remaining: 0, label: '' }
    });
}
