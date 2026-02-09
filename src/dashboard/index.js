import './style.css';

// Import modularized utilities
import { t, applyLanguage, setLanguage, getLanguage } from './utils/i18n.js';
import { calculateTiering, calculateConcentration, calculateStorageSecurity } from './utils/health_analysis.js';
import { HEALTH_CONFIG } from './utils/health_config.js';
import { initChart, updateChart, updateTotalTrendChart, updateDetailTrendChart, getCharts } from './utils/chart_utils.js';

// Import new modules
import { analyzePortfolio } from './utils/ai_analysis.js';
import { getOptimizationSuggestions, getQuickPrompt, AI_CONFIG } from './utils/ai_config.js';
import { processOCR, cropTopRight, compressImage } from './utils/ocr_handler.js';
import { parseWalletInput, walletsToCSV, loadSettingsFromStorage, collectSettingsFromForm, populateFormWithSettings, saveSettingsToStorage } from './utils/settings_manager.js';
import { testCexApi } from '../utils/cex_api.js';
import { DEFAULT_SCREENSHOT_DELAY } from '../config.js';

// Import refactored modules
import { initSyncUI, updateStorageDisplay } from './utils/sync_manager.js';
import { initCexUI, loadCexAccounts } from './utils/cex_manager.js';
import { updateHistory, renderTrendCharts, setChartRefs, exportHistoryToCSV, initHistoryUI } from './utils/history_manager.js';
import { initScreenshotUI, showScreenshotPreview, updateScreenshotStatus, processOCRWithUI, loadScreenshotGallery, clearScreenshotGallery } from './utils/screenshot_manager.js';
import { initShareUI, updateShareLanguage } from './utils/share_manager.js';

// --- State ---
let allocationChart = null;
let totalTrendChart = null;
let detailTrendChart = null;
let currentLang = 'en';

// Re-export for compatibility with existing code
function syncChartRefs() {
    const charts = getCharts();
    allocationChart = charts.allocationChart;
    totalTrendChart = charts.totalTrendChart;
    detailTrendChart = charts.detailTrendChart;
}


// --- Date Helper (use local timezone, not UTC) ---
function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- DOM Elements ---
// Modal removed - Settings is now a tab
const inputWallets = document.getElementById('wallets-csv');
const inputOpenRouterApiKey = document.getElementById('openrouter-api-key');
const inputCustomSolanaRpc = document.getElementById('custom-solana-rpc');
const inputDebankDelay = document.getElementById('debank-delay');
const inputEtherscanApiKey = document.getElementById('etherscan-api-key');
const walletListBody = document.getElementById('wallet-list-body');


// --- Tab Switching ---
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    // Deactivate all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    // Show selected tab
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) targetTab.classList.add('active');
    // Activate button
    const targetBtn = document.getElementById(`tab-btn-${tabName}`);
    if (targetBtn) targetBtn.classList.add('active');
}

// Helper function to get current active tab
function getCurrentActiveTab() {
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab) {
        return activeTab.id.replace('tab-', ''); // Returns 'dashboard', 'settings', etc.
    }
    return 'dashboard'; // Default fallback
}

// Make functions globally accessible for share_manager
window.switchTab = switchTab;
window.getCurrentActiveTab = getCurrentActiveTab;

// --- Auto-Save Debounce ---
let saveTimeout = null;
function autoSaveSettings() {
    if (saveTimeout) clearTimeout(saveTimeout);
    const indicator = document.getElementById('save-indicator');
    const status = document.getElementById('save-status');
    if (status) status.textContent = 'Saving...';

    saveTimeout = setTimeout(async () => {
        await saveSettings();
        if (indicator) {
            indicator.classList.remove('hidden');
            setTimeout(() => indicator.classList.add('hidden'), 2000);
        }
        if (status) status.textContent = 'Settings saved!';
        setTimeout(() => {
            if (status) status.textContent = 'Settings auto-save on change';
        }, 2000);
    }, 500);
}

