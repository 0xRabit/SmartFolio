// config.js - Centralized configuration for SmartFolio
// All API URLs, constants, and timeouts in one place

// ============ API Endpoints ============

// Price APIs
export const COINGECKO_API = 'https://api.coingecko.com/api/v3';
export const BITSTAMP_API = 'https://www.bitstamp.net/api/v2';

// Chain APIs
export const MEMPOOL_API = 'https://mempool.space/api';

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
