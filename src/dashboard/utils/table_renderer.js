// table_renderer.js - Table Rendering Module
// Handles wallet table rendering, sorting, and asset health display

import { t, getLanguage } from './i18n.js';
import { calculateTiering, calculateConcentration, calculateStorageSecurity } from './health_analysis.js';

// ============ State ============
let currentSort = { column: 'balance', direction: 'desc' };
let cachedWallets = [];

/**
 * Get current sort state
 */
export function getSortState() {
    return currentSort;
}

/**
 * Set cached wallets
 */
export function setCachedWallets(wallets) {
    cachedWallets = wallets;
}

/**
 * Get cached wallets
 */
export function getCachedWallets() {
    return cachedWallets;
}

/**
 * Setup table header click handlers for sorting
 */
export function setupTableSorting(onSortChange) {
    const headers = document.querySelectorAll('th[data-sort]');
    headers.forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;

            // Toggle direction if same column
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

            // Callback to re-render
            if (onSortChange && cachedWallets.length > 0) {
                onSortChange(cachedWallets);
            }
        });
    });
}

/**
 * Sort wallets based on current sort settings
 */
export function sortWallets(wallets) {
    return [...wallets].sort((a, b) => {
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
}

/**
 * Create a single wallet row element
 */
export function createWalletRow(wallet) {
    const w = wallet;

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

    const updatedTime = w.last_updated
        ? new Date(w.last_updated).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '--';

    const chain = (w.chain_type || '').toLowerCase();
    const isApiSource = w.isCex || chain === 'btc' || chain === 'bitcoin';
    const sourceEmoji = isApiSource ? '🔌' : '📸';
    const sourceTitle = isApiSource ? 'API' : 'Screenshot';

    const walletType = (w.wallet_type || 'hot').toLowerCase();
    let storageEmoji = '🔥';
    let storageType = 'hot';
    if (w.isCex || walletType === 'cex') {
        storageEmoji = '🏦';
        storageType = 'cex';
    } else if (walletType === 'cold') {
        storageEmoji = '🧊';
        storageType = 'cold';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium capitalize">${chainDisplay}</td>
        <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
            <div class="font-medium text-gray-900">${remarkDisplay} <span title="${storageType}">${storageEmoji}</span></div>
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

    // Add copy button handler
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

    return tr;
}

/**
 * Render Asset Health Analysis section
 */
export function renderAssetHealth(wallets) {
    const currentLang = getLanguage();
    const totalBalance = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);

    // 1. Risk Tiering
    const tiering = calculateTiering(wallets);

    const tier1Value = document.getElementById('tier1-value');
    const tier2Value = document.getElementById('tier2-value');
    const tier3Value = document.getElementById('tier3-value');

    if (tier1Value) {
        tier1Value.textContent = `$${tiering.tiers.tier1.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${tiering.tiers.tier1.percent.toFixed(1)}%)`;
    }
    if (tier2Value) {
        tier2Value.textContent = `$${tiering.tiers.tier2.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${tiering.tiers.tier2.percent.toFixed(1)}%)`;
    }
    if (tier3Value) {
        tier3Value.textContent = `$${tiering.tiers.tier3.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${tiering.tiers.tier3.percent.toFixed(1)}%)`;
    }

    const tier1Bar = document.getElementById('tier1-bar');
    const tier2Bar = document.getElementById('tier2-bar');
    const tier3Bar = document.getElementById('tier3-bar');

    if (tier1Bar) tier1Bar.style.width = `${tiering.tiers.tier1.percent}%`;
    if (tier2Bar) tier2Bar.style.width = `${tiering.tiers.tier2.percent}%`;
    if (tier3Bar) tier3Bar.style.width = `${tiering.tiers.tier3.percent}%`;

    // Health level label
    const healthLevelEl = document.getElementById('tiering-health-level');
    if (healthLevelEl) {
        const healthText = tiering.healthLevel === 'safe' ? (currentLang === 'cn' ? '安全' : 'Safe') :
            tiering.healthLevel === 'warning' ? (currentLang === 'cn' ? '警告' : 'Warning') :
                (currentLang === 'cn' ? '高风险' : 'High Risk');
        healthLevelEl.textContent = healthText;
        healthLevelEl.className = 'text-xs px-2 py-1 rounded-full font-medium ' +
            (tiering.healthLevel === 'safe' ? 'bg-green-100 text-green-700' :
                tiering.healthLevel === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700');
    }

    // 2. Concentration
    const concentration = calculateConcentration(wallets, totalBalance);
    const needleEl = document.getElementById('concentration-needle');
    if (needleEl) {
        needleEl.style.left = `${Math.min(concentration.percent, 100)}%`;
    }

    const concPercent = document.getElementById('concentration-percent');
    const concMaxWallet = document.getElementById('concentration-max-wallet');
    if (concPercent) {
        concPercent.textContent = `${concentration.percent.toFixed(1)}%`;
    }
    if (concMaxWallet) {
        concMaxWallet.textContent = concentration.maxWallet ? `${concentration.maxWallet.remark || 'Wallet'}` : '--';
    }

    const levelEl = document.getElementById('concentration-level');
    if (levelEl) {
        const levelText = concentration.level === 'safe' ? (currentLang === 'cn' ? '安全' : 'Safe') :
            concentration.level === 'warning' ? (currentLang === 'cn' ? '警告' : 'Warning') :
                (currentLang === 'cn' ? '高风险' : 'High Risk');
        levelEl.textContent = levelText;
        levelEl.className = 'text-xs px-2 py-1 rounded-full font-medium ' +
            (concentration.level === 'safe' ? 'bg-green-100 text-green-700' :
                concentration.level === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700');
    }

    // 3. Storage Distribution
    const storageSec = calculateStorageSecurity(wallets);

    const coldValue = document.getElementById('storage-cold-value');
    const hotValue = document.getElementById('storage-hot-value');
    const cexValue = document.getElementById('storage-cex-value');

    if (coldValue) {
        coldValue.textContent = `$${storageSec.storage.cold.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${storageSec.storage.cold.percent.toFixed(1)}%)`;
    }
    if (hotValue) {
        hotValue.textContent = `$${storageSec.storage.hot.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${storageSec.storage.hot.percent.toFixed(1)}%)`;
    }
    if (cexValue) {
        cexValue.textContent = `$${storageSec.storage.cex.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${storageSec.storage.cex.percent.toFixed(1)}%)`;
    }

    const coldBar = document.getElementById('storage-cold-bar');
    const hotBar = document.getElementById('storage-hot-bar');
    const cexBar = document.getElementById('storage-cex-bar');

    if (coldBar) coldBar.style.width = `${storageSec.storage.cold.percent}%`;
    if (hotBar) hotBar.style.width = `${storageSec.storage.hot.percent}%`;
    if (cexBar) cexBar.style.width = `${storageSec.storage.cex.percent}%`;

    const secLevelEl = document.getElementById('storage-security-level');
    if (secLevelEl) {
        const secText = storageSec.securityLevel === 'safe' ? (currentLang === 'cn' ? '安全' : 'Safe') :
            storageSec.securityLevel === 'warning' ? (currentLang === 'cn' ? '警告' : 'Warning') :
                (currentLang === 'cn' ? '高风险' : 'High Risk');
        secLevelEl.textContent = secText;
        secLevelEl.className = 'text-xs px-2 py-1 rounded-full font-medium ' +
            (storageSec.securityLevel === 'safe' ? 'bg-green-100 text-green-700' :
                storageSec.securityLevel === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700');
    }
}

export default {
    setupTableSorting,
    sortWallets,
    createWalletRow,
    renderAssetHealth,
    getSortState,
    setCachedWallets,
    getCachedWallets
};
