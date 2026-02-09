// sync_manager.js - Sync UI and Storage Display Module
// Handles Chrome storage sync functionality and storage usage display

import { t } from './i18n.js';

/**
 * Format bytes to human readable KB/MB
 */
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Update storage display with current usage
 */
export async function updateStorageDisplay() {
    try {
        const bytesInUse = await chrome.storage.local.getBytesInUse(null);
        const data = await chrome.storage.local.get(null);

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

        // Display last sync time
        const elLastSync = document.getElementById('last-sync-time');
        if (elLastSync && data.settings && data.settings._timestamp) {
            const lastSyncDate = new Date(data.settings._timestamp);
            elLastSync.textContent = lastSyncDate.toLocaleString();
        } else if (elLastSync) {
            elLastSync.textContent = '--';
        }

        console.log('Storage Check:', { local: totalSize, sync: syncText, extensionId: chrome.runtime.id });
    } catch (e) {
        console.error('Storage check failed:', e);
    }
}

/**
 * Handle Force Sync button click
 */
async function handleForceSync() {
    const btnForceSync = document.getElementById('btn-force-sync');
    if (!btnForceSync) return;

    btnForceSync.textContent = 'Syncing...';
    btnForceSync.disabled = true;

    try {
        // Get current settings and wallets
        const localData = await chrome.storage.local.get(['settings', 'wallets']);
        const settings = localData.settings || {};
        const wallets = localData.wallets || [];

        // Calculate sync data size
        const syncDataSize = new Blob([JSON.stringify({ settings, wallets })]).size;
        console.log('Sync data size:', syncDataSize, 'bytes');

        if (syncDataSize > 100 * 1024) {
            alert(`Sync data too large: ${(syncDataSize / 1024).toFixed(1)} KB (max 100 KB)`);
            return;
        }

        // Force write to sync storage
        await chrome.storage.sync.set({ settings, wallets });
        console.log('Force sync completed:', { settings, walletsCount: wallets.length });

        // Verify
        const syncData = await chrome.storage.sync.get(null);
        console.log('Sync storage now contains:', syncData);

        alert(`Sync completed!\nSettings: ${Object.keys(settings).length} keys\nWallets: ${wallets.length}\nSize: ${(syncDataSize / 1024).toFixed(1)} KB`);

        // Update display
        await updateStorageDisplay();
    } catch (error) {
        console.error('Force sync failed:', error);
        alert('Sync failed: ' + error.message);
    } finally {
        btnForceSync.textContent = t('forceSyncNow');
        btnForceSync.disabled = false;
    }
}

/**
 * Handle sync checkbox change - test availability and update UI
 * @param {Function} autoSaveCallback - Callback to auto-save settings
 */
async function handleSyncCheckboxChange(autoSaveCallback) {
    const syncCheckbox = document.getElementById('enable-cloud-sync');
    const syncOptionsPanel = document.getElementById('sync-options');
    const syncStatus = document.getElementById('sync-status');
    const forceSyncBtn = document.getElementById('btn-force-sync');

    if (!syncCheckbox) return;

    if (syncCheckbox.checked) {
        // Test if Chrome sync is truly available
        try {
            await chrome.storage.sync.set({ _syncTest: Date.now() });
            await chrome.storage.sync.get(['_syncTest']);
            await chrome.storage.sync.remove(['_syncTest']);

            const bytesInUse = await chrome.storage.sync.getBytesInUse(null);
            console.log('Sync storage test passed, bytes in use:', bytesInUse);

            // Update UI to show sync is active
            if (syncStatus) {
                syncStatus.textContent = t('syncActive');
                syncStatus.className = 'text-xs font-mono px-2 py-1 rounded bg-green-100 text-green-700';
            }
            if (forceSyncBtn) forceSyncBtn.classList.remove('hidden');
            if (syncOptionsPanel) syncOptionsPanel.classList.remove('hidden');

        } catch (error) {
            console.error('Sync storage not available:', error);
            alert(t('syncWarningTitle') + '\n\n' + t('syncNotAvailable'));
            syncCheckbox.checked = false;
            return;
        }
    } else {
        // Sync disabled - update UI
        if (syncStatus) {
            syncStatus.textContent = t('localOnly');
            syncStatus.className = 'text-xs font-mono px-2 py-1 rounded bg-gray-200 text-gray-600';
        }
        if (forceSyncBtn) forceSyncBtn.classList.add('hidden');
        if (syncOptionsPanel) syncOptionsPanel.classList.add('hidden');
    }

    // Auto-save the setting
    if (autoSaveCallback) autoSaveCallback();
}

/**
 * Initialize sync UI event listeners
 * @param {Function} autoSaveCallback - Callback function to trigger auto-save
 */
export function initSyncUI(autoSaveCallback) {
    // Storage check button
    const btnCheckStorage = document.getElementById('btn-check-storage');
    if (btnCheckStorage) {
        btnCheckStorage.addEventListener('click', updateStorageDisplay);
    }

    // Update storage on settings tab switch
    const tabSettingsBtn = document.getElementById('tab-btn-settings');
    if (tabSettingsBtn) {
        tabSettingsBtn.addEventListener('click', () => {
            setTimeout(updateStorageDisplay, 100);
        });
    }

    // Force Sync button
    const btnForceSync = document.getElementById('btn-force-sync');
    if (btnForceSync) {
        btnForceSync.addEventListener('click', handleForceSync);
    }

    // Sync checkbox
    const syncCheckbox = document.getElementById('enable-cloud-sync');
    if (syncCheckbox) {
        syncCheckbox.addEventListener('change', () => handleSyncCheckboxChange(autoSaveCallback));
    }

    // Sync sub-options auto-save
    const syncSubOptions = ['sync-wallets', 'sync-ai-api', 'sync-evm-api', 'sync-sol-api', 'sync-cex-api'];
    syncSubOptions.forEach(id => {
        const el = document.getElementById(id);
        if (el && autoSaveCallback) {
            el.addEventListener('change', autoSaveCallback);
        }
    });
}

export default {
    initSyncUI,
    updateStorageDisplay
};