// --- Collapsible Screenshot Gallery ---
function initCollapsibleGallery() {
    const header = document.getElementById('screenshot-gallery-header');
    const content = document.getElementById('gallery-grid');
    if (header && content) {
        header.addEventListener('click', (e) => {
            // Don't toggle if clicking Clear All button
            if (e.target.closest('#btn-clear-screenshots')) return;
            header.classList.toggle('collapsed');
            content.classList.toggle('collapsed');
        });
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Dashboard initialized");

    // Init language dropdown
    const langSelect = document.getElementById('language-select');

    // Language Dropdown Handler
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            currentLang = e.target.value;
            applyLanguage();
            chrome.storage.local.set({ language: currentLang });
        });
    }

    // Load saved language and set dropdown
    const langData = await chrome.storage.local.get(['language']);
    currentLang = langData.language || 'en';
    if (langSelect) {
        langSelect.value = currentLang;
    }
    applyLanguage();

    // Initialize charts and modules
    initChart();
    syncChartRefs();

    // Set chart refs in history_manager
    const charts = getCharts();
    setChartRefs(charts.totalTrendChart, charts.detailTrendChart);

    // Initialize refactored modules
    initSyncUI(autoSaveSettings);
    initCexUI();
    initScreenshotUI();
    initHistoryUI();
    initShareUI(currentLang);

    // Load data
    await loadSettings();
    await loadCexAccounts();
    await loadScreenshotGallery();

    // Table sorting
    setupTableSorting();

    // --- Storage Usage Checker ---
    async function updateStorageDisplay() {
        try {
            const bytesInUse = await chrome.storage.local.getBytesInUse(null);
            const data = await chrome.storage.local.get(null);

            // Format bytes to KB/MB
            const formatSize = (bytes) => {
                if (bytes < 1024) return bytes + ' B';
                if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
                return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
            };

            const totalSize = formatSize(bytesInUse);

            // Sync usage
            let syncText = 'Unknown';
            try {
                const syncBytes = await chrome.storage.sync.getBytesInUse(null);
                const syncData = await chrome.storage.sync.get(null);
                const hasData = Object.keys(syncData).length > 0;
                syncText = formatSize(syncBytes) + ' / 100 KB' + (hasData ? ' ✓' : ' (empty)');
            } catch (e) {
                syncText = 'Not available';
            }

            // Estimate key sizes (rough)
            const getSize = (obj) => new Blob([JSON.stringify(obj)]).size;

            const historySize = data.history ? formatSize(getSize(data.history)) : '0 KB';
            const screenshotsSize = data.screenshots ? formatSize(getSize(data.screenshots)) : '0 KB';

            const elTotal = document.getElementById('storage-total');
            const elHistory = document.getElementById('storage-history');
            const elScreenshots = document.getElementById('storage-screenshots');
            const elSync = document.getElementById('sync-storage-size');
            const elExtId = document.getElementById('extension-id');

            if (elTotal) elTotal.textContent = totalSize;
            if (elHistory) elHistory.textContent = historySize;
            if (elScreenshots) elScreenshots.textContent = screenshotsSize;
            if (elSync) elSync.textContent = syncText;
            if (elExtId) elExtId.textContent = chrome.runtime.id || 'Unknown';

            console.log('Storage Check:', { local: totalSize, sync: syncText, extensionId: chrome.runtime.id });
        } catch (e) {
            console.error('Storage check failed:', e);
        }
    }

    const btnCheckStorage = document.getElementById('btn-check-storage');
    if (btnCheckStorage) {
        btnCheckStorage.addEventListener('click', updateStorageDisplay);
    }

    // Check on load (tab switch)
    const tabSettingsBtn = document.getElementById('tab-btn-settings');
    if (tabSettingsBtn) {
        tabSettingsBtn.addEventListener('click', () => {
            // Delay slightly to let tab switch happen
            setTimeout(updateStorageDisplay, 100);
        });
    }

    // Force Sync button handler is registered in sync_manager.js via initSyncUI()

    // --- Tab Navigation ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });

    // Check URL hash for initial tab
    if (window.location.hash === '#settings') {
        switchTab('settings');
    }

    // --- Collapsible Gallery ---
    initCollapsibleGallery();

    // --- Auto-save listeners for Settings inputs ---
    const autoSaveInputs = [
        'wallets-csv',
        'openrouter-api-key',
        'siliconflow-api-key',
        'etherscan-api-key',
        'debank-delay',
        'custom-solana-rpc',
        'jup-delay'
    ];
    autoSaveInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', autoSaveSettings);
            el.addEventListener('input', autoSaveSettings);
        }
    });

    // Auto-save for radio buttons
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', autoSaveSettings);
    });

    // Auto-save for sync sub-options
    const syncSubOptions = ['sync-wallets', 'sync-ai-api', 'sync-evm-api', 'sync-sol-api', 'sync-cex-api'];
    syncSubOptions.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', autoSaveSettings);
        }
    });

    // Sync checkbox change listener
    const syncCheckbox = document.getElementById('enable-cloud-sync');
    if (syncCheckbox) {
        syncCheckbox.addEventListener('change', async () => {
            const syncOptionsPanel = document.getElementById('sync-options');

            if (syncCheckbox.checked) {
                // Test if Chrome sync is truly available
                try {
                    // Write a test value to sync storage
                    await chrome.storage.sync.set({ _syncTest: Date.now() });
                    const testData = await chrome.storage.sync.get(['_syncTest']);
                    await chrome.storage.sync.remove(['_syncTest']);

                    // Also check actual sync status by trying to get QUOTA_BYTES
                    // If sync is not available, SYNC_QUOTA might not work properly
                    const bytesInUse = await chrome.storage.sync.getBytesInUse(null);

                    // If we got here, sync storage is working (though might be local-only)
                    // Show a helpful message about Chrome login status
                    // Note: Chrome doesn't expose identity API without user gesture typically
                    // So we just inform the user about the requirement

                    console.log('Sync storage test passed, bytes in use:', bytesInUse);

                    // Update UI to show sync is active
                    const syncStatus = document.getElementById('sync-status');
                    const forceSyncBtn = document.getElementById('btn-force-sync');
                    if (syncStatus) {
                        syncStatus.textContent = t('syncActive');
                        syncStatus.className = 'text-xs font-mono px-2 py-1 rounded bg-green-100 text-green-700';
                    }
                    if (forceSyncBtn) forceSyncBtn.classList.remove('hidden');
                    if (syncOptionsPanel) syncOptionsPanel.classList.remove('hidden');

                } catch (error) {
                    console.error('Sync storage not available:', error);
                    // Show warning
                    alert(t('syncWarningTitle') + '\n\n' + t('syncNotAvailable'));
                    syncCheckbox.checked = false;
                    return;
                }
            } else {
                // Sync disabled - update UI
                const syncStatus = document.getElementById('sync-status');
                const forceSyncBtn = document.getElementById('btn-force-sync');
                if (syncStatus) {
                    syncStatus.textContent = t('localOnly');
                    syncStatus.className = 'text-xs font-mono px-2 py-1 rounded bg-gray-200 text-gray-600';
                }
                if (forceSyncBtn) forceSyncBtn.classList.add('hidden');
                if (syncOptionsPanel) syncOptionsPanel.classList.add('hidden');
            }

            // Auto-save the setting
            autoSaveSettings();
        });
    }
});

// --- Event Listeners ---
const btnExportCsv = document.getElementById('btn-export-csv');
const btnUpdate = document.getElementById('btn-update'); // Get reference

if (btnExportCsv) {
    btnExportCsv.addEventListener('click', exportHistoryToCSV);
}

// EVM Source radio button listeners
const evmEtherscanRadio = document.getElementById('evm-source-etherscan');
const evmDebankRadio = document.getElementById('evm-source-debank');
if (evmEtherscanRadio) {
    evmEtherscanRadio.addEventListener('change', () => {
        toggleEtherscanKeySection(true);
        toggleDebankDelaySection(false);
    });
}
if (evmDebankRadio) {
    evmDebankRadio.addEventListener('change', () => {
        toggleEtherscanKeySection(false);
        toggleDebankDelaySection(true);
    });
}

// SOL Source radio button listeners
const solHeliusRadio = document.getElementById('sol-source-helius');
const solJupRadio = document.getElementById('sol-source-jup');
if (solHeliusRadio) {
    solHeliusRadio.addEventListener('change', () => {
        toggleSolanaRpcSection(true);
        toggleJupDelaySection(false);
    });
}
if (solJupRadio) {
    solJupRadio.addEventListener('change', () => {
        toggleSolanaRpcSection(false);
        toggleJupDelaySection(true);
    });
}

// AI Provider radio button listeners
const aiOpenRouterRadio = document.getElementById('ai-provider-openrouter');
const aiSiliconFlowRadio = document.getElementById('ai-provider-siliconflow');
if (aiOpenRouterRadio) {
    aiOpenRouterRadio.addEventListener('change', () => {
        toggleOpenRouterSection(true);
        toggleSiliconFlowSection(false);
    });
}
if (aiSiliconFlowRadio) {
    aiSiliconFlowRadio.addEventListener('change', () => {
        toggleOpenRouterSection(false);
        toggleSiliconFlowSection(true);
    });
}

