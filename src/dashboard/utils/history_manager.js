// history_manager.js - History and Trend Charts Module
// Handles historical data storage, chart rendering, and CSV export

/**
 * Get local date string in YYYY-MM-DD format (local timezone)
 */
function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Chart references - will be set by initHistoryManager
let totalTrendChart = null;
let detailTrendChart = null;

/**
 * Set chart references from external chart_utils module
 */
export function setChartRefs(totalChart, detailChart) {
    totalTrendChart = totalChart;
    detailTrendChart = detailChart;
}

/**
 * Update history with current wallet data
 * @param {Array} wallets - Current wallet data
 */
export async function updateHistory(wallets) {
    const data = await chrome.storage.local.get(['history']);
    let history = data.history || [];

    // Get today's date YYYY-MM-DD (LOCAL timezone, not UTC)
    const today = getLocalDateString();

    // 1. Remove ANY existing records for Today (Deduplication)
    history = history.filter(h => h.date !== today);

    let dailyTotal = 0;

    // 2. Add new records from current wallets
    wallets.forEach(w => {
        history.push({
            date: today,
            address: w.address,
            chain_type: w.chain_type,
            remark: w.remark || '',
            balance: w.balance || 0
        });
        dailyTotal += (w.balance || 0);
    });

    // 3. Add Total Record
    history.push({
        date: today,
        address: 'TOTAL',
        chain_type: 'summary',
        remark: 'Daily Total',
        balance: dailyTotal
    });

    // 4. Limit history to 90 days to prevent storage bloat
    const MAX_HISTORY_DAYS = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_HISTORY_DAYS);
    const cutoffStr = getLocalDateString(cutoffDate);
    history = history.filter(h => h.date >= cutoffStr);

    // 5. Save
    await chrome.storage.local.set({ history });
    console.log("History updated for", today, "- Total records:", history.length);

    // 6. Update Charts
    renderTrendCharts(history);
}

/**
 * Render trend charts with history data
 * @param {Array} history - History records
 */
export function renderTrendCharts(history) {
    if (!history || history.length === 0) return;

    // --- 1. Total Trend ---
    const totalRecords = history
        .filter(h => h.chain_type === 'summary')
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (totalTrendChart && totalRecords.length > 0) {
        totalTrendChart.data.labels = totalRecords.map(r => r.date);
        totalTrendChart.data.datasets = [{
            label: 'Total Balance',
            data: totalRecords.map(r => r.balance),
            borderColor: '#2563EB', // Blue-600
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            fill: true,
            tension: 0.3
        }];
        totalTrendChart.update();
    }

    // --- 2. Detailed Trend (Top 10) ---
    // Group by address/remark
    const walletGroups = {}; // key: remark|address, value: [records]
    history.forEach(r => {
        if (r.chain_type === 'summary') return;
        const key = r.remark || r.address;
        if (!walletGroups[key]) walletGroups[key] = [];
        walletGroups[key].push(r);
    });

    // Find top wallets by LATEST balance
    const latestDate = totalRecords[totalRecords.length - 1]?.date;
    const topWallets = Object.keys(walletGroups)
        .map(key => {
            const latestRecord = walletGroups[key].find(r => r.date === latestDate);
            return {
                key: key,
                balance: latestRecord ? latestRecord.balance : 0
            };
        })
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10); // Top 10

    // Prepare datasets
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'];
    const datasets = topWallets.map((w, i) => {
        const records = walletGroups[w.key].sort((a, b) => new Date(a.date) - new Date(b.date));
        return {
            label: w.key,
            data: records.map(r => r.balance),
            borderColor: colors[i % colors.length],
            tension: 0.3,
            fill: false
        };
    });

    if (detailTrendChart) {
        detailTrendChart.data.labels = totalRecords.map(r => r.date); // Use same dates
        detailTrendChart.data.datasets = datasets;
        detailTrendChart.update();
    }
}

/**
 * Export history data to CSV file
 */
export async function exportHistoryToCSV() {
    const data = await chrome.storage.local.get(['history']);
    const history = data.history || [];

    if (history.length === 0) {
        alert("No history data to export.");
        return;
    }

    // JSON to CSV
    const headers = ["Date", "Chain", "Address", "Remark", "Balance", "Source", "is_cold"];
    const csvRows = [headers.join(",")];

    history.forEach(row => {
        // Determine source: API or Screenshot
        const chain = (row.chain_type || '').toLowerCase();
        const isCex = chain.includes('cex') || (row.remark || '').toLowerCase().includes('cex');
        const isApiSource = isCex || chain === 'btc' || chain === 'bitcoin' || chain === 'evm' || chain === 'sol';
        const source = isApiSource ? 'API' : 'Screenshot';

        // Determine storage type from wallet_type field
        const walletType = (row.wallet_type || 'hot').toLowerCase();
        let storageType = 'hot';
        if (isCex || walletType === 'cex') {
            storageType = 'cex';
        } else if (walletType === 'cold') {
            storageType = 'cold';
        }

        const values = [
            row.date,
            row.chain_type,
            row.address,
            `"${row.remark || ''}"`, // Quote remark in case of commas
            row.balance,
            source,
            storageType
        ];
        csvRows.push(values.join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Initialize history manager with event listeners
 */
export function initHistoryUI() {
    const btnExportHistory = document.getElementById('btn-export-history');
    if (btnExportHistory) {
        btnExportHistory.addEventListener('click', exportHistoryToCSV);
    }
}

export default {
    setChartRefs,
    updateHistory,
    renderTrendCharts,
    exportHistoryToCSV,
    initHistoryUI
};
