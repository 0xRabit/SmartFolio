import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Check, ExternalLink, Copy } from 'lucide-react';

interface Settings {
    evmSource: string;
    solSource: string;
    etherscanApiKey: string;
    openRouterApiKey: string;
    solanaRpcUrl: string;
}

interface CexAccount {
    id: string;
    cexName: string;
    apiKey: string;
    apiSecret: string;
    passphrase: string;
    remark: string;
}

interface WalletEntry {
    address: string;
    chain_type: string;
    remark: string;
}

const SettingsTab: React.FC = () => {
    const [settings, setSettings] = useState<Settings>({
        evmSource: 'etherscan',
        solSource: 'helius',
        etherscanApiKey: '',
        openRouterApiKey: '',
        solanaRpcUrl: ''
    });
    const [cexAccounts, setCexAccounts] = useState<CexAccount[]>([]);
    const [wallets, setWallets] = useState<WalletEntry[]>([]);
    const [saved, setSaved] = useState(false);
    const [newCex, setNewCex] = useState({ cexName: 'binance', apiKey: '', apiSecret: '', passphrase: '', remark: '' });
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

    // Load settings
    useEffect(() => {
        const load = async () => {
            const data = await chrome.storage.local.get(['settings', 'cexAccounts', 'wallets']);
            if (data.settings) setSettings(data.settings as Settings);
            if (data.cexAccounts) setCexAccounts(data.cexAccounts as CexAccount[]);
            if (data.wallets) setWallets((data.wallets as WalletEntry[]).filter((w: WalletEntry) => w.address));
        };
        load();
    }, []);

    // Save settings
    const handleSave = async () => {
        await chrome.storage.local.set({ settings, cexAccounts });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    // Add CEX account
    const addCexAccount = () => {
        if (!newCex.apiKey || !newCex.apiSecret) return;
        const account: CexAccount = {
            id: Date.now().toString(),
            ...newCex
        };
        setCexAccounts([...cexAccounts, account]);
        setNewCex({ cexName: 'binance', apiKey: '', apiSecret: '', passphrase: '', remark: '' });
    };

    // Remove CEX account
    const removeCexAccount = (id: string) => {
        setCexAccounts(cexAccounts.filter(a => a.id !== id));
    };

    return (
        <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
            {/* API Keys Section */}
            <div className="gradient-card p-4">
                <h3 className="text-white font-medium mb-4">API 配置</h3>

                <div className="space-y-3">
                    <div>
                        <label className="text-gray-400 text-xs mb-1 block">OpenRouter API Key</label>
                        <input
                            type="password"
                            value={settings.openRouterApiKey}
                            onChange={(e) => setSettings({ ...settings, openRouterApiKey: e.target.value })}
                            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                            placeholder="sk-or-..."
                        />
                    </div>

                    <div>
                        <label className="text-gray-400 text-xs mb-1 block">Etherscan API Key</label>
                        <input
                            type="password"
                            value={settings.etherscanApiKey}
                            onChange={(e) => setSettings({ ...settings, etherscanApiKey: e.target.value })}
                            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                            placeholder="Your Etherscan API Key"
                        />
                    </div>

                    <div>
                        <label className="text-gray-400 text-xs mb-1 block">Solana RPC URL</label>
                        <input
                            type="text"
                            value={settings.solanaRpcUrl}
                            onChange={(e) => setSettings({ ...settings, solanaRpcUrl: e.target.value })}
                            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                            placeholder="https://mainnet.helius-rpc.com/?api-key=..."
                        />
                    </div>
                </div>
            </div>

            {/* CEX Accounts Section */}
            <div className="gradient-card p-4">
                <h3 className="text-white font-medium mb-4">交易所账户</h3>

                {/* Existing accounts */}
                <div className="space-y-2 mb-4">
                    {cexAccounts.map((account) => (
                        <div key={account.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-2">
                            <div>
                                <span className="text-white text-sm font-medium uppercase">{account.cexName}</span>
                                <span className="text-gray-400 text-xs ml-2">{account.remark}</span>
                            </div>
                            <button onClick={() => removeCexAccount(account.id)} className="text-red-400 hover:text-red-300">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    {cexAccounts.length === 0 && (
                        <p className="text-gray-500 text-sm text-center py-2">暂无交易所账户</p>
                    )}
                </div>

                {/* Add new CEX */}
                <div className="space-y-2 border-t border-gray-700 pt-4">
                    <div className="grid grid-cols-2 gap-2">
                        <select
                            value={newCex.cexName}
                            onChange={(e) => setNewCex({ ...newCex, cexName: e.target.value })}
                            className="bg-gray-800/50 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm"
                        >
                            <option value="binance">Binance</option>
                            <option value="okx">OKX</option>
                            <option value="bybit">Bybit</option>
                            <option value="bitget">Bitget</option>
                        </select>
                        <input
                            type="text"
                            value={newCex.remark}
                            onChange={(e) => setNewCex({ ...newCex, remark: e.target.value })}
                            className="bg-gray-800/50 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm"
                            placeholder="备注名称"
                        />
                    </div>
                    <input
                        type="password"
                        value={newCex.apiKey}
                        onChange={(e) => setNewCex({ ...newCex, apiKey: e.target.value })}
                        className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm"
                        placeholder="API Key"
                    />
                    <input
                        type="password"
                        value={newCex.apiSecret}
                        onChange={(e) => setNewCex({ ...newCex, apiSecret: e.target.value })}
                        className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm"
                        placeholder="API Secret"
                    />
                    {(newCex.cexName === 'okx' || newCex.cexName === 'bitget') && (
                        <input
                            type="password"
                            value={newCex.passphrase}
                            onChange={(e) => setNewCex({ ...newCex, passphrase: e.target.value })}
                            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm"
                            placeholder="Passphrase"
                        />
                    )}
                    <button
                        onClick={addCexAccount}
                        className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm flex items-center justify-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        添加账户
                    </button>
                </div>
            </div>

            {/* Wallets Section */}
            <div className="gradient-card p-4">
                <h3 className="text-white font-medium mb-4">钱包地址 ({wallets.length})</h3>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                    {wallets.slice(0, 5).map((w, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400 uppercase w-12">{w.chain_type}</span>
                            <div className="flex items-center gap-1 flex-1 min-w-0">
                                <span className="text-gray-300 truncate">{w.address.slice(0, 12)}...{w.address.slice(-6)}</span>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(w.address);
                                        setCopiedAddress(w.address);
                                        setTimeout(() => setCopiedAddress(null), 1500);
                                    }}
                                    className={`p-0.5 transition-all duration-200 ${copiedAddress === w.address ? 'text-green-500 scale-110' : 'text-gray-500 hover:text-blue-400'}`}
                                    title={`Copy: ${w.address}`}
                                >
                                    {copiedAddress === w.address ? (
                                        <Check className="w-3 h-3" />
                                    ) : (
                                        <Copy className="w-3 h-3" />
                                    )}
                                </button>
                            </div>
                            <span className="text-gray-500">{w.remark}</span>
                        </div>
                    ))}
                    {wallets.length > 5 && (
                        <p className="text-gray-500 text-xs text-center">+{wallets.length - 5} more...</p>
                    )}
                </div>
                <button
                    onClick={() => chrome.tabs.create({ url: 'dashboard.html' })}
                    className="mt-3 w-full py-2 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 rounded-lg text-sm flex items-center justify-center gap-2"
                >
                    <ExternalLink className="w-4 h-4" />
                    在 Dashboard 中管理钱包
                </button>
            </div>

            {/* Save Button */}
            <button
                onClick={handleSave}
                className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition ${saved
                    ? 'bg-emerald-500 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    }`}
            >
                {saved ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                {saved ? '已保存' : '保存设置'}
            </button>
        </div>
    );
};

export default SettingsTab;