// Add CEX Account button
const btnAddCex = document.getElementById('btn-add-cex');
if (btnAddCex) {
    btnAddCex.addEventListener('click', addCexAccount);
}

// File Upload Handler
const fileUpload = document.getElementById('wallets-file-upload');
if (fileUpload) {
    fileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            let content = event.target.result;

            // Strip header row if present (first row starting with Address/地址/Wallet)
            const lines = content.trim().split('\n');
            if (lines.length > 0) {
                const firstLine = lines[0].toLowerCase();
                if (firstLine.includes('address') || firstLine.includes('地址') || firstLine.includes('wallet')) {
                    lines.shift(); // Remove header row
                    content = lines.join('\n');
                }
            }

            // Populate textarea with file contents (header stripped)
            if (inputWallets) {
                inputWallets.value = content;
            }
        };
        reader.readAsText(file);
        // Trigger auto-save after file upload
        setTimeout(autoSaveSettings, 100);
    });
}

// Modal logic removed - Settings is now a tab

// --- Donation Modal ---
const donationModal = document.getElementById('donation-modal');
const btnDonate = document.getElementById('btn-donate');
const btnCloseDonate = document.getElementById('btn-close-donate');

if (btnDonate) {
    btnDonate.addEventListener('click', () => {
        donationModal.classList.remove('hidden');
    });
}

if (btnCloseDonate) {
    btnCloseDonate.addEventListener('click', () => {
        donationModal.classList.add('hidden');
    });
}

if (donationModal) {
    donationModal.addEventListener('click', (e) => {
        if (e.target === donationModal) donationModal.classList.add('hidden');
    });
}

// --- Portfolio Analysis ---
const btnAnalyze = document.getElementById('btn-analyze');
const analysisModel = document.getElementById('analysis-model');
const analysisResult = document.getElementById('analysis-result');
const analysisPrompt = document.getElementById('analysis-prompt');

// Quick prompt buttons
document.querySelectorAll('.quick-prompt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const text = btn.textContent.trim();
        if (analysisPrompt) {
            analysisPrompt.value = text;
            analysisPrompt.focus();
        }
    });
});

if (btnAnalyze) {
    btnAnalyze.addEventListener('click', async () => {
        // Load settings with proper decryption
        const { settings, wallets } = await loadSettingsFromStorage();

        // === DEBUG: 验证钱包数据 ===
        console.log('=== Portfolio Analysis Debug ===');
        console.log('📊 Wallets loaded:', wallets.length, 'wallets');
        console.log('🔑 Settings encrypted?:', settings.isEncrypted === true);
        console.log('🔓 API Keys available:', {
            openRouter: !!settings.openRouterApiKey,
            siliconFlow: !!settings.siliconFlowApiKey,
            etherscan: !!settings.etherscanApiKey
        });
        wallets.forEach((w, i) => {
            console.log(`  [${i}] ${w.chain_type}: ${w.remark || w.address.slice(0, 10)}... = $${w.balance?.toFixed(2) || 0}`);
        });

        if (wallets.length === 0) {
            analysisResult.innerHTML = `<p class="text-red-500">${t('noWalletsError')}</p>`;
            return;
        }

        // Show loading
        analysisResult.innerHTML = `<p class="text-blue-500">${t('analyzing')}</p>`;
        btnAnalyze.disabled = true;

        try {
            const selectedModel = analysisModel.value;
            const promptInput = document.getElementById('analysis-prompt');
            const customPrompt = promptInput ? promptInput.value.trim() : '';
            const result = await analyzePortfolio(wallets, selectedModel, settings, customPrompt);
            analysisResult.innerHTML = `<div class="whitespace-pre-wrap">${result}</div>`;

            // Show optimization suggestions after AI analysis
            const tiering = calculateTiering(wallets);
            const concentration = calculateConcentration(wallets, wallets.reduce((s, w) => s + (w.balance || 0), 0));
            const storageSec = calculateStorageSecurity(wallets);
            renderOptimizationSuggestions({ tiering, concentration, storageSec });
        } catch (err) {
            console.error('Analysis failed:', err);
            analysisResult.innerHTML = `<p class="text-red-500">${t('analysisFailed')}${err.message}</p>`;
        } finally {
            btnAnalyze.disabled = false;
        }
    });
}


// analyzePortfolio is now imported from ./utils/ai_analysis.js

// Form submit removed - auto-save handles this now

btnUpdate.addEventListener('click', async () => {
    // Check if on Settings page, switch to Dashboard first
    const currentTab = getCurrentActiveTab();
    if (currentTab === 'settings') {
        switchTab('dashboard');
        // Small delay to let tab switch complete
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (btnUpdate.disabled) return;
    btnUpdate.disabled = true;
    btnUpdate.textContent = t('updateAll') + '...'; // Keep original text for consistency

    console.log("Requesting update...");

    // Clear screenshot history before new update
    await clearScreenshotGallery();

    chrome.runtime.sendMessage({ action: "START_UPDATE" }, (response) => {
        console.log("Update response:", response);
        if (response && response.status === 'busy') {
            alert(currentLang === 'cn' ? '更新正在进行中' : 'Update already in progress.');
        }
    });
});

// Track progress and countdown separately
let updateProgressText = '';
let updateCountdownText = '';

function updateButtonText() {
    if (updateProgressText || updateCountdownText) {
        const parts = [];
        if (updateProgressText) parts.push(updateProgressText);
        if (updateCountdownText) parts.push(updateCountdownText);
        btnUpdate.textContent = parts.join(' ');
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "UPDATE_STATUS") {
        const { current, total } = message.payload;
        updateProgressText = `Updating (${current}/${total})...`;
        updateButtonText();
    }
    else if (message.action === "COUNTDOWN") {
        const { remaining } = message.payload;
        if (remaining > 0) {
            updateCountdownText = `⏱️ ${remaining}s`;
        } else {
            updateCountdownText = '';
        }
        updateButtonText();
    }
    else if (message.action === "REFRESH_DATA") {
        console.log("Refreshing data...");
        loadSettings(); // Reloads wallets from storage
    }
    else if (message.action === "UPDATE_COMPLETE") {
        updateProgressText = '';
        updateCountdownText = '';
        btnUpdate.disabled = false;
        btnUpdate.textContent = t('updateAll');
        // Hide screenshot panel after completion
        const panel = document.getElementById('screenshot-panel');
        if (panel) panel.classList.add('hidden');
        // Update completed silently (no alert)

        // Trigger History Update
        chrome.storage.local.get(['wallets']).then(data => {
            if (data.wallets) {
                updateHistory(data.wallets);
            }
        });

        // Auto-trigger Portfolio Analysis
        if (btnAnalyze) {
            btnAnalyze.click();
        }
    }
    else if (message.action === "PROCESS_OCR") {
        // --- OCR HANDLER ---
        const { imageBase64, address, screenshotType } = message.payload;
        console.log("Received OCR Request, processing...", { address, screenshotType });

        // Display screenshot preview
        showScreenshotPreview(imageBase64, address || 'Unknown');

        processOCRWithUI(imageBase64, address, screenshotType || 'debank').then((result) => {
            console.log("OCR Result:", result);
            updateScreenshotStatus('OCR Complete ✓');
            // Send back the balance directly (parsed in dashboard)
            sendResponse({ text: result.text, balance: result.balance });
        }).catch(err => {
            console.error("OCR Failed:", err);
            updateScreenshotStatus('OCR Failed ✗');
            sendResponse({ error: err.message });
        });

        return true; // Keep channel open for async response
    }
});

