// share_text_generator.js - Dynamic Share Text Generation
// Generates social media share text from templates based on portfolio performance

import shareTemplates from '../../config/share_templates.json';

/**
 * Generate share text based on portfolio data
 * @param {Array} wallets - Current wallet data
 * @param {Array} history - Historical balance data
 * @param {String} lang - Language ('zh' or 'en')
 * @returns {Object} { text, hashtags, templateType }
 */
export function generateShareText(wallets, history, lang = 'zh') {
    // Calculate 7-day change percentage
    const changePercent = calculateChangePercent(history);

    // Get active chain types
    const chains = getActiveChains(wallets);

    // Select template based on performance
    let templateType = 'general';
    if (changePercent > 0.5) {
        templateType = 'profitable';
    } else if (changePercent < -5) {
        templateType = 'loss';
    }

    // Get template text
    let text = shareTemplates.templates[templateType][lang] || shareTemplates.templates['general'][lang];

    // Replace placeholders
    text = text.replace('{change_percent}', Math.abs(changePercent).toFixed(2));
    text = text.replace('{chains}', chains);

    // Get hashtags
    const hashtags = shareTemplates.hashtags[templateType] || shareTemplates.hashtags.default;

    return {
        text: text,
        hashtags: hashtags,
        templateType: templateType,
        changePercent: changePercent
    };
}

/**
 * Calculate 7-day balance change percentage
 * @param {Array} history - Historical balance data
 * @returns {Number} Percentage change
 */
function calculateChangePercent(history) {
    if (!history || history.length === 0) return 0;

    // Get unique dates sorted descending
    const dates = [...new Set(history.map(r => r.date))].sort((a, b) => b.localeCompare(a));

    if (dates.length < 2) return 0;

    // Get latest and 7-day-ago totals
    const latestDate = dates[0];
    const targetIndex = Math.min(dates.length - 1, 7); // Up to 7 days ago or oldest
    const previousDate = dates[targetIndex];

    const latestTotal = history.find(r => r.date === latestDate && r.chain_type === 'summary')?.balance || 0;
    const previousTotal = history.find(r => r.date === previousDate && r.chain_type === 'summary')?.balance || 1;

    if (previousTotal === 0) return 0;

    const change = ((latestTotal - previousTotal) / previousTotal) * 100;
    return change;
}

/**
 * Get active chain types from wallets
 * @param {Array} wallets - Wallet data
 * @returns {String} Chain types joined by ' & '
 */
function getActiveChains(wallets) {
    if (!wallets || wallets.length === 0) return 'Crypto';

    const chainSet = new Set();

    wallets.forEach(w => {
        if (w.isCex) {
            chainSet.add('CEX');
        } else {
            const chain = w.chain_type.toUpperCase();
            chainSet.add(chain);
        }
    });

    const chains = Array.from(chainSet);

    // Sort: BTC, EVM, SOL, CEX
    const order = { 'BTC': 1, 'EVM': 2, 'SOL': 3, 'CEX': 4 };
    chains.sort((a, b) => (order[a] || 99) - (order[b] || 99));

    return chains.join(' & ');
}

/**
 * Format share text for specific platform
 * @param {String} text - Base text
 * @param {Array} hashtags - Hashtag array
 * @param {String} platform - Platform name
 * @returns {String} Formatted text
 */
export function formatForPlatform(text, hashtags, platform = 'twitter') {
    const config = shareTemplates.platforms[platform];
    let result = text;

    // Add hashtags
    const hashtagText = hashtags.join(' ');
    result = `${text}\n\n${hashtagText}`;

    // Twitter character limit
    if (platform === 'twitter' && config.maxLength) {
        if (result.length > config.maxLength - 30) { // Reserve space for link
            result = text.substring(0, config.maxLength - hashtagText.length - 35) + '...\n\n' + hashtagText;
        }
    }

    return result;
}

export default {
    generateShareText,
    formatForPlatform
};
