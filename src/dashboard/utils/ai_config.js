// ai_config.js - AI Analysis Configuration
// Centralized config for prompts, Quick Prompts, and optimization suggestions

/**
 * AI Analysis Configuration
 */
export const AI_CONFIG = {
    // System prompt for AI analysis
    systemPrompt: {
        cn: '您是内置于 SmartFolio 的加密货币分析专家，主要帮助用户分析资产组合的合理性和风险性。请基于用户的资产数据提供专业、简洁的分析建议。',
        en: 'You are a crypto analyst built into SmartFolio. Help users analyze their portfolio rationality and risks. Provide professional, concise analysis based on their asset data.'
    },

    // Default user prompt (when no custom prompt provided)
    defaultPrompt: {
        cn: '请从"合理性"与"风险性"两个角度解读当前资产配置情况',
        en: 'Analyze this portfolio from "Rationality" and "Risk" perspectives'
    },

    // Response length limits
    responseLimit: {
        cn: '简洁回答，限制在150字以内',
        en: 'Be concise, limit to 100 words'
    },

    // Quick Prompts configuration
    quickPrompts: [
        {
            key: 'risk',
            label: { cn: '风险评估', en: 'Risk Assessment' },
            prompt: {
                cn: '请评估当前资产组合的风险等级，包括集中度风险和存储风险',
                en: 'Assess the risk level of this portfolio, including concentration risk and storage risk'
            }
        },
        {
            key: 'optimize',
            label: { cn: '优化分配', en: 'Optimize Allocation' },
            prompt: {
                cn: '请针对当前配置提出优化建议，使资产分布更加合理',
                en: 'Suggest optimizations for current allocation to make distribution more reasonable'
            }
        },
        {
            key: 'trend',
            label: { cn: '市场趋势分析', en: 'Market Trend Analysis' },
            prompt: {
                cn: '请基于当前持仓分析市场趋势对资产的潜在影响',
                en: 'Analyze potential market trend impact on current holdings'
            }
        },
        {
            key: 'rebalance',
            label: { cn: '再平衡策略', en: 'Rebalancing Strategy' },
            prompt: {
                cn: '请提供具体的再平衡操作建议',
                en: 'Provide specific rebalancing action recommendations'
            }
        }
    ],

    // Optimization suggestions based on health analysis
    optimizationSuggestions: {
        // Healthy portfolio - no action needed
        healthy: {
            message: {
                cn: '您的资产组合非常健康，请继续保持！',
                en: 'Your portfolio is healthy, keep it up!'
            },
            type: 'success',
            links: []
        },

        // On-chain (EVM+SOL) risk - recommend swapping to BTC via DEX (triggered when tier2 > 60%)
        onChainRisk: {
            message: {
                cn: '您的链上资产风险较高，建议增加BTC的配置',
                en: 'High on-chain asset risk detected, consider adding BTC'
            },
            type: 'warning',
            links: [
                {
                    label: { cn: '使用DEX换BTC', en: 'Swap to BTC (DEX)' },
                    url: 'https://web3.okx.com/join/CRYPTORABIT',
                    icon: 'okx'
                }
            ]
        },

        // Concentration risk - recommend buying BTC via CEX (triggered when single wallet > 40% AND max is not BTC)
        concentrationRisk: {
            message: {
                cn: '您的资产集中度较高，且最大资产非BTC，建议增加BTC的配置',
                en: 'High concentration detected (max asset is not BTC), consider adding BTC'
            },
            type: 'warning',
            links: [
                {
                    label: { cn: '使用Backpack购买BTC', en: 'Buy BTC (Backpack)' },
                    url: 'https://accounts.bmwweb.academy/register?ref=CRYPTORABIT',
                    icon: 'backpack'
                },
                {
                    label: { cn: '使用Binance购买BTC', en: 'Buy BTC (Binance)' },
                    url: 'https://backpack.exchange/join/704ecd37-18ba-40af-bc50-8197b16d10c5',
                    icon: 'binance'
                }
            ]
        },

        // Storage risk - recommend hardware wallets (triggered when cold wallet < 20%)
        storageRisk: {
            message: {
                cn: '您的资产托管风险较高，建议增加硬件钱包的配置',
                en: 'Storage risk detected, consider hardware wallets'
            },
            type: 'warning',
            links: [
                {
                    label: { cn: '官网购买Onekey 硬件钱包', en: 'Buy Onekey Wallet' },
                    url: 'https://onekey.so/r/XUBVLX',
                    icon: 'onekey',
                    iconFolder: 'wallet'
                },
                {
                    label: { cn: '官网购买Ledger 硬件钱包', en: 'Buy Ledger Wallet' },
                    url: 'https://shop.ledger.com/?r=7d1d397e02e6',
                    icon: 'ledger',
                    iconFolder: 'wallet'
                },
                {
                    label: { cn: '官网购买Trezor 硬件钱包', en: 'Buy Trezor Wallet' },
                    url: 'https://trezorio.refr.cc/default/u/CryptoRabit?s=rp&t=cp',
                    icon: 'trezor',
                    iconFolder: 'wallet'
                }
            ]
        }
    }
};

