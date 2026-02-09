import React from 'react';
import { Eye, EyeOff, ArrowUpRight, ArrowDownRight, Copy, Check } from 'lucide-react';

interface WalletData {
    address: string;
    chain_type: string;
    remark: string;
    balance: number;
    status: string;
    last_updated: number;
    isCex?: boolean;
    cexName?: string;
}

interface AssetsTabProps {
    wallets: WalletData[];
    totalBalance: number;
    lastUpdated: string;
}

// Chain icon component with colored circular background using inline styles
const ChainIcon: React.FC<{ chain: string }> = ({ chain }) => {
    const lowerChain = chain.toLowerCase();

    const iconConfig: Record<string, { bg: string; color: string; symbol: string }> = {
        'btc': { bg: '#F7931A', color: '#FFFFFF', symbol: '₿' },
        'bitcoin': { bg: '#F7931A', color: '#FFFFFF', symbol: '₿' },
        'evm': { bg: '#627EEA', color: '#FFFFFF', symbol: 'Ξ' },
        'ethereum': { bg: '#627EEA', color: '#FFFFFF', symbol: 'Ξ' },
        'sol': { bg: '#14F195', color: '#000000', symbol: '◎' },
        'binance': { bg: '#F0B90B', color: '#000000', symbol: 'B' },
        'okx': { bg: '#000000', color: '#FFFFFF', symbol: 'X' },
        'bybit': { bg: '#F7A600', color: '#000000', symbol: 'BY' },
        'bitget': { bg: '#00F0FF', color: '#000000', symbol: 'BG' },
        'cex': { bg: '#8B5CF6', color: '#FFFFFF', symbol: 'C' },
    };

    const config = iconConfig[lowerChain] || { bg: '#6B7280', color: '#FFFFFF', symbol: '?' };

    return (
        <div
            style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: config.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
            }}
        >
            <span style={{ color: config.color, fontSize: 16, fontWeight: 'bold' }}>
                {config.symbol}
            </span>
        </div>
    );
};

