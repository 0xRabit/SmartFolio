import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

// Actual storage format from dashboard
interface RawHistoryRecord {
    date: string;           // "2026-01-17"
    address: string;        // wallet address or "TOTAL"
    chain_type: string;     // "evm", "btc", "sol", "summary"
    remark: string;         // wallet remark or "Daily Total"
    balance: number;
}

// Processed entry for charts
interface ProcessedEntry {
    date: string;
    timestamp: number;
    totalBalance: number;
    wallets: Array<{
        remark: string;
        balance: number;
        chain_type: string;
    }>;
}

// Helper to filter history by period
const filterByPeriod = (entries: ProcessedEntry[], period: string): ProcessedEntry[] => {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;

    let cutoff = 0;
    switch (period) {
        case '1D': cutoff = now - msPerDay; break;
        case '1W': cutoff = now - 7 * msPerDay; break;
        case '1M': cutoff = now - 30 * msPerDay; break;
        case '3M': cutoff = now - 90 * msPerDay; break;
        case 'ALL': cutoff = 0; break;
        default: cutoff = now - 7 * msPerDay;
    }

    return entries.filter(h => h.timestamp >= cutoff).sort((a, b) => a.timestamp - b.timestamp);
};

// Transform flat history records to grouped entries
const transformHistory = (rawHistory: RawHistoryRecord[]): ProcessedEntry[] => {
    // Group by date
    const byDate: Record<string, { total: number; wallets: { remark: string; balance: number; chain_type: string }[] }> = {};

    rawHistory.forEach(record => {
        if (!byDate[record.date]) {
            byDate[record.date] = { total: 0, wallets: [] };
        }

        if (record.chain_type === 'summary') {
            // This is the daily total record
            byDate[record.date].total = record.balance;
        } else {
            // Individual wallet record
            byDate[record.date].wallets.push({
                remark: record.remark,
                balance: record.balance,
                chain_type: record.chain_type
            });
        }
    });

    // Convert to array
    return Object.entries(byDate)
        .map(([date, data]) => ({
            date,
            timestamp: new Date(date).getTime(),
            totalBalance: data.total,
            wallets: data.wallets
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
};

// Simple SVG line chart renderer
const LineChart: React.FC<{
    data: { x: number; y: number }[];
    color: string;
    height: number;
    showFill?: boolean;
}> = ({ data, color, height, showFill = true }) => {
    if (data.length < 1) {
        return (
            <div className="flex items-center justify-center text-gray-500 text-sm" style={{ height }}>
                No Data
            </div>
        );
    }

    // Handle single data point
    if (data.length === 1) {
        return (
            <svg viewBox={`0 0 300 ${height}`} style={{ width: '100%', height: '100%' }}>
                <circle cx="150" cy={height / 2} r="4" fill={color} />
            </svg>
        );
    }

    const minY = Math.min(...data.map(d => d.y));
    const maxY = Math.max(...data.map(d => d.y));
    const rangeY = maxY - minY || 1;

    const width = 300;
    const padding = 10;
    const chartHeight = height - padding * 2;
    const chartWidth = width - padding * 2;

    const points = data.map((d, i) => ({
        x: padding + (i / (data.length - 1)) * chartWidth,
        y: padding + (1 - (d.y - minY) / rangeY) * chartHeight
    }));

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
    const fillD = pathD + ` L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
            <defs>
                <linearGradient id={`grad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            {showFill && <path d={fillD} fill={`url(#grad-${color.replace('#', '')})`} />}
            <path d={pathD} fill="none" stroke={color} strokeWidth="2" />
            {/* Data points */}
            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
            ))}
        </svg>
    );
};

// Multi-line chart for detailed view
const MultiLineChart: React.FC<{
    datasets: { label: string; data: { x: number; y: number }[]; color: string }[];
    height: number;
}> = ({ datasets, height }) => {
    if (datasets.length === 0 || datasets.every(d => d.data.length < 1)) {
        return (
            <div className="flex items-center justify-center text-gray-500 text-sm" style={{ height }}>
                No Data
            </div>
        );
    }

    const allValues = datasets.flatMap(d => d.data.map(p => p.y));
    const minY = Math.min(...allValues);
    const maxY = Math.max(...allValues);
    const rangeY = maxY - minY || 1;

    const width = 300;
    const padding = 10;
    const chartHeight = height - padding * 2;
    const chartWidth = width - padding * 2;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
            {datasets.map((dataset, di) => {
                if (dataset.data.length < 1) return null;
                const points = dataset.data.map((d, i) => ({
                    x: padding + (i / Math.max(dataset.data.length - 1, 1)) * chartWidth,
                    y: padding + (1 - (d.y - minY) / rangeY) * chartHeight
                }));

                if (points.length === 1) {
                    return <circle key={di} cx={points[0].x} cy={points[0].y} r="3" fill={dataset.color} />;
                }

                const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
                return <path key={di} d={pathD} fill="none" stroke={dataset.color} strokeWidth="2" />;
            })}
        </svg>
    );
};

