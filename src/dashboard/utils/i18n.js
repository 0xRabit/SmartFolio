// i18n.js - Internationalization / Language translations
// Extracted from index.js for better modularity

const i18n = {
    en: {
        appTitle: 'SmartFolio',
        settings: 'Settings',
        updateAll: 'Update All',
        buyMeCoffee: 'Buy me a coffee ☕',
        totalBalance: 'Total Balance',
        portfolioAnalysis: 'Portfolio Analysis',
        analyze: 'Analyze',
        analyzePlaceholder: 'Click "Analyze" to get AI insights...',
        analyzing: 'Analyzing...',
        allocation: 'Allocation',
        wallets: 'Wallets',
        chainCategory: 'CHAIN/CATEGORY',
        addressRemark: 'ADDRESS/REMARK',
        balance: 'BALANCE',
        status: 'STATUS',
        source: 'SOURCE',
        totalAssetTrend: 'Total Asset Trend',
        exportCsv: 'Export CSV',
        detailedTrend: 'Detailed Trend (Top 10)',
        screenshotHistory: 'Screenshot History',
        clearAll: 'Clear All',
        noScreenshots: 'No screenshots yet. Click "Update All" to capture.',
        noWalletsError: 'Please add wallet addresses first!',
        analysisFailed: 'Analysis failed: ',
        apiKeyRequired: 'Please configure OpenRouter API Key in Settings',
        defaultPrompt: 'Analyze this portfolio from rationality and risk perspectives, detail to each wallet or protocol, focus on top 5 tokens/protocols',
        quickPrompts: 'Quick Prompts:',
        promptRiskAssessment: 'Risk Assessment',
        promptOptimize: 'Optimize Allocation',
        promptMarket: 'Market Trend Analysis',
        promptRebalance: 'Rebalancing Strategy',
        optimizationSuggestions: 'Optimization Suggestions:',
        // Cloud Sync / Storage
        configStorage: 'Configuration Storage',
        enableProfileSync: 'Enable Profile Sync',
        syncDescription: 'Sync Settings & Wallets across devices (Max 100KB).',
        syncDescriptionDetail: 'Only syncs config and wallet list, excludes history and screenshots. Disabled by default.',
        syncActive: 'Sync Active',
        localOnly: 'Local Only',
        localStorage: 'Local Storage',
        forceSyncNow: 'Force Sync Now',
        syncNotAvailable: 'Chrome is not logged in. Sync will only work locally until you sign in.',
        syncWarningTitle: 'Sync Warning',
        lastSynced: 'Last Synced:'
    },
    cn: {
        appTitle: 'SmartFolio',
        settings: '设置',
        updateAll: '更新全部',
        buyMeCoffee: '请我喝杯咖啡 ☕',
        totalBalance: '总余额',
        portfolioAnalysis: '资产组合分析',
        analyze: '分析',
        analyzePlaceholder: '点击"分析"获取智能评估结果...',
        analyzing: '正在分析中...',
        allocation: '资产配置',
        wallets: '钱包列表',
        chainCategory: '链/类型',
        addressRemark: '地址/备注',
        balance: '余额',
        status: '状态',
        source: '来源',
        totalAssetTrend: '总资产趋势',
        exportCsv: '导出CSV',
        detailedTrend: '详细趋势 (前10)',
        screenshotHistory: '截图历史',
        clearAll: '清空',
        noScreenshots: '暂无截图。点击"更新全部"开始捕获。',
        noWalletsError: '请先添加钱包地址！',
        analysisFailed: '分析失败: ',
        apiKeyRequired: '请在设置中配置 OpenRouter API Key',
        defaultPrompt: '请从"合理性"与"风险性"两个角度解读当前资产配置情况，详细到每个钱包或者每个协议的情况，重点分析前 5 种代币/协议的情况',
        quickPrompts: '快捷提问:',
        promptRiskAssessment: '当前配置风险评估',
        promptOptimize: '如何优化资产配置',
        promptMarket: '市场趋势分析',
        promptRebalance: '建议调仓策略',
        optimizationSuggestions: '优化建议:',
        // Cloud Sync / Storage
        configStorage: '配置信息存储',
        enableProfileSync: '开启账号同步',
        syncDescription: '跨设备同步设置和钱包 (最大 100KB)',
        syncDescriptionDetail: '仅同步配置和钱包列表，不包含历史记录和截图。默认关闭。',
        syncActive: '同步已开启',
        localOnly: '仅本地存储',
        localStorage: '本地存储',
        forceSyncNow: '立即同步',
        syncNotAvailable: 'Chrome 未登录账号，同步功能仅在本地生效。请登录 Chrome 以启用跨设备同步。',
        syncWarningTitle: '同步提示',
        lastSynced: '上次同步:'
    }
};

let currentLang = 'en';

export function setLanguage(lang) {
    currentLang = lang;
}

export function getLanguage() {
    return currentLang;
}

export function t(key) {
    return i18n[currentLang][key] || i18n['en'][key] || key;
}

export function applyLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) el.textContent = t(key);
    });

    // Update language toggle buttons
    const btnEn = document.getElementById('btn-lang-en');
    const btnCn = document.getElementById('btn-lang-cn');
    if (btnEn && btnCn) {
        if (currentLang === 'en') {
            btnEn.className = 'px-4 py-2 bg-blue-600 text-white font-medium transition-colors';
            btnCn.className = 'px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 transition-colors';
        } else {
            btnCn.className = 'px-4 py-2 bg-blue-600 text-white font-medium transition-colors';
            btnEn.className = 'px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 transition-colors';
        }
    }

    // Update prompt input default value
    const promptInput = document.getElementById('analysis-prompt');
    if (promptInput) {
        promptInput.value = t('defaultPrompt');
    }
}

export default { t, applyLanguage, setLanguage, getLanguage };