const AssetsTab: React.FC<AssetsTabProps> = ({ wallets, totalBalance, lastUpdated }) => {
    const [showBalance, setShowBalance] = React.useState(true);
    // showAllWallets removed, default to showing all
    const [historyInfo, setHistoryInfo] = React.useState<{ totalChange: number; totalChangePercent: number; walletChanges: Record<string, number> }>({
        totalChange: 0,
        totalChangePercent: 0,
        walletChanges: {}
    });
    const [copiedAddress, setCopiedAddress] = React.useState<string | null>(null);

    // Load history to calculate "Since Last" changes (using actual flat storage format)
    React.useEffect(() => {
        const loadHistory = async () => {
            try {
                const data = await chrome.storage.local.get(['history']);
                const rawHistory = (data.history || []) as Array<{
                    date: string;
                    address: string;
                    chain_type: string;
                    remark: string;
                    balance: number;
                }>;
                if (!rawHistory.length) return;

                // Find all unique dates, sorted descending
                const dates = [...new Set(rawHistory.map(r => r.date))].sort((a, b) => b.localeCompare(a));

                if (dates.length < 2) {
                    // Not enough history for comparison
                    return;
                }

                const latestDate = dates[0];
                const previousDate = dates[1];

                // Get total balance for each date (summary records)
                const latestTotal = rawHistory.find(r => r.date === latestDate && r.chain_type === 'summary')?.balance || totalBalance;
                const previousTotal = rawHistory.find(r => r.date === previousDate && r.chain_type === 'summary')?.balance || 1;

                const change = latestTotal - previousTotal;
                const changePercent = (change / previousTotal) * 100;

                // Calculate individual wallet changes
                const walletChangesMap: Record<string, number> = {};
                wallets.forEach(w => {
                    const key = w.address || w.remark;
                    // Find this wallet in previous date's records
                    const prevRecord = rawHistory.find(r =>
                        r.date === previousDate &&
                        r.chain_type !== 'summary' &&
                        (r.address === w.address || r.remark === w.remark)
                    );
                    if (prevRecord && prevRecord.balance > 0) {
                        walletChangesMap[key] = ((w.balance - prevRecord.balance) / prevRecord.balance) * 100;
                    } else {
                        walletChangesMap[key] = 0;
                    }
                });

                console.log(`Since Last: ${previousDate} ($${previousTotal}) -> ${latestDate} ($${latestTotal}) = $${change}`);

                setHistoryInfo({
                    totalChange: change,
                    totalChangePercent: changePercent,
                    walletChanges: walletChangesMap
                });
            } catch (e) {
                console.error("Failed to calc history", e);
            }
        };
        loadHistory();
    }, [totalBalance, wallets]);

    // Calculate stats
    const onChainWallets = wallets.filter(w => !w.isCex).length;
    const cexWallets = wallets.filter(w => w.isCex).length;

    // Mock 24h change - in real app, calculate from historical data
    // const dayChange = 640; // Removed
    // const isPositive = dayChange >= 0; // Removed

    // Calculate allocation by chain type
    const allocation: Record<string, number> = {};
    wallets.forEach(w => {
        const type = w.isCex ? 'CEX' : w.chain_type.toUpperCase();
        allocation[type] = (allocation[type] || 0) + (w.balance || 0);
    });

    // Colors for each chain type
    const chainColors: Record<string, string> = {
        'BTC': '#F7931A',
        'EVM': '#627EEA',
        'SOL': '#14F195',
        'CEX': '#8B5CF6',
    };

    // Calculate percentages
    const allocationWithPercent = Object.entries(allocation).map(([chain, balance]) => ({
        chain,
        balance,
        percent: totalBalance > 0 ? ((balance / totalBalance) * 100).toFixed(0) : 0,
        color: chainColors[chain] || '#6B7280'
    }));

    // Sort by balance descending
    allocationWithPercent.sort((a, b) => b.balance - a.balance);

    // Generate SVG donut chart data
    const radius = 36;
    const circumference = 2 * Math.PI * radius;

    // Total balance change color
    const { totalChangePercent, walletChanges, totalChange } = historyInfo;
    const totalIsPositive = totalChangePercent >= 0;

    return (
        <div className="w-full h-full overflow-y-auto px-4 py-4 space-y-6">
            {/* Total Balance Card - P1 */}
            <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(31, 41, 55, 0.6)' }}>
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">Total Assets</span>
                        <span className="text-xs text-gray-600">Last Updated: {lastUpdated}</span>
                    </div>
                    <button onClick={() => setShowBalance(!showBalance)} className="text-gray-400 hover:text-white">
                        {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                </div>
                <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-white">
                        {showBalance ? `$${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '****'}
                    </span>
                    <span
                        className="text-xs flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                        style={{
                            backgroundColor: totalIsPositive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: totalIsPositive ? '#10B981' : '#EF4444'
                        }}
                    >
                        {totalIsPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {totalIsPositive ? '+' : ''}{Math.abs(totalChangePercent).toFixed(2)}%
                    </span>
                </div>
            </div>

            {/* Stats Row - P2 Compact */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <div className="rounded-xl px-2 py-2 text-center" style={{ backgroundColor: 'rgba(55, 65, 81, 0.5)' }}>
                    <p className="text-gray-400 text-xs">On-chain</p>
                    <p className="text-lg font-bold text-white">{onChainWallets}</p>
                </div>
                <div className="rounded-xl px-2 py-2 text-center" style={{ backgroundColor: 'rgba(55, 65, 81, 0.5)' }}>
                    <p className="text-gray-400 text-xs">CEX</p>
                    <p className="text-lg font-bold text-white">{cexWallets}</p>
                </div>
                <div className="rounded-xl px-2 py-2 text-center" style={{ backgroundColor: 'rgba(55, 65, 81, 0.5)' }}>
                    <p className="text-gray-400 text-xs">Since Last</p>
                    <p
                        className="text-lg font-bold"
                        style={{ color: totalIsPositive ? '#10B981' : '#EF4444' }}
                    >
                        {totalIsPositive ? '+' : '-'}${Math.abs(totalChange).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                </div>
            </div>

            {/* Allocation Section - P3 (no background, blends with popup) */}
            <div className="py-0">
                <div className="mb-1">
                    <span className="text-white font-medium text-sm">Allocation</span>
                </div>
                <div className="flex items-center gap-4">
                    {/* SVG Donut Chart with inline stroke colors */}
                    <div className="relative" style={{ width: 80, height: 80, flexShrink: 0 }}>
                        <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                            {(() => {
                                let offset = 0;
                                return allocationWithPercent.map((item) => {
                                    const percent = Number(item.percent);
                                    const dashLength = (percent / 100) * circumference;
                                    const currentOffset = offset;
                                    offset += dashLength;
                                    return (
                                        <circle
                                            key={item.chain}
                                            cx="50"
                                            cy="50"
                                            r={radius}
                                            fill="none"
                                            stroke={item.color}
                                            strokeWidth="10"
                                            strokeDasharray={`${dashLength} ${circumference}`}
                                            strokeDashoffset={-currentOffset}
                                        />
                                    );
                                });
                            })()}
                        </svg>
                    </div>
                    {/* Legend - 2x2 Grid */}
                    <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {allocationWithPercent.map((item) => (
                            <div key={item.chain} className="flex items-center gap-2">
                                <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: item.color }}
                                />
                                <span style={{ color: item.color }}>{item.chain}</span>
                                <span className="text-white ml-auto font-medium">{item.percent}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Wallet List */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium text-sm">Wallets</span>
                </div>
                <div className="space-y-2">
                    {wallets.sort((a, b) => (b.balance || 0) - (a.balance || 0)).map((wallet, index) => {
                        // Real change value
                        const changePercent = walletChanges[wallet.address || wallet.remark] || 0;
                        const walletIsPositive = changePercent >= 0;

                        return (
                            <div
                                key={index}
                                className="flex items-center gap-3 rounded-xl p-3"
                                style={{ backgroundColor: 'rgba(55, 65, 81, 0.3)' }}
                            >
                                <ChainIcon chain={wallet.isCex ? (wallet.cexName || 'cex') : wallet.chain_type} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-medium truncate">{wallet.remark || 'Wallet'}</span>
                                        <span
                                            className="text-xs px-1.5 py-0.5 rounded uppercase"
                                            style={{ backgroundColor: 'rgba(107, 114, 128, 0.5)', color: '#9CA3AF' }}
                                        >
                                            {wallet.isCex ? wallet.cexName : wallet.chain_type}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <p className="text-gray-500 text-xs truncate">
                                            {wallet.isCex ? 'API' : wallet.address ? `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}` : '--'}
                                        </p>
                                        {wallet.address && !wallet.isCex && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(wallet.address);
                                                    setCopiedAddress(wallet.address);
                                                    setTimeout(() => setCopiedAddress(null), 1500);
                                                }}
                                                className={`p-0.5 transition-all duration-200 ${copiedAddress === wallet.address ? 'text-green-500 scale-110' : 'text-gray-500 hover:text-blue-400'}`}
                                                title="Copy address"
                                            >
                                                {copiedAddress === wallet.address ? (
                                                    <Check className="w-3 h-3" />
                                                ) : (
                                                    <Copy className="w-3 h-3" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-white font-medium">${(wallet.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    {(() => {
                                        const changePercent = walletChanges[wallet.address || wallet.remark] || 0;
                                        const isPositive = changePercent >= 0;
                                        return (
                                            <p
                                                className="text-xs flex items-center justify-end gap-0.5"
                                                style={{ color: isPositive ? '#10B981' : '#EF4444' }}
                                            >
                                                {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                {Math.abs(changePercent).toFixed(1)}%
                                            </p>
                                        );
                                    })()}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div >
    );
};

export default AssetsTab;