const TrendsTab: React.FC = () => {
    const periods = ['1D', '1W', '1M', '3M', 'ALL'];
    const [activePeriod, setActivePeriod] = useState('1W');
    const [processedHistory, setProcessedHistory] = useState<ProcessedEntry[]>([]);
    const [loading, setLoading] = useState(true);

    // Load history from chrome.storage
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const data = await chrome.storage.local.get(['history']);
                const rawHistory = (data.history || []) as RawHistoryRecord[];
                console.log('Raw history loaded:', rawHistory.length, 'records');
                const processed = transformHistory(rawHistory);
                console.log('Processed history:', processed.length, 'entries');
                setProcessedHistory(processed);
            } catch (error) {
                console.error('Failed to load history:', error);
            } finally {
                setLoading(false);
            }
        };
        loadHistory();

        // Listen for changes
        const handleChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes.history) {
                const rawHistory = (changes.history.newValue || []) as RawHistoryRecord[];
                setProcessedHistory(transformHistory(rawHistory));
            }
        };
        chrome.storage.onChanged.addListener(handleChange);
        return () => chrome.storage.onChanged.removeListener(handleChange);
    }, []);

    // Filter data by period
    const filteredHistory = filterByPeriod(processedHistory, activePeriod);

    // Total balance chart data
    const totalChartData = filteredHistory.map(h => ({ x: h.timestamp, y: h.totalBalance }));

    // Calculate change percentage
    const firstBalance = filteredHistory[0]?.totalBalance || 0;
    const lastBalance = filteredHistory[filteredHistory.length - 1]?.totalBalance || 0;
    const changePercent = firstBalance > 0 ? ((lastBalance - firstBalance) / firstBalance * 100) : 0;
    const isPositive = changePercent >= 0;

    // Get top 5 wallets for detailed chart
    const walletColors: Record<string, string> = {
        'evm': '#627EEA',
        'btc': '#F7931A',
        'bitcoin': '#F7931A',
        'sol': '#14F195',
    };
    const defaultColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

    // Get top 5 wallets by latest balance
    const latestEntry = filteredHistory[filteredHistory.length - 1];
    const top5Wallets = latestEntry?.wallets
        ?.sort((a, b) => (b.balance || 0) - (a.balance || 0))
        .slice(0, 5)
        .map(w => w.remark || 'Unknown') || [];

    const detailedDatasets = top5Wallets.map((walletName, i) => {
        const data = filteredHistory.map(h => {
            const wallet = h.wallets?.find(w => w.remark === walletName);
            return { x: h.timestamp, y: wallet?.balance || 0 };
        });

        const walletChain = latestEntry?.wallets?.find(w => w.remark === walletName)?.chain_type?.toLowerCase() || '';
        const color = walletColors[walletChain] || defaultColors[i % defaultColors.length];

        return { label: walletName, data, color };
    });

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                Loading...
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
            {/* Period Selector */}
            <div className="flex items-center gap-2">
                {periods.map((period) => (
                    <button
                        key={period}
                        onClick={() => setActivePeriod(period)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition`}
                        style={{
                            backgroundColor: activePeriod === period ? 'rgba(16, 185, 129, 0.2)' : 'rgba(55, 65, 81, 0.5)',
                            color: activePeriod === period ? '#10B981' : '#9CA3AF'
                        }}
                    >
                        {period}
                    </button>
                ))}
            </div>

            {/* Total Trend Chart */}
            <div className="gradient-card p-4">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-white font-medium">Total Assets Trend</span>
                    <span
                        className="text-sm flex items-center gap-1"
                        style={{ color: isPositive ? '#10B981' : '#EF4444' }}
                    >
                        {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {isPositive ? '+' : ''}{changePercent.toFixed(1)}%
                    </span>
                </div>
                <div style={{ height: 120 }}>
                    <LineChart
                        data={totalChartData}
                        color="#10B981"
                        height={120}
                    />
                </div>
            </div>

            {/* Detailed Trend Chart */}
            <div className="gradient-card p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">Detailed Trend (Top 5)</span>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-2 mb-3">
                    {detailedDatasets.map((ds, i) => (
                        <div key={i} className="flex items-center gap-1 text-xs">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ds.color }} />
                            <span className="text-gray-400">{ds.label}</span>
                        </div>
                    ))}
                </div>
                <div style={{ height: 120 }}>
                    <MultiLineChart
                        datasets={detailedDatasets}
                        height={120}
                    />
                </div>
            </div>
        </div>
    );
};

export default TrendsTab;
