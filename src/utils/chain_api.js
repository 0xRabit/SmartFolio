// chain_api.js
import axios from 'axios';
import { COINGECKO_API, MEMPOOL_API, BITSTAMP_API, RPC_TIMEOUT } from '../config.js';

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
            try {
                price = await getPrice("solana");
            } catch (e) {
                console.warn("Price fetch failed, defaulting to 0 for now");
            }

            return solBalance * price;

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
        const price = await getPrice("bitcoin");

        return btcBalance * price;

    } catch (error) {
        console.error("Bitcoin API Error:", error);
        throw error;
    }
}

// --- Cold Wallet (Manual) ---

export async function getColdWalletBalance(remark, type = "btc") {
    // Logic: Extract amount from Remark, Get Price, Multiply.

    // 1. Parse amount from remark string (e.g. "Holds 0.5 BTC")
    const amount = parseAmount(remark);
    if (amount === 0) return 0;

    // 2. Get Price
    let price = 0;
    if (type.toLowerCase().includes("btc")) {
        price = await getBitstampPrice("btcusd");
    } else if (type.toLowerCase().includes("eth")) {
        price = await getBitstampPrice("ethusd");
    } else {
        // Default fallback
        price = await getPrice("bitcoin");
    }

    return amount * price;
}

// --- Helpers ---

async function getPrice(coingeckoId) {
    try {
        const url = `${COINGECKO_API}/simple/price?ids=${coingeckoId}&vs_currencies=usd`;
        const resp = await axios.get(url);
        return resp.data[coingeckoId].usd;
    } catch (e) {
        console.error("CoinGecko Error:", e.message);
        return 0;
    }
}

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
    // Extract first floating point number
    const match = text.match(/[\d,]+\.?\d*/);
    if (match) {
        return parseFloat(match[0].replace(/,/g, ''));
    }
    return 0;
}
