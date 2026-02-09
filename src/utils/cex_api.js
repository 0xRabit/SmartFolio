// CEX API Module - Balance fetching for Binance, OKX, Bybit, Bitget
// Uses HMAC-SHA256 signing for all exchanges
// Browser-compatible using Web Crypto API

import axios from 'axios';
import { BINANCE_API, OKX_API, BYBIT_API, BITGET_API, BACKPACK_API, API_TIMEOUT } from '../config.js';

// ============ HMAC-SHA256 Helpers (Web Crypto API) ============

async function hmacSha256Hex(key, message) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

async function hmacSha256Base64(key, message) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const bytes = new Uint8Array(signature);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
}

// ============ ED25519 Helpers (for Backpack) ============
// Backpack uses ED25519 signing which requires a different approach
// The private key (seed) is base64-encoded, we need to decode and use it

import nacl from 'tweetnacl';

async function ed25519Sign(privateKeyBase64, message) {
    const encoder = new TextEncoder();
    const messageData = encoder.encode(message);

    // Decode base64 private key
    const privateKeyBytes = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));

    let secretKey;
    if (privateKeyBytes.length === 32) {
        // It's a seed, derive the full key pair
        secretKey = nacl.sign.keyPair.fromSeed(privateKeyBytes).secretKey;
    } else if (privateKeyBytes.length === 64) {
        // It's already a full secret key
        secretKey = privateKeyBytes;
    } else {
        throw new Error(`Invalid Ed25519 key length: ${privateKeyBytes.length}. Expected 32 (seed) or 64 (full key) bytes.`);
    }

    // Sign the message (detached signature)
    const signature = nacl.sign.detached(messageData, secretKey);

    // Return base64-encoded signature
    return btoa(String.fromCharCode(...signature));
}

// ============ BINANCE ============
// Endpoint: GET /sapi/v1/asset/wallet/balance (consolidated)
// Returns: Spot, Funding, Cross Margin, Isolated Margin, USDT-M Futures, COIN-M Futures, Earn
// Auth: HMAC-SHA256 hex signature in query param

export async function getBinanceBalance(apiKey, apiSecret) {
    const baseUrl = 'https://api.binance.com';
    const endpoint = '/sapi/v1/asset/wallet/balance';
    const timestamp = Date.now();

    const queryString = `timestamp=${timestamp}`;
    const signature = await hmacSha256Hex(apiSecret, queryString);

    const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    try {
        const response = await axios.get(url, {
            headers: {
                'X-MBX-APIKEY': apiKey
            },
            timeout: 10000
        });

        // Response format: [{ "activate": true, "balance": "10.5", "walletName": "Spot" }, ...]
        // walletName can be: Spot, Funding, Cross Margin, Isolated Margin, USDⓈ-M Futures, COIN-M Futures, Earn
        const wallets = response.data || [];
        let totalBtc = 0;

        for (const wallet of wallets) {
            const balance = parseFloat(wallet.balance) || 0;
            if (balance > 0) {
                totalBtc += balance;
                // console.log(`  Binance ${wallet.walletName}: ${balance.toFixed(8)} BTC`);
            }
        }

        // Convert BTC total to USD
        let btcPrice = 0;
        try {
            btcPrice = await getBinancePrice('BTCUSDT');
        } catch (e) {
            console.warn('Failed to fetch BTC price for conversion:', e);
        }

        const totalUsd = totalBtc * btcPrice;
        return { balance: totalUsd, status: 'success' };
    } catch (error) {
        // Fall back to spot-only if wallet/balance endpoint fails
        console.warn('Binance wallet/balance failed, falling back to spot account:', error.message);
        return await getBinanceSpotBalance(apiKey, apiSecret);
    }
}

