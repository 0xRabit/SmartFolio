// ai_analysis.js - AI Analysis Module
// Handles portfolio analysis with OpenRouter and SiliconFlow APIs

import { OPENROUTER_API, SILICONFLOW_API, MAX_SCREENSHOTS_TO_SEND } from '../../config.js';
import { t, getLanguage } from './i18n.js';
import { AI_CONFIG } from './ai_config.js';

/**
 * Analyze portfolio using AI
 * @param {Array} wallets - Array of wallet data
 * @param {string} modelSelection - Model in format "provider:model"
 * @param {Object} settings - User settings with API keys
 * @param {string} customPrompt - Optional custom prompt
 * @returns {Promise<string>} - Analysis result text
 */
export async function analyzePortfolio(wallets, modelSelection, settings, customPrompt = '') {
    const currentLang = getLanguage();

    // Parse provider:model format (e.g., "openrouter:google/gemini-2.0-flash-001")
    const [provider, model] = modelSelection.includes(':')
        ? modelSelection.split(':')
        : ['openrouter', modelSelection];

    // Get appropriate API key and URL
    let apiKey, apiUrl;
    if (provider === 'siliconflow') {
        apiKey = settings.siliconFlowApiKey;
        apiUrl = SILICONFLOW_API;
        if (!apiKey) {
            throw new Error('硅基流动 API Key not configured. Please add it in Settings.');
        }
    } else {
        apiKey = settings.openRouterApiKey;
        apiUrl = OPENROUTER_API;
        if (!apiKey) {
            throw new Error(t('apiKeyRequired'));
        }
    }

    // Build portfolio summary for prompt
    const portfolioSummary = buildPortfolioSummary(wallets, currentLang);

    // Load screenshots for vision analysis
    const screenshotData = await chrome.storage.local.get(['screenshots']);
    const screenshots = screenshotData.screenshots || [];
    console.log('📸 Screenshots loaded:', screenshots.length, 'images');

    // Use custom prompt or default from config
    const userPrompt = customPrompt || AI_CONFIG.defaultPrompt[currentLang];
    const responseLimit = AI_CONFIG.responseLimit[currentLang];

    const promptText = `${userPrompt}。${responseLimit}.\n\n${currentLang === 'cn' ? '资产组合概况' : 'Portfolio Summary'}:\n${portfolioSummary}`;

    let messageContent;
    if (screenshots.length > 0) {
        messageContent = [
            { type: 'text', text: promptText + (currentLang === 'cn' ? '\n\n以下是相关的资产截图供参考:' : '\n\nHere are relevant asset screenshots for reference:') }
        ];
        const imagesToSend = screenshots.slice(0, MAX_SCREENSHOTS_TO_SEND);
        console.log('🖼️ Sending', imagesToSend.length, 'screenshots to', provider);
        imagesToSend.forEach(s => {
            messageContent.push({
                type: 'image_url',
                image_url: { url: s.full }
            });
        });
    } else {
        console.log('⚠️ No screenshots available, sending text-only analysis');
        messageContent = promptText;
    }

    // Build request headers
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
    if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://github.com/vibecoding/portfolio_plugin';
        headers['X-Title'] = 'Portfolio Plugin';
    }

    console.log('📤 Calling', provider, 'with model:', model);
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            model: model,
            messages: [{
                role: 'user',
                content: messageContent
            }],
            temperature: 0.7,
            max_tokens: 800
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || response.statusText);
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || (currentLang === 'cn' ? '无法获取分析结果' : 'Unable to get analysis result');
}

/**
 * Build portfolio summary string for AI prompt
 */
function buildPortfolioSummary(wallets, lang) {
    const totalBalance = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);
    const byChain = {};
    wallets.forEach(w => {
        const chain = w.chain_type.toUpperCase();
        byChain[chain] = (byChain[chain] || 0) + (w.balance || 0);
    });

    return `
${lang === 'cn' ? '总资产' : 'Total'}: $${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
${lang === 'cn' ? '链上分布' : 'Chain Distribution'}:
${Object.entries(byChain).map(([chain, bal]) => `- ${chain}: $${bal.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${((bal / totalBalance) * 100).toFixed(1)}%)`).join('\n')}
${lang === 'cn' ? '钱包数量' : 'Wallets'}: ${wallets.length}
`;
}

export default { analyzePortfolio };