// Screenshot functions are now imported from screenshot_manager.js
// showScreenshotPreview, updateScreenshotStatus, processOCRWithUI, 
// saveScreenshot, loadScreenshotGallery, clearScreenshotGallery, showFullScreenshot

/**
 * Update the portfolio stats cards (On-chain, CEX, Since Last)
 * @param {Array} wallets - Current wallet data
 */
async function updateStatsCards(wallets) {
    // Calculate On-chain and CEX counts
    const onChainCount = wallets.filter(w => !w.isCex).length;
    const cexCount = wallets.filter(w => w.isCex).length;

    // Update DOM
    const statOnchain = document.getElementById('stat-onchain');
    const statCex = document.getElementById('stat-cex');
    const statSinceLast = document.getElementById('stat-since-last');

    if (statOnchain) statOnchain.textContent = onChainCount;
    if (statCex) statCex.textContent = cexCount;

    // Calculate "Since Last" from history
    try {
        const data = await chrome.storage.local.get(['history']);
        const history = data.history || [];

        if (history.length > 0) {
            // Get unique dates sorted descending
            const dates = [...new Set(history.map(r => r.date))].sort((a, b) => b.localeCompare(a));

            if (dates.length >= 2) {
                const latestDate = dates[0];
                const previousDate = dates[1];

                // Get total balance for each date
                const latestTotal = history.find(r => r.date === latestDate && r.chain_type === 'summary')?.balance || 0;
                const previousTotal = history.find(r => r.date === previousDate && r.chain_type === 'summary')?.balance || 0;

                const change = latestTotal - previousTotal;
                const isPositive = change >= 0;

                // Update DOM with color
                if (statSinceLast) {
                    statSinceLast.textContent = `${isPositive ? '+' : '-'}$${Math.abs(change).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
                    statSinceLast.style.color = isPositive ? '#10B981' : '#EF4444';
                }
            }
        }
    } catch (e) {
        console.error('Failed to calculate Since Last:', e);
    }
}

async function loadSettings() {
    // Use the settings manager which handles cloud vs local timestamp comparison
    const { settings, wallets } = await loadSettingsFromStorage();

    // Fill Form with saved values
    if (inputOpenRouterApiKey && settings.openRouterApiKey) {
        inputOpenRouterApiKey.value = settings.openRouterApiKey;
    }
    if (inputCustomSolanaRpc && settings.customSolanaRpc) {
        inputCustomSolanaRpc.value = settings.customSolanaRpc;
    }
    if (inputDebankDelay) {
        inputDebankDelay.value = settings.debankDelay || 3000;
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
        toggleEtherscanKeySection(evmSource === 'etherscan');
        toggleDebankDelaySection(evmSource === 'debank');
    }

    // Load SOL Source radio
    const solSource = settings.solSource || 'jup';
    const solHeliusRadio = document.getElementById('sol-source-helius');
    const solJupRadio = document.getElementById('sol-source-jup');
    if (solHeliusRadio && solJupRadio) {
        solHeliusRadio.checked = solSource === 'helius';
        solJupRadio.checked = solSource === 'jup';
        toggleSolanaRpcSection(solSource === 'helius');
        toggleJupDelaySection(solSource === 'jup');
    }

    // Load Jup delay value
    const jupDelayInput = document.getElementById('jup-delay');
    if (jupDelayInput) {
        jupDelayInput.value = settings.jupDelay || 3000;
    }

    // Load AI Provider radio
    const aiProvider = settings.aiProvider || 'openrouter';
    const aiOpenRouterRadio = document.getElementById('ai-provider-openrouter');
    const aiSiliconFlowRadio = document.getElementById('ai-provider-siliconflow');
    if (aiOpenRouterRadio && aiSiliconFlowRadio) {
        aiOpenRouterRadio.checked = aiProvider === 'openrouter';
        aiSiliconFlowRadio.checked = aiProvider === 'siliconflow';
        toggleOpenRouterSection(aiProvider === 'openrouter');
        toggleSiliconFlowSection(aiProvider === 'siliconflow');
    }

    // Load SiliconFlow API Key
    const siliconFlowKeyInput = document.getElementById('siliconflow-api-key');
    if (siliconFlowKeyInput && settings.siliconFlowApiKey) {
        siliconFlowKeyInput.value = settings.siliconFlowApiKey;
    }

    // Sync model dropdown with AI provider
    syncModelDropdownWithProvider(aiProvider);

    // Convert wallets array back to CSV for display if not empty
    if (wallets.length > 0) {
        inputWallets.value = wallets.map(w => `${w.address}, ${w.chain_type}, ${w.remark || ''}, ${w.wallet_type || 'hot'}`).join('\n');
    }

    renderTable(wallets);

    // Load CEX accounts
    await loadCexAccounts();

    // Load Sync Checkbox state
    const syncCheckbox = document.getElementById('enable-cloud-sync');
    if (syncCheckbox) {
        syncCheckbox.checked = settings.syncEnabled || false;

        // Update sync status display
        const syncStatus = document.getElementById('sync-status');
        const forceSyncBtn = document.getElementById('btn-force-sync');
        if (syncStatus) {
            if (settings.syncEnabled) {
                syncStatus.textContent = t('syncActive');
                syncStatus.className = 'text-xs font-mono px-2 py-1 rounded bg-green-100 text-green-700';
                if (forceSyncBtn) forceSyncBtn.classList.remove('hidden');
            } else {
                syncStatus.textContent = t('localOnly');
                syncStatus.className = 'text-xs font-mono px-2 py-1 rounded bg-gray-200 text-gray-600';
                if (forceSyncBtn) forceSyncBtn.classList.add('hidden');
            }
        }
    }

    // Load History for Charts
    const historyData = await chrome.storage.local.get(['history']);
    if (historyData.history) {
        renderTrendCharts(historyData.history);
    }

    // Update stats cards (On-chain, CEX, Since Last)
    await updateStatsCards(wallets);
}

// Helper to show/hide Etherscan API key section based on EVM source
function toggleEtherscanKeySection(show) {
    const section = document.getElementById('etherscan-key-section');
    if (section) {
        section.style.display = show ? 'block' : 'none';
    }
}

// Helper to show/hide DeBank delay section
function toggleDebankDelaySection(show) {
    const section = document.getElementById('debank-delay-section');
    if (section) {
        section.style.display = show ? 'block' : 'none';
    }
}

// Helper to show/hide Solana RPC section based on SOL source
function toggleSolanaRpcSection(show) {
    const section = document.getElementById('solana-rpc-section');
    if (section) {
        section.style.display = show ? 'block' : 'none';
    }
}

// Helper to show/hide Jup.ag delay section
function toggleJupDelaySection(show) {
    const section = document.getElementById('jup-delay-section');
    if (section) {
        section.style.display = show ? 'block' : 'none';
    }
}

// Helper to show/hide OpenRouter API key section
function toggleOpenRouterSection(show) {
    const section = document.getElementById('openrouter-key-section');
    if (section) {
        section.style.display = show ? 'block' : 'none';
    }
}

// Helper to show/hide SiliconFlow API key section
function toggleSiliconFlowSection(show) {
    const section = document.getElementById('siliconflow-key-section');
    if (section) {
        section.style.display = show ? 'block' : 'none';
    }
}

// Sync model dropdown with AI provider
function syncModelDropdownWithProvider(provider) {
    const modelSelect = document.getElementById('analysis-model');
    if (!modelSelect) return;

    // Find the first option matching the provider
    const options = modelSelect.options;
    for (let i = 0; i < options.length; i++) {
        const optionProvider = options[i].value.split(':')[0];
        if (optionProvider === provider) {
            modelSelect.selectedIndex = i;
            console.log('Model dropdown synced to:', options[i].text);
            break;
        }
    }
}

// CEX Account Management functions are now imported from cex_manager.js
// addCexAccount, removeCexAccount, renderCexAccountsList, testCexAccount, loadCexAccounts

// History management functions are now imported from history_manager.js
// updateHistory, renderTrendCharts, exportHistoryToCSV

async function saveSettings() {
    const rawCsv = inputWallets.value.trim();
    const rows = rawCsv.split('\n');
    const wallets = [];

    for (const row of rows) {
        // Skip empty rows
        if (!row.trim()) continue;

        // Split by: comma, tab, OR 2+ spaces
        const cols = row.split(/[,\t]+|\s{2,}/).map(s => s.trim()).filter(s => s.length > 0);

        if (cols.length >= 2) {
            wallets.push({
                address: cols[0],
                chain_type: cols[1].toLowerCase(),
                remark: cols[2] || '', // Remark is optional
                wallet_type: cols[3] ? cols[3].toLowerCase() : 'hot', // 4th column: cold/hot/cex, default hot
                balance: 0, // Reset or keep? For now reset on config change
                last_updated: null,
                status: 'pending'
            });
        }
    }

    // Validate wallet parameters
    const VALID_CHAIN_TYPES = ['evm', 'sol', 'btc', 'cex'];
    const VALID_WALLET_TYPES = ['hot', 'cold', 'cex'];
    const invalidWallets = [];

    wallets.forEach((w, index) => {
        const errors = [];

        if (!VALID_CHAIN_TYPES.includes(w.chain_type)) {
            errors.push(`invalid chain "${w.chain_type}"`);
        }
        if (!VALID_WALLET_TYPES.includes(w.wallet_type)) {
            errors.push(`invalid type "${w.wallet_type}"`);
        }

        if (errors.length > 0) {
            invalidWallets.push({
                row: index + 1,
                address: w.address.length > 10 ? w.address.slice(0, 10) + '...' : w.address,
                errors: errors
            });
        }
    });

    // Clear previous errors
    const ethError = document.getElementById('etherscan-error');
    const solError = document.getElementById('solana-error');
    const openrouterError = document.getElementById('openrouter-error');
    const siliconflowError = document.getElementById('siliconflow-error');
    const walletError = document.getElementById('wallet-error');
    if (ethError) { ethError.textContent = ''; ethError.classList.add('hidden'); }
    if (solError) { solError.textContent = ''; solError.classList.add('hidden'); }
    if (openrouterError) { openrouterError.textContent = ''; openrouterError.classList.add('hidden'); }
    if (siliconflowError) { siliconflowError.textContent = ''; siliconflowError.classList.add('hidden'); }
    if (walletError) { walletError.textContent = ''; walletError.classList.add('hidden'); }

    // Show wallet validation errors
    if (invalidWallets.length > 0) {
        const errorLines = invalidWallets.map(w =>
            `Row ${w.row} (${w.address}): ${w.errors.join(', ')}`
        );
        const errorMsg = `Invalid wallet parameters:\n${errorLines.join('\n')}\n\nValid chains: evm, sol, btc, cex\nValid types: hot, cold, cex`;

        if (walletError) {
            walletError.textContent = errorMsg;
            walletError.classList.remove('hidden');
            walletError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            alert(errorMsg);
        }
        return;
    }

    // Collect settings using the generalized manager
    const settings = collectSettingsFromForm();

    // UI Validation Logic (since collectSettingsFromForm generic validation is too broad)
    // We check the specific errors to highlight the correct field
    if (settings.error) {
        if (settings.error.includes('Etherscan API Key')) {
            if (ethError) {
                ethError.textContent = settings.error;
                ethError.classList.remove('hidden');
                // Scroll to error
                ethError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                alert(settings.error); // Fallback
            }
        } else if (settings.error.includes('Solana RPC')) {
            if (solError) {
                solError.textContent = settings.error;
                solError.classList.remove('hidden');
                // Scroll to error
                solError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                alert(settings.error); // Fallback
            }
        } else if (settings.error.includes('OpenRouter API Key')) {
            // OpenRouter error
            if (openrouterError) {
                openrouterError.textContent = settings.error;
                openrouterError.classList.remove('hidden');
                openrouterError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                alert(settings.error);
            }
        } else if (settings.error.includes('SiliconFlow API Key')) {
            // SiliconFlow error
            if (siliconflowError) {
                siliconflowError.textContent = settings.error;
                siliconflowError.classList.remove('hidden');
                siliconflowError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                alert(settings.error);
            }
        } else {
            alert(settings.error); // Other errors
        }
        return;
    }

    try {
        await saveSettingsToStorage(settings, wallets);
        console.log("Settings synced/saved", { settings, count: wallets.length });
    } catch (error) {
        console.error("Failed to save settings:", error);
        alert('Failed to save settings: ' + error.message);
    }
}

// ============ Table Sorting ============
let currentSort = { column: 'balance', direction: 'desc' };
let cachedWallets = [];

function setupTableSorting() {
    const headers = document.querySelectorAll('th[data-sort]');
    headers.forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;

            // Toggle direction if same column, else default desc for balance, asc for others
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = column === 'balance' ? 'desc' : 'asc';
            }

            // Update sort icons
            document.querySelectorAll('th[data-sort] .sort-icon').forEach(icon => {
                icon.textContent = '↕';
            });
            const icon = th.querySelector('.sort-icon');
            if (icon) {
                icon.textContent = currentSort.direction === 'asc' ? '↑' : '↓';
            }

            // Re-render table with cached wallets
            if (cachedWallets.length > 0) {
                renderTableSorted(cachedWallets);
            }
        });
    });
}

function renderTableSorted(wallets) {
    walletListBody.innerHTML = '';
    let totalBalance = 0;
    let latestUpdate = 0;

    if (wallets.length === 0) {
        walletListBody.innerHTML = `<tr><td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500" colspan="5">No wallets added. Please configure settings.</td></tr>`;
        document.getElementById('total-balance').textContent = '$0.00';
        return;
    }

    // Sort wallets by current sort settings
    const sortedWallets = [...wallets].sort((a, b) => {
        let valA, valB;

        switch (currentSort.column) {
            case 'chain':
                valA = (a.isCex ? `cex ${a.cexName}` : a.chain_type) || '';
                valB = (b.isCex ? `cex ${b.cexName}` : b.chain_type) || '';
                break;
            case 'remark':
                valA = (a.remark || '').toLowerCase();
                valB = (b.remark || '').toLowerCase();
                break;
            case 'balance':
                valA = a.balance || 0;
                valB = b.balance || 0;
                break;
            case 'status':
                valA = a.status || 'pending';
                valB = b.status || 'pending';
                break;
            case 'source':
                // Sort by source type (debank/etherscan/jup/helius/api)
                valA = (a.isCex ? 'api' : (a.chain_type === 'evm' ? 'etherscan' : 'helius')) || '';
                valB = (b.isCex ? 'api' : (b.chain_type === 'evm' ? 'etherscan' : 'helius')) || '';
                break;
            case 'updated':
                valA = a.last_updated || 0;
                valB = b.last_updated || 0;
                break;
            default:
                valA = a.balance || 0;
                valB = b.balance || 0;
        }

        if (typeof valA === 'string') {
            return currentSort.direction === 'asc'
                ? valA.localeCompare(valB)
                : valB.localeCompare(valA);
        }
        return currentSort.direction === 'asc' ? valA - valB : valB - valA;
    });

    sortedWallets.forEach(w => {
        totalBalance += w.balance || 0;
        if (w.last_updated && w.last_updated > latestUpdate) {
            latestUpdate = w.last_updated;
        }

        let chainDisplay, addressDisplay;
        if (w.isCex) {
            chainDisplay = `CEX (${w.cexName ? w.cexName.charAt(0).toUpperCase() + w.cexName.slice(1) : 'Unknown'})`;
            addressDisplay = '(API)';
        } else {
            chainDisplay = w.chain_type;
            addressDisplay = w.address
                ? `${w.address.substring(0, 6)}...${w.address.substring(w.address.length - 4)}`
                : '(Manual)';
        }

        const remarkDisplay = w.remark || 'Wallet';
        const statusClass = w.status === 'success' ? 'bg-green-100 text-green-800'
            : w.status === 'error' ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800';

        // Updated with date and time
        const updatedTime = w.last_updated
            ? new Date(w.last_updated).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '--';

        // Determine source: API or Screenshot
        // Screenshot = Debank (check from stored settings or chain type detection)
        // API = CEX, BTC, or EVM/SOL with API source
        const chain = (w.chain_type || '').toLowerCase();
        // For now: CEX and BTC always API, EVM/SOL depend on whether they use debank (screenshot)
        // Since we don't have per-wallet source, assume: CEX/BTC = API, others show based on config
        const isApiSource = w.isCex || chain === 'btc' || chain === 'bitcoin';
        const sourceEmoji = isApiSource ? '🔌' : '📸';
        const sourceTitle = isApiSource ? 'API' : 'Screenshot';

        // Determine storage type from wallet_type field (4th column)
        const walletType = (w.wallet_type || 'hot').toLowerCase();
        let storageEmoji = '🔥'; // Default: Hot
        let storageType = 'hot';
        let cexLogoHtml = '';

        if (w.isCex || walletType === 'cex') {
            storageType = 'cex';
            // Check for CEX logo image
            const cexName = (w.cexName || '').toLowerCase();
            const supportedCex = ['binance', 'okx', 'bybit', 'bitget', 'backpack'];
            if (supportedCex.includes(cexName)) {
                cexLogoHtml = `<img src="assets/cex/${cexName}.png" alt="${cexName}" class="w-5 h-5 inline-block" title="${cexName}">`;
            } else {
                cexLogoHtml = '<span title="cex">🏦</span>';
            }
        } else if (walletType === 'cold') {
            storageEmoji = '🧊';
            storageType = 'cold';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium capitalize">${chainDisplay}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                <div class="font-medium text-gray-900">${remarkDisplay} ${w.isCex || walletType === 'cex' ? cexLogoHtml : `<span title="${storageType}">${storageEmoji}</span>`}</div>
                <div class="flex items-center gap-2 font-mono text-xs text-gray-400">
                    <span>${addressDisplay}</span>
                    ${w.address ? `
                    <button class="btn-copy text-gray-400 hover:text-blue-500 transition transform duration-200" title="Copy address" data-address="${w.address}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                    ` : ''}
                </div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">$${(w.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-center">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
                    ${w.status || 'pending'}
                </span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-center" title="${sourceTitle}">
                <span class="text-lg">${sourceEmoji}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-400 text-right">${updatedTime}</td>
        `;

        // Add event listener for copy button
        const copyBtn = tr.querySelector('.btn-copy');
        if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const address = copyBtn.getAttribute('data-address');
                navigator.clipboard.writeText(address).then(() => {
                    const originalHtml = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<span class="text-green-500">✓</span>';
                    copyBtn.classList.add('scale-110');
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHtml;
                        copyBtn.classList.remove('scale-110');
                    }, 1500);
                });
            });
        }

        walletListBody.appendChild(tr);
    });

    document.getElementById('total-balance').textContent = '$' + totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const lastUpdateEl = document.getElementById('last-update-time');
    if (lastUpdateEl && latestUpdate > 0) {
        const updateDate = new Date(latestUpdate);
        lastUpdateEl.textContent = `Last updated: ${updateDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    }
}

// ============ Asset Health Analysis Rendering ============
function renderAssetHealth(wallets) {
    const totalBalance = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);

    // 1. Risk Tiering - Progress bars with emoji
    const tiering = calculateTiering(wallets);

    // Update tier values and progress bars
    document.getElementById('tier1-value').textContent =
        `$${tiering.tiers.tier1.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${tiering.tiers.tier1.percent.toFixed(1)}%)`;
    document.getElementById('tier2-value').textContent =
        `$${tiering.tiers.tier2.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${tiering.tiers.tier2.percent.toFixed(1)}%)`;
    document.getElementById('tier3-value').textContent =
        `$${tiering.tiers.tier3.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${tiering.tiers.tier3.percent.toFixed(1)}%)`;

    document.getElementById('tier1-bar').style.width = `${tiering.tiers.tier1.percent}%`;
    document.getElementById('tier2-bar').style.width = `${tiering.tiers.tier2.percent}%`;
    document.getElementById('tier3-bar').style.width = `${tiering.tiers.tier3.percent}%`;

    // On-chain risk level label (using onChainRiskLevel, not legacy healthLevel)
    const healthLevelEl = document.getElementById('tiering-health-level');
    const healthText = tiering.onChainRiskLevel === 'safe' ? (currentLang === 'cn' ? '安全' : 'Safe') :
        tiering.onChainRiskLevel === 'warning' ? (currentLang === 'cn' ? '警告' : 'Warning') :
            (currentLang === 'cn' ? '高风险' : 'High Risk');
    healthLevelEl.textContent = healthText;
    healthLevelEl.className = 'text-xs px-2 py-1 rounded-full font-medium ' +
        (tiering.onChainRiskLevel === 'safe' ? 'bg-green-100 text-green-700' :
            tiering.onChainRiskLevel === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700');

    // 2. Concentration Gauge
    const concentration = calculateConcentration(wallets, totalBalance);
    const needleEl = document.getElementById('concentration-needle');
    needleEl.style.left = `${Math.min(concentration.percent, 100)}%`;

    // Dynamically update gauge bar segments based on HEALTH_CONFIG thresholds
    const warningThreshold = HEALTH_CONFIG.concentration.warningThreshold;
    const dangerThreshold = HEALTH_CONFIG.concentration.dangerThreshold;

    document.getElementById('concentration-bar-safe').style.width = `${warningThreshold}%`;
    document.getElementById('concentration-bar-warning').style.width = `${dangerThreshold - warningThreshold}%`;
    document.getElementById('concentration-bar-danger').style.width = `${100 - dangerThreshold}%`;

    document.getElementById('concentration-warning-label').textContent = `${warningThreshold}%`;
    document.getElementById('concentration-danger-label').textContent = `${dangerThreshold}%`;

    document.getElementById('concentration-percent').textContent = `${concentration.percent.toFixed(1)}%`;
    document.getElementById('concentration-max-wallet').textContent =
        concentration.maxWallet ? `${concentration.maxWallet.remark || 'Wallet'}` : '--';

    const levelEl = document.getElementById('concentration-level');
    const levelText = concentration.level === 'safe' ? (currentLang === 'cn' ? '安全' : 'Safe') :
        concentration.level === 'warning' ? (currentLang === 'cn' ? '警告' : 'Warning') :
            (currentLang === 'cn' ? '高风险' : 'High Risk');
    levelEl.textContent = levelText;
    levelEl.className = 'text-xs px-2 py-1 rounded-full font-medium ' +
        (concentration.level === 'safe' ? 'bg-green-100 text-green-700' :
            concentration.level === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700');

    // 3. Storage Distribution
    const storageSec = calculateStorageSecurity(wallets);
    document.getElementById('storage-cold-value').textContent =
        `$${storageSec.storage.cold.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${storageSec.storage.cold.percent.toFixed(1)}%)`;
    document.getElementById('storage-hot-value').textContent =
        `$${storageSec.storage.hot.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${storageSec.storage.hot.percent.toFixed(1)}%)`;
    document.getElementById('storage-cex-value').textContent =
        `$${storageSec.storage.cex.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${storageSec.storage.cex.percent.toFixed(1)}%)`;

    document.getElementById('storage-cold-bar').style.width = `${storageSec.storage.cold.percent}%`;
    document.getElementById('storage-hot-bar').style.width = `${storageSec.storage.hot.percent}%`;
    document.getElementById('storage-cex-bar').style.width = `${storageSec.storage.cex.percent}%`;

    // Storage security level label
    const secLevelEl = document.getElementById('storage-security-level');
    const secText = storageSec.securityLevel === 'safe' ? (currentLang === 'cn' ? '安全' : 'Safe') :
        storageSec.securityLevel === 'warning' ? (currentLang === 'cn' ? '警告' : 'Warning') :
            (currentLang === 'cn' ? '高风险' : 'High Risk');
    secLevelEl.textContent = secText;
    secLevelEl.className = 'text-xs px-2 py-1 rounded-full font-medium ' +
        (storageSec.securityLevel === 'safe' ? 'bg-green-100 text-green-700' :
            storageSec.securityLevel === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700');

    // Note: Optimization suggestions are now rendered after AI analysis, not here
}

// ============ Optimization Suggestions Rendering ============
function renderOptimizationSuggestions(healthData) {
    const section = document.getElementById('optimization-suggestions-section');
    const container = document.getElementById('optimization-suggestions-content');
    if (!container || !section) return;

    const suggestions = getOptimizationSuggestions({
        tiering: healthData.tiering,
        concentration: healthData.concentration,
        storage: healthData.storageSec
    }, currentLang);

    if (suggestions.length === 0) {
        section.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    // Show the section
    section.classList.remove('hidden');

    // Render suggestions with proper layout: message line + links line
    container.innerHTML = suggestions.map(suggestion => {
        // If healthy, show success message
        if (suggestion.type === 'success') {
            return `<div class="text-xs"><span class="px-3 py-1.5 bg-green-100 text-green-700 rounded-full">${suggestion.message}</span></div>`;
        }

        // Message on first line, links on second line
        let html = `<div class="mb-1"><span class="text-xs text-orange-600">${suggestion.message}</span></div>`;

        if (suggestion.links && suggestion.links.length > 0) {
            html += `<div class="flex flex-wrap gap-2">${suggestion.links.map(link => {
                // Determine icon folder and check if icon exists
                const iconFolder = link.iconFolder || 'cex';
                const supportedCexIcons = ['binance', 'okx', 'backpack', 'bitget', 'bybit'];
                const supportedWalletIcons = ['onekey', 'ledger', 'trezor'];
                const hasIcon = (iconFolder === 'cex' && supportedCexIcons.includes(link.icon)) ||
                    (iconFolder === 'wallet' && supportedWalletIcons.includes(link.icon));
                const iconHtml = hasIcon
                    ? `<img src="assets/${iconFolder}/${link.icon}.png" class="w-4 h-4 inline-block mr-1" alt="${link.icon}">`
                    : '';
                return `<a href="${link.url}" target="_blank" rel="noopener" 
                    class="inline-flex items-center px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs rounded-full border border-blue-200 transition">
                    ${iconHtml}${link.label}
                </a>`;
            }).join('')}</div>`;
        }

        return `<div class="mb-3">${html}</div>`;
    }).join('');
}

function renderTable(wallets) {
    cachedWallets = wallets; // Cache for sorting
    renderTableSorted(wallets);
    updateChart(wallets);
    renderAssetHealth(wallets); // Render Asset Health Analysis
}

// Note: initChart and updateChart are now imported from ./utils/chart_utils.js

// --- API Test Buttons ---
const btnTestEtherscan = document.getElementById('btn-test-etherscan');
const btnTestSolana = document.getElementById('btn-test-solana');

// Etherscan API Test
if (btnTestEtherscan) {
    btnTestEtherscan.addEventListener('click', async () => {
        const apiKey = document.getElementById('etherscan-api-key')?.value?.trim();
        const testWallet = document.getElementById('etherscan-test-wallet')?.value?.trim();
        const resultEl = document.getElementById('etherscan-test-result');

        if (!apiKey) {
            resultEl.textContent = '❌ Please enter API key first';
            resultEl.className = 'text-xs mt-2 text-red-500';
            resultEl.classList.remove('hidden');
            return;
        }
        if (!testWallet) {
            resultEl.textContent = '❌ Please enter test wallet address';
            resultEl.className = 'text-xs mt-2 text-red-500';
            resultEl.classList.remove('hidden');
            return;
        }

        btnTestEtherscan.disabled = true;
        btnTestEtherscan.innerHTML = '<span class="animate-spin">⏳</span> Testing...';
        resultEl.classList.add('hidden');

        try {
            const response = await fetch(`https://api.etherscan.io/v2/api?chainid=1&module=account&action=balance&address=${testWallet}&apikey=${apiKey}`);
            const data = await response.json();

            if (data.status === '1' && data.result) {
                const balanceEth = (parseFloat(data.result) / 1e18).toFixed(4);
                resultEl.textContent = `✅ Success! Balance: ${balanceEth} ETH`;
                resultEl.className = 'text-xs mt-2 text-green-600';
            } else {
                resultEl.textContent = `❌ API Error: ${data.message || 'Unknown error'}`;
                resultEl.className = 'text-xs mt-2 text-red-500';
            }
        } catch (err) {
            resultEl.textContent = `❌ Network Error: ${err.message}`;
            resultEl.className = 'text-xs mt-2 text-red-500';
        } finally {
            resultEl.classList.remove('hidden');
            btnTestEtherscan.disabled = false;
            btnTestEtherscan.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Test`;
        }
    });
}

// Solana RPC Test
if (btnTestSolana) {
    btnTestSolana.addEventListener('click', async () => {
        const rpcUrl = document.getElementById('custom-solana-rpc')?.value?.trim();
        const testWallet = document.getElementById('solana-test-wallet')?.value?.trim();
        const resultEl = document.getElementById('solana-test-result');

        if (!rpcUrl) {
            resultEl.textContent = '❌ Please enter RPC URL first';
            resultEl.className = 'text-xs mt-2 text-red-500';
            resultEl.classList.remove('hidden');
            return;
        }
        if (!testWallet) {
            resultEl.textContent = '❌ Please enter test wallet address';
            resultEl.className = 'text-xs mt-2 text-red-500';
            resultEl.classList.remove('hidden');
            return;
        }

        btnTestSolana.disabled = true;
        btnTestSolana.innerHTML = '<span class="animate-spin">⏳</span> Testing...';
        resultEl.classList.add('hidden');

        try {
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getBalance',
                    params: [testWallet]
                })
            });
            const data = await response.json();

            if (data.result && typeof data.result.value !== 'undefined') {
                const balanceSol = (data.result.value / 1e9).toFixed(4);
                resultEl.textContent = `✅ Success! Balance: ${balanceSol} SOL`;
                resultEl.className = 'text-xs mt-2 text-green-600';
            } else if (data.error) {
                resultEl.textContent = `❌ RPC Error: ${data.error.message || 'Unknown error'}`;
                resultEl.className = 'text-xs mt-2 text-red-500';
            } else {
                resultEl.textContent = `❌ Invalid response`;
                resultEl.className = 'text-xs mt-2 text-red-500';
            }
        } catch (err) {
            resultEl.textContent = `❌ Network Error: ${err.message}`;
            resultEl.className = 'text-xs mt-2 text-red-500';
        } finally {
            resultEl.classList.remove('hidden');
            btnTestSolana.disabled = false;
            btnTestSolana.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Test`;
        }
    });
}
