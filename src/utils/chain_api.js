// chain_api.js
import axios from 'axios';
import {
    COINGECKO_API, MEMPOOL_API, BITSTAMP_API, RPC_TIMEOUT,
    LITECOIN_SPACE_API, BLOCKCYPHER_DOGE_API, TONCENTER_API,
    SUI_RPC, APTOS_API, AVAX_RPC, COSMOS_LCD, KOIOS_API
} from '../config.js';

// Solana RPC (Configured by User)
const SOLANA_RPCS = [];

export async function getSolanaBalance(address) {
    let lastError = null;
    let rpcsToTry = [...SOLANA_RPCS];

    try {
        const data = await chrome.storage.local.get(['settings']);
        if (data.settings?.customSolanaRpc) {
            console.log("Using Custom Solana RPC from settings");
            rpcsToTry.unshift(data.settings.customSolanaRpc);
        }
    } catch (e) {
        // Can fail if used outside dashboard context
    }

    // Try multiple RPCs
    for (const rpcUrl of rpcsToTry) {
        try {
            console.log(`Attempting Solana RPC: ${rpcUrl}`);
            const payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getBalance",
                "params": [address]
            };

            const response = await axios.post(rpcUrl, payload, {
                timeout: 5000, // 5s timeout
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.error) {
                throw new Error("RPC Error: " + response.data.error.message);
            }

            const lamports = response.data.result.value;
            const solBalance = lamports / 1000000000; // 10^9

            // 2. Get Price (Only needed once, can fail gracefully)
            let price = 0;
            let priceError = null;
            try {
                const priceResult = await getPrice("solana");
                price = priceResult.price;
                priceError = priceResult.error;
            } catch (e) {
                console.warn("Price fetch failed, defaulting to 0 for now");
            }

            return { usd: solBalance * price, native: solBalance, symbol: 'SOL', price_error: priceError };

        } catch (error) {
            console.warn(`Solana RPC failed [${rpcUrl}]:`, error.message);
            lastError = error;
            // Continue to next RPC
        }
    }

    // If all failed
    console.error("All Solana RPCs failed.");
    throw lastError || new Error("All Solana RPCs failed");
}

// --- BTC ---

export async function getBitcoinBalance(address) {
    try {
        // 1. Get BTC Balance (Satoshis) via Mempool.space
        const url = `${MEMPOOL_API}/address/${address}`;
        const response = await axios.get(url);

        const stats = response.data.chain_stats;
        const funded = stats.funded_txo_sum;
        const spent = stats.spent_txo_sum;
        const satoshis = funded - spent;

        const btcBalance = satoshis / 100000000; // 10^8

        // 2. Get Price
        const priceResult = await getPrice("bitcoin");

        return { usd: btcBalance * priceResult.price, native: btcBalance, symbol: 'BTC', price_error: priceResult.error };

    } catch (error) {
        console.error("Bitcoin API Error:", error);
        throw error;
    }
}

// --- Cold Wallet (Manual) ---

// --- LTC (Litecoin) ---

export async function getLitecoinBalance(address) {
    try {
        const url = `${LITECOIN_SPACE_API}/address/${address}`;
        const response = await axios.get(url, { timeout: RPC_TIMEOUT });

        const stats = response.data.chain_stats;
        const funded = stats.funded_txo_sum;
        const spent = stats.spent_txo_sum;
        const satoshis = funded - spent;
        const ltcBalance = satoshis / 1e8;

        const priceResult = await getPrice('litecoin');
        return { usd: ltcBalance * priceResult.price, native: ltcBalance, symbol: 'LTC', price_error: priceResult.error };
    } catch (error) {
        console.error('Litecoin API Error:', error.message);
        throw error;
    }
}

// --- DOGE (Dogecoin) ---

export async function getDogecoinBalance(address) {
    try {
        const url = `${BLOCKCYPHER_DOGE_API}/addrs/${address}/balance`;
        const response = await axios.get(url, { timeout: RPC_TIMEOUT });

        const dogeBalance = response.data.balance / 1e8;

        const priceResult = await getPrice('dogecoin');
        return { usd: dogeBalance * priceResult.price, native: dogeBalance, symbol: 'DOGE', price_error: priceResult.error };
    } catch (error) {
        console.error('Dogecoin API Error:', error.message);
        throw error;
    }
}

