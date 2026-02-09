// health_config.js - Health Analysis Configuration
// Centralized thresholds for asset health analysis

/**
 * Health Analysis Thresholds Configuration
 */
export const HEALTH_CONFIG = {
    // On-chain Risk thresholds (based on EVM+SOL on-chain asset percentage)
    onChainRisk: {
        dangerThreshold: 70,   // >= 70% on-chain = danger
        warningThreshold: 60   // >= 60% on-chain = warning (triggers DEX BTC swap suggestion)
    },

    // Concentration Risk thresholds (single wallet percentage)
    concentration: {
        dangerThreshold: 75,         // >= 70% in single wallet = danger
        warningThreshold: 50         // >= 40% in single wallet = warning (triggers CEX BTC buy suggestion)
    },

    // Storage Security thresholds (cold wallet percentage)
    storage: {
        safeThreshold: 50,           // >= 50% cold = safe
        warningThreshold: 20         // >= 20% cold = warning, < 20% = danger (triggers hardware wallet suggestion)
    },

    // Tier definitions
    tiers: {
        tier1: { name: 'BTC', color: '#F7931A' },
        tier2: { name: 'EVM & SOL', color: '#627EEA' },
        tier3: { name: 'CEX', color: '#8B5CF6' }
    },

    // Storage type colors
    storageColors: {
        cold: '#10B981',
        hot: '#F59E0B',
        cex: '#EF4444'
    }
};

export default HEALTH_CONFIG;
