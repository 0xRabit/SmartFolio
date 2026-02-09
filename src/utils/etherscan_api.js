// etherscan_api.js - Etherscan API V2 for EVM balance
import axios from 'axios';

// Etherscan V2 API (supports multiple chains with chainid parameter)
const ETHERSCAN_API = "https://api.etherscan.io/v2/api";
const COINGECKO_API = "https://api.coingecko.com/api/v3";

/**
 * Get ETH balance in USD for an address via Etherscan API
 * @param {string} address - Ethereum address
 * @param {string} apiKey - Etherscan API key
 * @returns {Promise<number>} Balance in USD
 */
export async function getEtherscanBalance(address, apiKey) {
    if (!apiKey) {
        throw new Error("Etherscan API key is required");
    }

    try {
        // Etherscan V2 API with chainid=1 for Ethereum mainnet
        const balanceUrl = `${ETHERSCAN_API}?chainid=1&module=account&action=balance&address=${address}&tag=latest&apikey=${apiKey}`;
        const balanceResponse = await axios.get(balanceUrl, { timeout: 10000 });

        if (balanceResponse.data.status !== "1") {
            throw new Error(`Etherscan API Error: ${balanceResponse.data.message || 'Unknown error'}`);
        }

        const weiBalance = balanceResponse.data.result;
        const ethBalance = parseFloat(weiBalance) / 1e18; // Wei to ETH

        // 2. Get ETH Price from CoinGecko
        const priceUrl = `${COINGECKO_API}/simple/price?ids=ethereum&vs_currencies=usd`;
        const priceResponse = await axios.get(priceUrl, { timeout: 5000 });
        const ethPrice = priceResponse.data.ethereum?.usd || 0;

        const usdBalance = ethBalance * ethPrice;
        console.log(`Etherscan: ${address.slice(0, 10)}... = ${ethBalance.toFixed(4)} ETH ($${usdBalance.toFixed(2)})`);

        return usdBalance;

    } catch (error) {
        console.error("Etherscan API Error:", error.message);
        throw error;
    }
}

/**
 * Get multiple token balances (optional - for future use)
 * @param {string} address - Ethereum address
 * @param {string} apiKey - Etherscan API key
 * @returns {Promise<Array>} Array of token balances
 */
export async function getEtherscanTokenBalances(address, apiKey) {
    if (!apiKey) {
        throw new Error("Etherscan API key is required");
    }

    try {
        const url = `${ETHERSCAN_API}?module=account&action=tokentx&address=${address}&page=1&offset=100&sort=desc&apikey=${apiKey}`;
        const response = await axios.get(url, { timeout: 10000 });

        if (response.data.status !== "1") {
            return []; // No tokens or error
        }

        // Get unique tokens
        const tokens = new Map();
        response.data.result.forEach(tx => {
            if (!tokens.has(tx.contractAddress)) {
                tokens.set(tx.contractAddress, {
                    symbol: tx.tokenSymbol,
                    name: tx.tokenName,
                    decimals: parseInt(tx.tokenDecimal)
                });
            }
        });

        return Array.from(tokens.values());

    } catch (error) {
        console.error("Etherscan Token API Error:", error.message);
        return [];
    }
}
