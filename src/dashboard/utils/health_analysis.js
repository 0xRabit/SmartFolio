// health_analysis.js - Asset Health Analysis Calculations
// Uses thresholds from health_config.js

import { HEALTH_CONFIG } from './health_config.js';

/**
 * Calculate asset tiering pyramid (BTC=Tier1, EVM/SOL=Tier2, CEX=Tier3)
 * Calculates on-chain risk level based on tier2 (EVM+SOL) percentage
 * @param {Array} wallets - Array of wallet objects
 * @returns {Object} { tiers, onChainRiskLevel, total }
 */
export function calculateTiering(wallets) {
    const tiers = {
        tier1: { name: HEALTH_CONFIG.tiers.tier1.name, balance: 0, percent: 0, color: HEALTH_CONFIG.tiers.tier1.color },
        tier2: { name: HEALTH_CONFIG.tiers.tier2.name, balance: 0, percent: 0, color: HEALTH_CONFIG.tiers.tier2.color },
        tier3: { name: HEALTH_CONFIG.tiers.tier3.name, balance: 0, percent: 0, color: HEALTH_CONFIG.tiers.tier3.color }
    };

    wallets.forEach(w => {
        const chain = (w.chain_type || '').toLowerCase();
        if (chain === 'btc' || chain === 'bitcoin') {
            tiers.tier1.balance += w.balance || 0;
        } else if (w.isCex) {
            tiers.tier3.balance += w.balance || 0;
        } else {
            tiers.tier2.balance += w.balance || 0;
        }
    });

    const total = tiers.tier1.balance + tiers.tier2.balance + tiers.tier3.balance;
    Object.values(tiers).forEach(t => t.percent = total > 0 ? (t.balance / total * 100) : 0);

    // Determine on-chain (tier2: EVM+SOL) risk level
    let onChainRiskLevel = 'safe';
    if (tiers.tier2.percent >= HEALTH_CONFIG.onChainRisk.dangerThreshold) onChainRiskLevel = 'highRisk';
    else if (tiers.tier2.percent >= HEALTH_CONFIG.onChainRisk.warningThreshold) onChainRiskLevel = 'warning';

    return { tiers, onChainRiskLevel, total };
}

/**
 * Calculate concentration risk (max single wallet percentage)
 * @param {Array} wallets - Array of wallet objects
 * @param {number} totalBalance - Total portfolio balance
 * @returns {Object} { percent, maxWallet, maxWalletIsBtc, level }
 */
export function calculateConcentration(wallets, totalBalance) {
    if (!wallets.length || totalBalance <= 0) {
        return { percent: 0, maxWallet: null, maxWalletIsBtc: false, level: 'safe' };
    }

    const sorted = [...wallets].sort((a, b) => (b.balance || 0) - (a.balance || 0));
    const maxWallet = sorted[0];
    const percent = (maxWallet.balance / totalBalance) * 100;

    // Check if max wallet is BTC
    const chain = (maxWallet.chain_type || '').toLowerCase();
    const maxWalletIsBtc = chain === 'btc' || chain === 'bitcoin';

    let level = 'safe';
    if (percent >= HEALTH_CONFIG.concentration.dangerThreshold) level = 'highRisk';
    else if (percent >= HEALTH_CONFIG.concentration.warningThreshold) level = 'warning';

    return { percent, maxWallet, maxWalletIsBtc, level };
}

/**
 * Calculate storage security (Cold/Hot/CEX distribution)
 * @param {Array} wallets - Array of wallet objects
 * @returns {Object} { storage, securityLevel }
 */
export function calculateStorageSecurity(wallets) {
    const storage = {
        cold: { balance: 0, percent: 0, wallets: [], color: HEALTH_CONFIG.storageColors.cold },
        hot: { balance: 0, percent: 0, wallets: [], color: HEALTH_CONFIG.storageColors.hot },
        cex: { balance: 0, percent: 0, wallets: [], color: HEALTH_CONFIG.storageColors.cex }
    };

    wallets.forEach(w => {
        const walletType = (w.wallet_type || 'hot').toLowerCase();
        if (w.isCex || walletType === 'cex') {
            storage.cex.balance += w.balance || 0;
            storage.cex.wallets.push(w);
        } else if (walletType === 'cold') {
            storage.cold.balance += w.balance || 0;
            storage.cold.wallets.push(w);
        } else {
            storage.hot.balance += w.balance || 0;
            storage.hot.wallets.push(w);
        }
    });

    const total = storage.cold.balance + storage.hot.balance + storage.cex.balance;
    Object.values(storage).forEach(s => s.percent = total > 0 ? (s.balance / total * 100) : 0);

    // Determine security level based on cold wallet percentage
    // If total assets are 0, consider it safe (nothing at risk)
    let securityLevel = 'highRisk';
    if (total === 0) {
        securityLevel = 'safe';
    } else if (storage.cold.percent >= HEALTH_CONFIG.storage.safeThreshold) {
        securityLevel = 'safe';
    } else if (storage.cold.percent >= HEALTH_CONFIG.storage.warningThreshold) {
        securityLevel = 'warning';
    }

    return { storage, securityLevel };
}

export default {
    calculateTiering,
    calculateConcentration,
    calculateStorageSecurity
};
