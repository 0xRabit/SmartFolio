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
    // Chain color map - distinct brand colors for each chain
    const CHAIN_COLORS = {
        'BTC': '#F7931A',     // Bitcoin orange
        'EVM': '#627EEA',     // Ethereum blue
        'SOL': '#14F195',     // Solana green
        'CEX': '#8B5CF6',     // Purple
        'LTC': '#345D9D',     // Litecoin blue
        'DOGE': '#C2A633',    // Dogecoin gold
        'TON': '#0098EA',     // TON blue
        'SUI': '#4DA2FF',     // SUI sky blue
        'APT': '#2ED8A3',     // Aptos teal
        'AVAX': '#E84142',    // Avalanche red
        'ATOM': '#2E3148',    // Cosmos dark blue
        'ADA': '#0033AD',     // Cardano blue
        'COLD WALLET': '#9CA3AF', // Gray
    };

    // Aggregate balances by chain type
    const aggregated = {};

    wallets.forEach(w => {
        let type;
        if (w.isCex) {
            type = 'CEX';
        } else {
            type = (w.chain_type || 'OTHER').toUpperCase();
        }
        const balance = w.balance || 0;
        aggregated[type] = (aggregated[type] || 0) + balance;
    });

    const labels = Object.keys(aggregated);
    const data = Object.values(aggregated);
    const colors = labels.map(l => CHAIN_COLORS[l] || '#6B7280');

    if (allocationChart) {
        allocationChart.data.labels = labels;
        allocationChart.data.datasets[0].data = data;
        allocationChart.data.datasets[0].backgroundColor = colors;
        allocationChart.update();
    }

    // Update chain legend dynamically
    const total = data.reduce((s, v) => s + v, 0);
    const legendContainer = document.getElementById('chain-legend');
    if (legendContainer) {
        legendContainer.innerHTML = '';
        // Sort by balance descending
        const sorted = labels.map((l, i) => ({ label: l, value: data[i], color: colors[i] }))
            .sort((a, b) => b.value - a.value);

        sorted.forEach(item => {
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
            let valueStr;
            if (item.value >= 1000000) {
                valueStr = `$${(item.value / 1000000).toFixed(1)}M`;
            } else if (item.value >= 1000) {
                valueStr = `$${(item.value / 1000).toFixed(1)}k`;
            } else {
                valueStr = `$${item.value.toFixed(0)}`;
            }
            const div = document.createElement('div');
            div.className = 'flex items-center gap-2';
            div.innerHTML = `
                <span class="w-3 h-3 rounded-full flex-shrink-0" style="background:${item.color}"></span>
                <span>${item.label}</span>
                <span class="text-gray-500 ml-auto">${valueStr} (${pct}%)</span>
            `;
            legendContainer.appendChild(div);
        });
    }
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
