// ocr_handler.js - OCR Processing Module
// Handles screenshot processing and Vision API calls for balance extraction

import { OPENROUTER_API, SILICONFLOW_API } from '../../config.js';

// OCR Prompts for different screenshot sources
const OCR_PROMPTS = {
    debank: "This is a screenshot of a DeBank crypto wallet dashboard. Look at the total balance shown (usually a large dollar amount like $10,532 in the top-right area). Extract ONLY the numeric balance value. Respond with JUST the number, no dollar sign, no commas. Example: if balance shows $10,532.45, respond with: 10532.45",
    jup: "This is a screenshot of Jup.ag Solana portfolio page. Look for the total portfolio value in USD (usually displayed prominently, like 'Net Worth' or total value). Extract ONLY the numeric balance value in USD. Respond with JUST the number, no dollar sign, no commas. Example: if balance shows $1,234.56, respond with: 1234.56"
};

/**
 * Process OCR for a screenshot
 * @param {string} base64 - Base64 encoded image
 * @param {string} address - Wallet address
 * @param {string} screenshotType - 'debank' or 'jup'
 * @param {Object} settings - User settings with API keys
 * @returns {Promise<{text: string, balance: number}>}
 */
export async function processOCR(base64, address, screenshotType = 'debank', settings = {}) {
    try {
        let imageForOCR = base64;

        // For DeBank: crop to top-right corner where balance is displayed
        // For Jup.ag: use full image as balance is more prominent
        if (screenshotType === 'debank') {
            imageForOCR = await cropTopRight(base64);
        }

        const aiProvider = settings.aiProvider || 'openrouter';
        let balance = 0;

        if (aiProvider === 'siliconflow') {
            if (!settings.siliconFlowApiKey) {
                throw new Error('SiliconFlow API Key not configured. Please add it in Settings.');
            }
            console.log("Calling SiliconFlow Vision API...");
            balance = await callSiliconFlowVision(settings.siliconFlowApiKey, imageForOCR, screenshotType);
        } else {
            if (!settings.openRouterApiKey) {
                throw new Error('OpenRouter API Key not configured. Please add it in Settings.');
            }
            console.log("Calling OpenRouter Vision API...");
            balance = await callOpenRouterVision(settings.openRouterApiKey, imageForOCR, screenshotType);
        }

        console.log("Vision API result for", address, ":", balance);
        return { text: '', balance: balance, croppedImage: imageForOCR };

    } catch (e) {
        console.error("OCR Error:", e);
        throw e;
    }
}

/**
 * Call OpenRouter Vision API
 */
async function callOpenRouterVision(apiKey, base64Image, screenshotType = 'debank') {
    const MODEL_NAME = 'google/gemini-2.0-flash-001';
    const promptText = OCR_PROMPTS[screenshotType] || OCR_PROMPTS.debank;

    const requestBody = {
        model: MODEL_NAME,
        messages: [{
            role: "user",
            content: [
                { type: "text", text: promptText },
                { type: "image_url", image_url: { url: base64Image } }
            ]
        }],
        temperature: 0.1,
        max_tokens: 50
    };

    const response = await fetch(OPENROUTER_API, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/vibecoding/portfolio_plugin',
            'X-Title': 'Portfolio Plugin'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenRouter API error: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || '';
    console.log("OpenRouter raw response:", text);

    return parseBalanceFromText(text);
}

/**
 * Call SiliconFlow Vision API
 */
async function callSiliconFlowVision(apiKey, base64Image, screenshotType = 'debank') {
    const MODEL_NAME = 'Qwen/Qwen2-VL-72B-Instruct';
    const promptText = OCR_PROMPTS[screenshotType] || OCR_PROMPTS.debank;

    const requestBody = {
        model: MODEL_NAME,
        messages: [{
            role: "user",
            content: [
                { type: "text", text: promptText },
                { type: "image_url", image_url: { url: base64Image } }
            ]
        }],
        temperature: 0.1,
        max_tokens: 50
    };

    const response = await fetch(SILICONFLOW_API, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`SiliconFlow API error: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || '';
    console.log("SiliconFlow raw response:", text);

    return parseBalanceFromText(text);
}

/**
 * Parse balance number from text
 */
function parseBalanceFromText(text) {
    const cleanedText = text.trim().replace(/[$,]/g, '');
    const balance = parseFloat(cleanedText);
    if (isNaN(balance)) {
        console.warn("Could not parse balance from response:", text);
        return 0;
    }
    return balance;
}

/**
 * Crop to top-right corner (where DeBank shows balance)
 */
export function cropTopRight(base64) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Crop box: right 50%, top 25% (like Python code)
            const w = img.width;
            const h = img.height;
            const cropLeft = Math.floor(w * 0.5);
            const cropTop = 0;
            const cropWidth = Math.floor(w * 0.5);
            const cropHeight = Math.floor(h * 0.25);

            canvas.width = cropWidth;
            canvas.height = cropHeight;

            ctx.drawImage(img,
                cropLeft, cropTop, cropWidth, cropHeight,
                0, 0, cropWidth, cropHeight
            );

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = base64;
    });
}

/**
 * Compress image to reduce storage size
 */
export function compressImage(base64, quality = 0.6, maxWidth = 1200) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
    });
}

export default { processOCR, cropTopRight, compressImage };