/**
 * Get Quick Prompt by key
 * @param {string} key - Prompt key
 * @param {string} lang - Language ('cn' or 'en')
 * @returns {string} - Prompt text
 */
export function getQuickPrompt(key, lang = 'cn') {
    const prompt = AI_CONFIG.quickPrompts.find(p => p.key === key);
    return prompt ? prompt.prompt[lang] : AI_CONFIG.defaultPrompt[lang];
}

/**
 * Get optimization suggestions based on health analysis results
 * Rules:
 * - When all safe: show "healthy" message
 * - When warning: randomly pick ONE link from available options
 * - When danger: show ALL links
 * 
 * @param {Object} healthData - { tiering, concentration, storage }
 * @param {string} lang - Language ('cn' or 'en')
 * @returns {Array} - Array of applicable suggestions
 */
export function getOptimizationSuggestions(healthData, lang = 'cn') {
    const { tiering, concentration, storage } = healthData;
    const suggestions = [];

    // Check if healthy (all risk levels are safe)
    // Note: tiering now only considers on-chain risk (EVM+SOL), not CEX
    const isOnChainSafe = tiering?.onChainRiskLevel === 'safe' || tiering?.onChainRiskLevel === undefined;
    // Concentration is safe if level is safe OR if maxWallet is BTC (no need to suggest buying more BTC)
    const isConcentrationSafe = concentration?.level === 'safe' || concentration?.maxWalletIsBtc === true;
    const isStorageSafe = storage?.securityLevel === 'safe';

    if (isOnChainSafe && isConcentrationSafe && isStorageSafe) {
        suggestions.push({
            ...AI_CONFIG.optimizationSuggestions.healthy,
            message: AI_CONFIG.optimizationSuggestions.healthy.message[lang]
        });
        return suggestions;
    }

    // Helper: process links based on risk level
    const processLinks = (config, riskLevel) => {
        const allLinks = config.links.map(link => ({
            ...link,
            label: link.label[lang]
        }));

        // Warning level: randomly pick one link; Danger level: show all
        if (riskLevel === 'warning' && allLinks.length > 1) {
            const randomIndex = Math.floor(Math.random() * allLinks.length);
            return [allLinks[randomIndex]];
        }
        return allLinks;
    };

    // Check on-chain risk (tier2: EVM+SOL > 60%) - recommend DEX swap to BTC
    if (tiering?.onChainRiskLevel && tiering.onChainRiskLevel !== 'safe') {
        const config = AI_CONFIG.optimizationSuggestions.onChainRisk;
        suggestions.push({
            ...config,
            message: config.message[lang],
            links: processLinks(config, tiering.onChainRiskLevel)
        });
    }

    // Check concentration risk (single wallet > 40% AND max wallet is NOT BTC) - recommend CEX purchase
    if (concentration?.level !== 'safe' && concentration?.maxWalletIsBtc !== true) {
        const config = AI_CONFIG.optimizationSuggestions.concentrationRisk;
        suggestions.push({
            ...config,
            message: config.message[lang],
            links: processLinks(config, concentration.level)
        });
    }

    // Check storage risk (cold wallet < 20%) - recommend hardware wallets
    if (storage?.securityLevel !== 'safe') {
        const config = AI_CONFIG.optimizationSuggestions.storageRisk;
        suggestions.push({
            ...config,
            message: config.message[lang],
            links: processLinks(config, storage.securityLevel)
        });
    }

    return suggestions;
}

export default AI_CONFIG;