// --- TON (The Open Network) ---

export async function getTonBalance(address) {
    try {
        const url = `${TONCENTER_API}/getAddressBalance?address=${address}`;
        const response = await axios.get(url, { timeout: RPC_TIMEOUT });

        if (!response.data.ok) {
            throw new Error('Toncenter API error: ' + JSON.stringify(response.data));
        }

        const tonBalance = parseInt(response.data.result) / 1e9;

        const priceResult = await getPrice('the-open-network');
        return { usd: tonBalance * priceResult.price, native: tonBalance, symbol: 'TON', price_error: priceResult.error };
    } catch (error) {
        console.error('TON API Error:', error.message);
        throw error;
    }
}

// --- SUI ---

export async function getSuiBalance(address) {
    try {
        const payload = {
            jsonrpc: '2.0',
            id: 1,
            method: 'suix_getBalance',
            params: [address, '0x2::sui::SUI']
        };

        const response = await axios.post(SUI_RPC, payload, {
            timeout: RPC_TIMEOUT,
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.data.error) {
            throw new Error('SUI RPC Error: ' + response.data.error.message);
        }

        const suiBalance = parseInt(response.data.result.totalBalance) / 1e9;

        const priceResult = await getPrice('sui');
        return { usd: suiBalance * priceResult.price, native: suiBalance, symbol: 'SUI', price_error: priceResult.error };
    } catch (error) {
        console.error('SUI API Error:', error.message);
        throw error;
    }
}

// --- APT (Aptos) ---

export async function getAptosBalance(address) {
    try {
        // Use view function - works with both legacy CoinStore and new Fungible Asset (FA) standard
        const viewUrl = `${APTOS_API}/view`;
        const viewPayload = {
            function: '0x1::coin::balance',
            type_arguments: ['0x1::aptos_coin::AptosCoin'],
            arguments: [address]
        };

        const response = await axios.post(viewUrl, viewPayload, {
            timeout: RPC_TIMEOUT,
            headers: { 'Content-Type': 'application/json' }
        });

        // Response: ["303285423538788"]
        const rawBalance = response.data[0];
        const aptBalance = parseInt(rawBalance) / 1e8;

        const priceResult = await getPrice('aptos');
        return { usd: aptBalance * priceResult.price, native: aptBalance, symbol: 'APT', price_error: priceResult.error };
    } catch (error) {
        console.error('Aptos API Error:', error.message);
        throw error;
    }
}

// --- AVAX (Avalanche C-Chain) ---

export async function getAvaxBalance(address) {
    try {
        const payload = {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBalance',
            params: [address, 'latest']
        };

        const response = await axios.post(AVAX_RPC, payload, {
            timeout: RPC_TIMEOUT,
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.data.error) {
            throw new Error('AVAX RPC Error: ' + response.data.error.message);
        }

        const weiBalance = BigInt(response.data.result);
        const avaxBalance = Number(weiBalance) / 1e18;

        const priceResult = await getPrice('avalanche-2');
        return { usd: avaxBalance * priceResult.price, native: avaxBalance, symbol: 'AVAX', price_error: priceResult.error };
    } catch (error) {
        console.error('AVAX API Error:', error.message);
        throw error;
    }
}

// --- ATOM (Cosmos Hub) ---

export async function getCosmosBalance(address) {
    try {
        const url = `${COSMOS_LCD}/cosmos/bank/v1beta1/balances/${address}`;
        const response = await axios.get(url, { timeout: RPC_TIMEOUT });

        const balances = response.data.balances || [];
        const atomBalance = balances.find(b => b.denom === 'uatom');
        const atomAmount = atomBalance ? parseInt(atomBalance.amount) / 1e6 : 0;

        const priceResult = await getPrice('cosmos');
        return { usd: atomAmount * priceResult.price, native: atomAmount, symbol: 'ATOM', price_error: priceResult.error };
    } catch (error) {
        console.error('Cosmos API Error:', error.message);
        throw error;
    }
}

// --- ADA (Cardano) ---

export async function getCardanoBalance(address) {
    // Try multiple Koios endpoints for reliability
    const koiosEndpoints = [
        'https://api.koios.rest/api/v1',
        'https://guild.koios.rest/api/v1',
    ];

    let lastError = null;

    for (const endpoint of koiosEndpoints) {
        try {
            const url = `${endpoint}/address_info`;
            console.log(`Cardano: trying ${endpoint}...`);
            const response = await axios.post(url,
                { _addresses: [address] },
                { timeout: 10000, headers: { 'Content-Type': 'application/json' } }
            );

            if (!Array.isArray(response.data) || response.data.length === 0) {
                console.warn(`Cardano: No data from ${endpoint}`);
                continue;
            }

            const adaBalance = parseInt(response.data[0].balance || '0') / 1e6;
            const priceResult = await getPrice('cardano');
            console.log(`Cardano: ${adaBalance} ADA via ${endpoint}`);
            return { usd: adaBalance * priceResult.price, native: adaBalance, symbol: 'ADA', price_error: priceResult.error };
        } catch (error) {
            console.warn(`Cardano ${endpoint} failed:`, error.code || error.message);
            lastError = error;
        }
    }

    console.error('Cardano: All endpoints failed');
    throw lastError || new Error('All Cardano endpoints failed');
}

export async function getColdWalletBalance(remark, type = "btc") {
    // Logic: Extract amount from Remark, Get Price, Multiply.

    // 1. Parse amount from remark string (e.g. "Holds 0.5 BTC")
    const amount = parseAmount(remark);
    if (amount === 0) return { usd: 0, native: 0, symbol: 'BTC', price_error: null };

    // 2. Get Price
    let price = 0;
    let symbol = 'BTC';
    if (type.toLowerCase().includes("btc")) {
        price = await getBitstampPrice("btcusd");
        symbol = 'BTC';
    } else if (type.toLowerCase().includes("eth")) {
        price = await getBitstampPrice("ethusd");
        symbol = 'ETH';
    } else {
        // Default fallback
        const priceResult = await getPrice("bitcoin");
        price = priceResult.price;
    }

    return { usd: amount * price, native: amount, symbol, price_error: null };
}

// --- Price System ---

// CoinGecko ID → Binance symbol mapping for fallback
const COINGECKO_TO_BINANCE = {
    'bitcoin': 'BTCUSDT',
    'ethereum': 'ETHUSDT',
    'solana': 'SOLUSDT',
    'sui': 'SUIUSDT',
    'aptos': 'APTUSDT',
    'litecoin': 'LTCUSDT',
    'dogecoin': 'DOGEUSDT',
    'the-open-network': 'TONUSDT',
    'avalanche-2': 'AVAXUSDT',
    'cosmos': 'ATOMUSDT',
    'cardano': 'ADAUSDT',
};

// All CoinGecko IDs we need
const ALL_COINGECKO_IDS = Object.keys(COINGECKO_TO_BINANCE);

// Price store: { coingeckoId: { price, error, timestamp } }
const priceStore = {};
let pricesFetched = false;
let lastPriceError = null;

const BINANCE_TICKER_URL = 'https://api.binance.com/api/v3/ticker/price';

/**
 * Batch-fetch all coin prices in ONE CoinGecko call.
 * Falls back to Binance ticker API if CoinGecko fails.
 * Call this once before processing wallets.
 */
export async function prefetchAllPrices() {
    lastPriceError = null;
    const now = Date.now();

    // Skip if recently fetched (within 60s)
    if (pricesFetched && Object.keys(priceStore).length > 0) {
        const anyEntry = priceStore[ALL_COINGECKO_IDS[0]];
        if (anyEntry && (now - anyEntry.timestamp) < 60000) {
            console.log('Prices still cached, skipping prefetch');
            return;
        }
    }

    // --- Attempt 1: CoinGecko batch ---
    try {
        const ids = ALL_COINGECKO_IDS.join(',');
        const url = `${COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=usd`;
        console.log('Fetching all prices from CoinGecko (batch)...');
        const resp = await axios.get(url, { timeout: RPC_TIMEOUT });

        if (resp.status === 429 || resp.data?.status?.error_code === 429) {
            throw new Error('CoinGecko rate limited (429)');
        }

        let successCount = 0;
        for (const id of ALL_COINGECKO_IDS) {
            const price = resp.data[id]?.usd || 0;
            priceStore[id] = { price, error: price === 0 ? 'no_data' : null, timestamp: now };
            if (price > 0) successCount++;
        }

        pricesFetched = true;
        console.log(`CoinGecko batch: ${successCount}/${ALL_COINGECKO_IDS.length} prices fetched`);
        return;

    } catch (e) {
        console.warn('CoinGecko batch failed:', e.message);
        const isRateLimit = e.message.includes('429') ||
            e.response?.status === 429 ||
            e.response?.data?.status?.error_code === 429;

        if (isRateLimit) {
            lastPriceError = 'rate_limited';
        }
        console.log('Falling back to Binance ticker API...');
    }

    // --- Attempt 2: Binance fallback ---
    try {
        console.log('Fetching all prices from Binance (fallback)...');
        const resp = await axios.get(BINANCE_TICKER_URL, { timeout: RPC_TIMEOUT });

        const binancePrices = {};
        for (const item of resp.data) {
            binancePrices[item.symbol] = parseFloat(item.price);
        }

        let successCount = 0;
        for (const id of ALL_COINGECKO_IDS) {
            const binanceSymbol = COINGECKO_TO_BINANCE[id];
            const price = binancePrices[binanceSymbol] || 0;
            priceStore[id] = { price, error: price === 0 ? 'no_data' : null, timestamp: Date.now() };
            if (price > 0) successCount++;
        }

        pricesFetched = true;
        lastPriceError = null; // Binance succeeded, clear error
        console.log(`Binance fallback: ${successCount}/${ALL_COINGECKO_IDS.length} prices fetched`);
        return;

    } catch (e) {
        console.error('Binance fallback also failed:', e.message);
    }

    // --- Both failed: mark all as error ---
    lastPriceError = 'rate_limited';
    for (const id of ALL_COINGECKO_IDS) {
        if (!priceStore[id] || priceStore[id].price === 0) {
            priceStore[id] = { price: 0, error: 'rate_limited', timestamp: Date.now() };
        }
    }
    pricesFetched = true;
}

/**
 * Get cached price for a coin. Must call prefetchAllPrices() first.
 * Returns { price, error } where error is null or 'rate_limited'/'no_data'.
 */
function getCachedPrice(coingeckoId) {
    const entry = priceStore[coingeckoId];
    if (entry) {
        return { price: entry.price, error: entry.error };
    }
    return { price: 0, error: 'not_prefetched' };
}

// Keep getPrice as a per-coin fallback (used by getColdWalletBalance etc.)
async function getPrice(coingeckoId) {
    const cached = getCachedPrice(coingeckoId);
    if (cached.price > 0) {
        return cached;
    }
    // Try CoinGecko single call as last resort
    try {
        const url = `${COINGECKO_API}/simple/price?ids=${coingeckoId}&vs_currencies=usd`;
        const resp = await axios.get(url, { timeout: RPC_TIMEOUT });
        if (resp.status === 429 || resp.data?.status?.error_code === 429) {
            return { price: 0, error: 'rate_limited' };
        }
        const price = resp.data[coingeckoId]?.usd || 0;
        priceStore[coingeckoId] = { price, error: null, timestamp: Date.now() };
        return { price, error: null };
    } catch (e) {
        const isRateLimit = e.response?.status === 429;
        return { price: 0, error: isRateLimit ? 'rate_limited' : 'fetch_error' };
    }
}

export function getLastPriceError() { return lastPriceError; }
export function resetPriceError() { lastPriceError = null; }

async function getBitstampPrice(pair) {
    try {
        const url = `${BITSTAMP_API}/ticker/${pair}/`;
        const resp = await axios.get(url);
        return parseFloat(resp.data.last);
    } catch (e) {
        console.error("Bitstamp Error:", e.message);
        return 0;
    }
}

function parseAmount(text) {
    if (!text) return 0;
    const match = text.match(/[\d,]+\.?\d*/);
    if (match) {
        return parseFloat(match[0].replace(/,/g, ''));
    }
    return 0;
}

