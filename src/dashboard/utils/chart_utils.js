// chart_utils.js - Chart.js utilities for dashboard
// Extracted from index.js for better modularity

import Chart from 'chart.js/auto';

// Chart instances (managed by this module)
let allocationChart = null;
let totalTrendChart = null;
let detailTrendChart = null;

/**
 * Get chart instances
 */
export function getCharts() {
    return { allocationChart, totalTrendChart, detailTrendChart };
}

/**
 * Update allocation chart with wallet data
 * @param {Array} wallets - Array of wallet objects
 */
export function updateChart(wallets) {
    // Aggregate balances by chain type
    const aggregated = {};
    const balances = { btc: 0, evm: 0, sol: 0, cex: 0 };

    wallets.forEach(w => {
        const type = w.chain_type.toUpperCase();
        const balance = w.balance || 0;
        aggregated[type] = (aggregated[type] || 0) + balance;

        // Aggregate by chain type for legend
        const chain = (w.chain_type || '').toLowerCase();
        if (w.isCex) balances.cex += balance;
        else if (chain === 'btc' || chain === 'bitcoin') balances.btc += balance;
        else if (chain === 'evm') balances.evm += balance;
        else if (chain === 'sol') balances.sol += balance;
    });

    const labels = Object.keys(aggregated);
    const data = Object.values(aggregated);
    const colors = labels.map(l => {
        if (l === 'EVM') return '#627EEA';
        if (l === 'SOL') return '#14F195';
        if (l === 'BTC') return '#F7931A';
        if (l === 'CEX') return '#8B5CF6';
        return '#6B7280'; // Default gray
    });

    if (allocationChart) {
        allocationChart.data.labels = labels;
        allocationChart.data.datasets[0].data = data;
        allocationChart.data.datasets[0].backgroundColor = colors;
        allocationChart.update();
    }

    // Update chain legend with dollar values and percentages
    const total = balances.btc + balances.evm + balances.sol + balances.cex;
    const btcEl = document.getElementById('legend-btc');
    const evmEl = document.getElementById('legend-evm');
    const solEl = document.getElementById('legend-sol');
    const cexEl = document.getElementById('legend-cex');

    const formatLegend = (value) => {
        const pct = total > 0 ? ((value / total) * 100).toFixed(0) : 0;
        if (value >= 1000) {
            return `$${(value / 1000).toFixed(1)}k (${pct}%)`;
        }
        return `$${value.toFixed(0)} (${pct}%)`;
    };

    if (btcEl) btcEl.textContent = formatLegend(balances.btc);
    if (evmEl) evmEl.textContent = formatLegend(balances.evm);
    if (solEl) solEl.textContent = formatLegend(balances.sol);
    if (cexEl) cexEl.textContent = formatLegend(balances.cex);
}

/**
 * Initialize all charts
 */
export function initChart() {
    // 1. Allocation Chart (Doughnut with percentage labels)
    const ctxAlloc = document.getElementById('allocation-chart').getContext('2d');
    allocationChart = new Chart(ctxAlloc, {
        type: 'doughnut',
        data: {
            labels: ['Loading...'],
            datasets: [{ data: [1], backgroundColor: ['#E5E7EB'] }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true }
            }
        },
        plugins: [{
            id: 'datalabels',
            afterDatasetsDraw(chart) {
                const ctx = chart.ctx;
                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    const meta = chart.getDatasetMeta(datasetIndex);
                    const total = dataset.data.reduce((sum, val) => sum + val, 0);

                    meta.data.forEach((element, index) => {
                        const value = dataset.data[index];
                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;

                        if (percentage > 3) {
                            const centerX = element.x;
                            const centerY = element.y;

                            ctx.save();
                            ctx.fillStyle = '#fff';
                            ctx.font = 'bold 11px sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(`${percentage}%`, centerX, centerY);
                            ctx.restore();
                        }
                    });
                });
            }
        }]
    });

    // 2. Total Trend Chart
    const ctxTotal = document.getElementById('trend-total-chart');
    if (ctxTotal) {
        totalTrendChart = new Chart(ctxTotal.getContext('2d'), {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: false } },
                plugins: { legend: { display: false }, title: { display: false } }
            }
        });
    }

    // 3. Detailed Trend Chart
    const ctxDetail = document.getElementById('trend-detail-chart');
    if (ctxDetail) {
        detailTrendChart = new Chart(ctxDetail.getContext('2d'), {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'top' } }
            }
        });
    }
}

/**
 * Update total trend chart
 * @param {Array} labels - Date labels
 * @param {Array} data - Balance data points
 */
export function updateTotalTrendChart(labels, data) {
    if (!totalTrendChart) return;

    totalTrendChart.data.labels = labels;
    totalTrendChart.data.datasets = [{
        label: 'Total Balance',
        data: data,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3
    }];
    totalTrendChart.update();
}

/**
 * Update detail trend chart
 * @param {Array} labels - Date labels
 * @param {Array} datasets - Array of dataset objects
 */
export function updateDetailTrendChart(labels, datasets) {
    if (!detailTrendChart) return;

    detailTrendChart.data.labels = labels;
    detailTrendChart.data.datasets = datasets;
    detailTrendChart.update();
}

export default {
    initChart,
    updateChart,
    updateTotalTrendChart,
    updateDetailTrendChart,
    getCharts
};
