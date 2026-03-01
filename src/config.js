// config.js - Centralized configuration for SmartFolio
// All API URLs, constants, and timeouts in one place

// ============ API Endpoints ============

// Price APIs
export const COINGECKO_API = 'https://api.coingecko.com/api/v3';
export const BITSTAMP_API = 'https://www.bitstamp.net/api/v2';

// Chain APIs
export const MEMPOOL_API = 'https://mempool.space/api';
export const LITECOIN_SPACE_API = 'https://litecoinspace.org/api';
export const BLOCKCYPHER_DOGE_API = 'https://api.blockcypher.com/v1/doge/main';
export const TONCENTER_API = 'https://toncenter.com/api/v2';
export const SUI_RPC = 'https://fullnode.mainnet.sui.io:443';
export const APTOS_API = 'https://fullnode.mainnet.aptoslabs.com/v1';
export const AVAX_RPC = 'https://api.avax.network/ext/bc/C/rpc';
export const COSMOS_LCD = 'https://cosmos-rest.publicnode.com';
export const KOIOS_API = 'https://api.koios.rest/api/v1';

// CEX APIs
export const BINANCE_API = 'https://api.binance.com';
export const OKX_API = 'https://www.okx.com';
export const BYBIT_API = 'https://api.bybit.com';
export const BITGET_API = 'https://api.bitget.com';
export const BACKPACK_API = 'https://api.backpack.exchange';

// AI APIs
export const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
export const SILICONFLOW_API = 'https://api.siliconflow.cn/v1/chat/completions';

// Screenshot Sources
export const DEBANK_BASE_URL = 'https://debank.com/profile/';
export const JUP_BASE_URL = 'https://jup.ag/portfolio/';

// ============ Timeouts & Delays ============

export const DEFAULT_SCREENSHOT_DELAY = 3000;
export const API_TIMEOUT = 10000;
export const RPC_TIMEOUT = 5000;

// ============ UI Defaults ============

export const DEFAULT_LANGUAGE = 'en';
export const MAX_SCREENSHOTS_TO_SEND = 3;
export const MAX_TREND_ITEMS = 10;

// ============ Exports ============

export default {
    COINGECKO_API,
    BITSTAMP_API,
    MEMPOOL_API,
    LITECOIN_SPACE_API,
    BLOCKCYPHER_DOGE_API,
    TONCENTER_API,
    SUI_RPC,
    APTOS_API,
    AVAX_RPC,
    COSMOS_LCD,
    KOIOS_API,
    BINANCE_API,
    OKX_API,
    BYBIT_API,
    BITGET_API,
    BACKPACK_API,
    OPENROUTER_API,
    SILICONFLOW_API,
    DEBANK_BASE_URL,
    JUP_BASE_URL,
    DEFAULT_SCREENSHOT_DELAY,
    API_TIMEOUT,
    RPC_TIMEOUT,
    DEFAULT_LANGUAGE,
    MAX_SCREENSHOTS_TO_SEND,
    MAX_TREND_ITEMS
};