// Fallback: Spot account only (for accounts without SAPI access)
async function getBinanceSpotBalance(apiKey, apiSecret) {
    const baseUrl = 'https://api.binance.com';
    const endpoint = '/api/v3/account';
    const timestamp = Date.now();

    const queryString = `timestamp=${timestamp}`;
    const signature = await hmacSha256Hex(apiSecret, queryString);

    const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    try {
        const response = await axios.get(url, {
            headers: {
                'X-MBX-APIKEY': apiKey
            },
            timeout: 10000
        });

        const balances = response.data.balances || [];
        let totalUsd = 0;

        for (const asset of balances) {
            const free = parseFloat(asset.free) || 0;
            const locked = parseFloat(asset.locked) || 0;
            const total = free + locked;

            if (total > 0) {
                if (asset.asset === 'USDT' || asset.asset === 'USDC' || asset.asset === 'BUSD') {
                    totalUsd += total;
                } else if (asset.asset === 'BTC') {
                    const btcPrice = await getBinancePrice('BTCUSDT');
                    totalUsd += total * btcPrice;
                } else if (asset.asset === 'ETH') {
                    const ethPrice = await getBinancePrice('ETHUSDT');
                    totalUsd += total * ethPrice;
                } else if (total > 0.01) {
                    try {
                        const price = await getBinancePrice(`${asset.asset}USDT`);
                        totalUsd += total * price;
                    } catch {
                        // Skip assets without USDT pair
                    }
                }
            }
        }

        return { balance: totalUsd, status: 'success' };
    } catch (error) {
        console.error('Binance API error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.msg || error.message);
    }
}

async function getBinancePrice(symbol) {
    try {
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        return parseFloat(response.data.price) || 0;
    } catch {
        return 0;
    }
}

// ============ OKX ============
// Trading Account: GET /api/v5/account/balance
// Funding Account: GET /api/v5/asset/balances
// Auth: HMAC-SHA256 base64 + passphrase

export async function getOkxBalance(apiKey, apiSecret, passphrase) {
    const baseUrl = OKX_API;
    const method = 'GET';

    let tradingBalance = 0;
    let fundingBalance = 0;
    let savingsBalance = 0;

    // 1. Get Trading Account Balance
    try {
        const tradingEndpoint = '/api/v5/account/balance';
        const timestamp1 = new Date().toISOString();
        const preHash1 = timestamp1 + method + tradingEndpoint + '';
        const signature1 = await hmacSha256Base64(apiSecret, preHash1);

        const tradingResponse = await axios.get(`${baseUrl}${tradingEndpoint}`, {
            headers: {
                'OK-ACCESS-KEY': apiKey,
                'OK-ACCESS-SIGN': signature1,
                'OK-ACCESS-TIMESTAMP': timestamp1,
                'OK-ACCESS-PASSPHRASE': passphrase,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (tradingResponse.data.code === '0') {
            const data = tradingResponse.data.data || [];
            for (const account of data) {
                // totalEq is the total equity in USD
                tradingBalance = parseFloat(account.totalEq) || 0;
            }
        }
    } catch (err) {
        console.warn('OKX trading account error:', err.message);
    }

    // 2. Get Funding Account Balance
    try {
        const fundingEndpoint = '/api/v5/asset/balances';
        const timestamp2 = new Date().toISOString();
        const preHash2 = timestamp2 + method + fundingEndpoint + '';
        const signature2 = await hmacSha256Base64(apiSecret, preHash2);

        const fundingResponse = await axios.get(`${baseUrl}${fundingEndpoint}`, {
            headers: {
                'OK-ACCESS-KEY': apiKey,
                'OK-ACCESS-SIGN': signature2,
                'OK-ACCESS-TIMESTAMP': timestamp2,
                'OK-ACCESS-PASSPHRASE': passphrase,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (fundingResponse.data.code === '0') {
            const assets = fundingResponse.data.data || [];
            for (const asset of assets) {
                const bal = parseFloat(asset.bal) || 0;
                if (bal > 0) {
                    const ccy = asset.ccy;
                    if (ccy === 'USDT' || ccy === 'USDC' || ccy === 'USD') {
                        fundingBalance += bal;
                    } else {
                        try {
                            const price = await getOkxPrice(ccy);
                            fundingBalance += bal * price;
                        } catch {
                            // Skip assets without price
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.warn('OKX funding account error:', err.message);
    }

    // 3. Get Savings/Earn Balance
    try {
        const savingsEndpoint = '/api/v5/finance/savings/balance';
        const timestamp3 = new Date().toISOString();
        const preHash3 = timestamp3 + method + savingsEndpoint + '';
        const signature3 = await hmacSha256Base64(apiSecret, preHash3);

        const savingsResponse = await axios.get(`${baseUrl}${savingsEndpoint}`, {
            headers: {
                'OK-ACCESS-KEY': apiKey,
                'OK-ACCESS-SIGN': signature3,
                'OK-ACCESS-TIMESTAMP': timestamp3,
                'OK-ACCESS-PASSPHRASE': passphrase,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (savingsResponse.data.code === '0') {
            const positions = savingsResponse.data.data || [];
            for (const pos of positions) {
                const amt = parseFloat(pos.amt) || 0;
                const ccy = pos.ccy;
                if (amt > 0) {
                    if (ccy === 'USDT' || ccy === 'USDC' || ccy === 'USD') {
                        savingsBalance += amt;
                    } else {
                        try {
                            const price = await getOkxPrice(ccy);
                            savingsBalance += amt * price;
                        } catch {
                            // Skip assets without price
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.warn('OKX savings account error:', err.message);
    }

    const totalUsd = tradingBalance + fundingBalance + savingsBalance;

    return {
        balance: totalUsd,
        breakdown: {
            trading: tradingBalance,
            funding: fundingBalance,
            savings: savingsBalance
        },
        status: 'success'
    };
}

// Helper to get OKX coin price
async function getOkxPrice(ccy) {
    try {
        const response = await axios.get(`${OKX_API}/api/v5/market/ticker?instId=${ccy}-USDT`);
        if (response.data.code === '0' && response.data.data.length > 0) {
            return parseFloat(response.data.data[0].last) || 0;
        }
        return 0;
    } catch {
        return 0;
    }
}

// ============ BYBIT ============
// Endpoint: GET /v5/account/wallet-balance
// Auth: HMAC-SHA256

export async function getBybitBalance(apiKey, apiSecret) {
    const baseUrl = 'https://api.bybit.com';
    const recvWindow = '5000';

    let totalUsd = 0;
    let unifiedBal = 0;
    let fundingBal = 0;
    let earnBal = 0;

    // 1. Get Unified Balance
    try {
        const qsUnified = 'accountType=UNIFIED';
        const ts1 = Date.now().toString();
        const preSign1 = ts1 + apiKey + recvWindow + qsUnified;
        const sig1 = await hmacSha256Hex(apiSecret, preSign1);

        const resUnified = await axios.get(`${baseUrl}/v5/account/wallet-balance?${qsUnified}`, {
            headers: {
                'X-BAPI-API-KEY': apiKey,
                'X-BAPI-SIGN': sig1,
                'X-BAPI-TIMESTAMP': ts1,
                'X-BAPI-RECV-WINDOW': recvWindow
            },
            timeout: 10000
        });

        if (resUnified.data.retCode === 0) {
            const list = resUnified.data.result?.list || [];
            for (const account of list) {
                totalUsd += parseFloat(account.totalEquity) || 0;
                unifiedBal += parseFloat(account.totalEquity) || 0;
            }
        }
    } catch (e) {
        console.warn('Bybit Unified fetch failed:', e.message);
    }

    // 2. Get Funding Balance (stablecoins only)
    try {
        const qsFund = 'accountType=FUND';
        const ts2 = Date.now().toString();
        const preSign2 = ts2 + apiKey + recvWindow + qsFund;
        const sig2 = await hmacSha256Hex(apiSecret, preSign2);

        const resFund = await axios.get(`${baseUrl}/v5/asset/transfer/query-account-coins-balance?${qsFund}`, {
            headers: {
                'X-BAPI-API-KEY': apiKey,
                'X-BAPI-SIGN': sig2,
                'X-BAPI-TIMESTAMP': ts2,
                'X-BAPI-RECV-WINDOW': recvWindow
            },
            timeout: 10000
        });

        if (resFund.data.retCode === 0) {
            const balances = resFund.data.result?.balance || [];
            for (const b of balances) {
                const coin = b.coin;
                const bal = parseFloat(b.walletBalance) || 0;
                if (bal > 0 && ['USDT', 'USDC', 'USD', 'DAI', 'FDUSD'].includes(coin)) {
                    fundingBal += bal;
                    totalUsd += bal;
                }
            }
        }
    } catch (e) {
        console.warn('Bybit Funding fetch failed:', e.message);
    }

    // 3. Get Earn Balance (Flexible Savings)
    try {
        const qsEarn = 'category=FlexibleSaving';
        const ts3 = Date.now().toString();
        const preSign3 = ts3 + apiKey + recvWindow + qsEarn;
        const sig3 = await hmacSha256Hex(apiSecret, preSign3);

        const resEarn = await axios.get(`${baseUrl}/v5/earn/position?${qsEarn}`, {
            headers: {
                'X-BAPI-API-KEY': apiKey,
                'X-BAPI-SIGN': sig3,
                'X-BAPI-TIMESTAMP': ts3,
                'X-BAPI-RECV-WINDOW': recvWindow
            },
            timeout: 10000
        });

        if (resEarn.data.retCode === 0) {
            const positions = resEarn.data.result?.list || [];
            for (const pos of positions) {
                const coin = pos.coin;
                const amount = parseFloat(pos.amount) || 0;
                // For stablecoins, count 1:1 as USD
                if (amount > 0 && ['USDT', 'USDC', 'USD', 'DAI', 'FDUSD'].includes(coin)) {
                    earnBal += amount;
                    totalUsd += amount;
                }
            }
        }
    } catch (e) {
        console.warn('Bybit Earn fetch failed:', e.message);
    }

    return {
        balance: totalUsd,
        breakdown: {
            unified: unifiedBal,
            funding: fundingBal,
            earn: earnBal
        },
        status: 'success'
    };
}

// ============ BITGET ============
// Spot Account: GET /api/v2/spot/account/assets
// Funding Account: GET /api/v2/spot/account/transferRecords (alternative: /api/v2/spot/wallet/transfer-coin-list)
// Auth: HMAC-SHA256 base64 + passphrase

export async function getBitgetBalance(apiKey, apiSecret, passphrase) {
    const baseUrl = BITGET_API;
    const method = 'GET';

    let spotBalance = 0;
    let earnBalance = 0;

    // 1. Get Spot Account Balance
    try {
        const timestamp1 = Date.now().toString();
        const spotEndpoint = '/api/v2/spot/account/assets';
        const preHash1 = timestamp1 + method + spotEndpoint + '';
        const signature1 = await hmacSha256Base64(apiSecret, preHash1);

        const spotResponse = await axios.get(`${baseUrl}${spotEndpoint}`, {
            headers: {
                'ACCESS-KEY': apiKey,
                'ACCESS-SIGN': signature1,
                'ACCESS-TIMESTAMP': timestamp1,
                'ACCESS-PASSPHRASE': passphrase,
                'Content-Type': 'application/json',
                'locale': 'en-US'
            },
            timeout: 10000
        });

        if (spotResponse.data.code === '00000') {
            const assets = spotResponse.data.data || [];
            for (const asset of assets) {
                const available = parseFloat(asset.available) || 0;
                const frozen = parseFloat(asset.frozen) || 0;
                const total = available + frozen;

                if (total > 0) {
                    const coin = asset.coin || asset.coinName;
                    if (coin === 'USDT' || coin === 'USDC') {
                        spotBalance += total;
                    } else {
                        try {
                            const price = await getBitgetPrice(coin);
                            spotBalance += total * price;
                        } catch {
                            // Skip assets without price
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.warn('Bitget spot account error:', err.message);
    }

    // 2. Get Earn/Savings Balance
    try {
        const timestamp2 = Date.now().toString();
        const earnEndpoint = '/api/v2/earn/savings/account';
        const preHash2 = timestamp2 + method + earnEndpoint + '';
        const signature2 = await hmacSha256Base64(apiSecret, preHash2);

        const earnResponse = await axios.get(`${baseUrl}${earnEndpoint}`, {
            headers: {
                'ACCESS-KEY': apiKey,
                'ACCESS-SIGN': signature2,
                'ACCESS-TIMESTAMP': timestamp2,
                'ACCESS-PASSPHRASE': passphrase,
                'Content-Type': 'application/json',
                'locale': 'en-US'
            },
            timeout: 10000
        });

        if (earnResponse.data.code === '00000') {
            const data = earnResponse.data.data || {};
            // usdtAmount is the total USD equivalent of ALL savings assets (already includes BTC value)
            // btcAmount is just the BTC equivalent representation, not additional holdings
            const usdtAmount = parseFloat(data.usdtAmount) || 0;
            earnBalance = usdtAmount;
        }
    } catch (err) {
        console.warn('Bitget earn account error:', err.message);
    }

    const totalUsd = spotBalance + earnBalance;

    return {
        balance: totalUsd,
        breakdown: {
            spot: spotBalance,
            earn: earnBalance
        },
        status: 'success'
    };
}

async function getBitgetPrice(coin) {
    try {
        const response = await axios.get(`https://api.bitget.com/api/v2/spot/market/tickers?symbol=${coin}USDT`);
        const data = response.data.data || [];
        if (data.length > 0) {
            return parseFloat(data[0].lastPr) || 0;
        }
        return 0;
    } catch {
        return 0;
    }
}

// ============ BACKPACK ============
// Endpoint: GET /api/v1/capital/collateral (unified margin account)
// Auth: ED25519 signature (different from other CEXs!)
// Instruction: collateralQuery
// Returns: assetsValue, netEquity (more accurate for unified margin)

export async function getBackpackBalance(apiKey, apiSecret) {
    const baseUrl = 'https://api.backpack.exchange';
    const endpoint = '/api/v1/capital/collateral';
    const timestamp = Date.now().toString();
    const window = '5000';

    // Build signing string: instruction + timestamp + window
    const signingString = `instruction=collateralQuery&timestamp=${timestamp}&window=${window}`;

    try {
        // Sign with ED25519
        const signature = await ed25519Sign(apiSecret, signingString);

        const response = await axios.get(`${baseUrl}${endpoint}`, {
            headers: {
                'X-API-Key': apiKey,
                'X-Signature': signature,
                'X-Timestamp': timestamp,
                'X-Window': window,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        // Response format:
        // {
        //   assetsValue: "1923.76",     // Total assets value
        //   netEquity: "1896.68",       // Net equity after liabilities
        //   netEquityAvailable: "...",  // Available for trading
        //   pnlUnrealized: "...",       // Unrealized PnL
        //   ...
        // }

        const data = response.data || {};

        // Use netEquity for accurate portfolio value (includes unrealized PnL)
        // Fall back to assetsValue if netEquity is not available
        const totalUsd = parseFloat(data.netEquity) || parseFloat(data.assetsValue) || 0;

        return { balance: totalUsd, status: 'success' };
    } catch (error) {
        console.error('Backpack API error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || error.message);
    }
}

async function getBackpackPrice(symbol) {
    try {
        const response = await axios.get(`https://api.backpack.exchange/api/v1/ticker?symbol=${symbol}`);
        return parseFloat(response.data?.lastPrice) || 0;
    } catch {
        return 0;
    }
}

// ============ UNIFIED INTERFACE ============

export async function getCexBalance(cexName, apiKey, apiSecret, passphrase = '') {
    const cexNameLower = cexName.toLowerCase();

    switch (cexNameLower) {
        case 'binance':
            return await getBinanceBalance(apiKey, apiSecret);
        case 'okx':
            return await getOkxBalance(apiKey, apiSecret, passphrase);
        case 'bybit':
            return await getBybitBalance(apiKey, apiSecret);
        case 'bitget':
            return await getBitgetBalance(apiKey, apiSecret, passphrase);
        case 'backpack':
            return await getBackpackBalance(apiKey, apiSecret);
        default:
            throw new Error(`Unsupported CEX: ${cexName}`);
    }
}

// ============ TEST API FUNCTION ============

/**
 * Test CEX API connection and return detailed account breakdown
 * @param {string} cexName - Exchange name (binance, okx, bybit, bitget, backpack)
 * @param {string} apiKey - API key
 * @param {string} apiSecret - API secret
 * @param {string} passphrase - Passphrase (for OKX/Bitget)
 * @returns {Promise<{success: boolean, balance?: number, breakdown?: Object, error?: string}>}
 */
export async function testCexApi(cexName, apiKey, apiSecret, passphrase = '') {
    const cexNameLower = cexName.toLowerCase();

    try {
        let result;
        let breakdown = {};

        switch (cexNameLower) {
            case 'binance':
                result = await getBinanceBalance(apiKey, apiSecret);
                breakdown = { 'Trading': result.balance };
                break;
            case 'okx':
                result = await getOkxBalance(apiKey, apiSecret, passphrase);
                breakdown = {
                    'Trading': result.breakdown?.trading || result.balance,
                    'Funding': result.breakdown?.funding || 0,
                    'Savings': result.breakdown?.savings || 0
                };
                break;
            case 'bybit':
                result = await getBybitBalance(apiKey, apiSecret);
                breakdown = {
                    'Unified': result.breakdown?.unified || result.balance,
                    'Funding': result.breakdown?.funding || 0,
                    'Earn': result.breakdown?.earn || 0
                };
                break;
            case 'bitget':
                result = await getBitgetBalance(apiKey, apiSecret, passphrase);
                breakdown = {
                    'Spot': result.breakdown?.spot || result.balance,
                    'Earn': result.breakdown?.earn || 0
                };
                break;
            case 'backpack':
                result = await getBackpackBalance(apiKey, apiSecret);
                breakdown = { 'Collateral': result.balance };
                break;
            default:
                throw new Error(`Unsupported CEX: ${cexName}`);
        }

        return {
            success: true,
            balance: result.balance,
            breakdown: breakdown,
            status: result.status
        };
    } catch (error) {
        console.error(`Test ${cexName} API failed:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

export default {
    getCexBalance,
    testCexApi,
    getBinanceBalance,
    getOkxBalance,
    getBybitBalance,
    getBitgetBalance,
    getBackpackBalance
};

