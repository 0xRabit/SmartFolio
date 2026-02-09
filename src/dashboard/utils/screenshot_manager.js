// screenshot_manager.js - Screenshot Gallery and OCR Module
// Handles screenshot preview, gallery, OCR processing wrapper, and image compression

import { t, getLanguage } from './i18n.js';
import { processOCR, compressImage } from './ocr_handler.js';
import { loadSettingsFromStorage } from './settings_manager.js';

// Current language reference
let currentLang = getLanguage();

/**
 * Get local date string in YYYY-MM-DD format
 */
function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Show screenshot preview panel
 */
export function showScreenshotPreview(base64, address) {
    const panel = document.getElementById('screenshot-panel');
    const img = document.getElementById('screenshot-preview');
    const addrLabel = document.getElementById('screenshot-address');
    const status = document.getElementById('screenshot-status');

    if (panel && img) {
        panel.classList.remove('hidden');
        img.src = base64;
        addrLabel.textContent = `Address: ${address}`;
        status.textContent = 'Processing OCR...';
    }
}

/**
 * Update screenshot status text
 */
export function updateScreenshotStatus(text) {
    const status = document.getElementById('screenshot-status');
    if (status) status.textContent = text;
}

/**
 * Process OCR with UI updates
 */
export async function processOCRWithUI(base64, address, screenshotType = 'debank') {
    try {
        // Load settings with proper decryption
        const { settings } = await loadSettingsFromStorage();
        console.log('🔓 OCR using decrypted settings, API keys available:', {
            openRouter: !!settings.openRouterApiKey
        });

        // Call module version of processOCR
        const result = await processOCR(base64, address, screenshotType, settings);

        // Show cropped preview if available
        if (screenshotType === 'debank' && result.croppedImage) {
            const croppedImg = document.getElementById('screenshot-cropped');
            if (croppedImg) croppedImg.src = result.croppedImage;
        }

        // Save both images to gallery
        const imageForOCR = result.croppedImage || base64;
        await saveScreenshot(base64, imageForOCR, address);

        return { text: '', balance: result.balance };

    } catch (e) {
        console.error("OCR Error:", e);
        throw e;
    }
}

/**
 * Save screenshot to gallery storage
 */
export async function saveScreenshot(fullBase64, croppedBase64, address) {
    const data = await chrome.storage.local.get(['screenshots']);
    const screenshots = data.screenshots || [];

    // Compress images before saving (quality 0.6, max 1200px width)
    const compressedFull = await compressImage(fullBase64, 0.6, 1200);
    const compressedCropped = await compressImage(croppedBase64, 0.7, 600);

    screenshots.push({
        address: address,
        full: compressedFull,
        cropped: compressedCropped,
        timestamp: Date.now()
    });

    // Keep only last 10 screenshots to avoid storage limits
    while (screenshots.length > 10) {
        screenshots.shift();
    }

    await chrome.storage.local.set({ screenshots });
    await loadScreenshotGallery();
}

/**
 * Load and render screenshot gallery
 */
export async function loadScreenshotGallery() {
    currentLang = getLanguage();
    const data = await chrome.storage.local.get(['screenshots']);
    const screenshots = data.screenshots || [];
    const gallery = document.getElementById('gallery-grid');

    if (!gallery) return;

    if (screenshots.length === 0) {
        gallery.innerHTML = `<p class="text-sm text-gray-400 col-span-full">${t('noScreenshots')}</p>`;
        return;
    }

    // Group screenshots by date
    const groupedByDate = {};
    screenshots.forEach((s, originalIndex) => {
        const date = new Date(s.timestamp);
        const dateKey = date.toLocaleDateString(currentLang === 'cn' ? 'zh-CN' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push({ ...s, originalIndex });
    });

    // Build HTML with date groups (newest first)
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
        const dateA = groupedByDate[a][0].timestamp;
        const dateB = groupedByDate[b][0].timestamp;
        return dateB - dateA; // Descending
    });

    let html = '';
    sortedDates.forEach(dateKey => {
        const items = groupedByDate[dateKey];
        html += `
            <div class="col-span-full">
                <h4 class="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                    <span class="bg-gray-100 px-2 py-0.5 rounded text-xs">${dateKey}</span>
                    <span class="text-gray-400 text-xs">(${items.length} ${currentLang === 'cn' ? '张' : 'images'})</span>
                </h4>
            </div>
        `;
        items.forEach(s => {
            const time = new Date(s.timestamp).toLocaleTimeString(currentLang === 'cn' ? 'zh-CN' : 'en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
            html += `
                <div class="relative group cursor-pointer" onclick="showFullScreenshot(${s.originalIndex})">
                    <img src="${s.full}" alt="${s.address}" class="w-full h-32 object-cover rounded-lg border border-gray-200">
                    <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition rounded-lg"></div>
                    <div class="mt-1">
                        <p class="text-xs text-gray-500 truncate">${s.address ? s.address.substring(0, 10) + '...' : 'Unknown'}</p>
                        <p class="text-xs text-gray-400">${time}</p>
                    </div>
                </div>
            `;
        });
    });

    gallery.innerHTML = html;
}

/**
 * Clear today's screenshots from gallery
 */
export async function clearScreenshotGallery() {
    const data = await chrome.storage.local.get(['screenshots']);
    const screenshots = data.screenshots || [];

    const today = getLocalDateString();
    const filteredScreenshots = screenshots.filter(s => {
        const screenshotDate = getLocalDateString(new Date(s.timestamp));
        return screenshotDate !== today;
    });

    await chrome.storage.local.set({ screenshots: filteredScreenshots });
    await loadScreenshotGallery();
    console.log(`Cleared today's screenshots. Kept ${filteredScreenshots.length} historical screenshots.`);
}

/**
 * Show full screenshot in preview panel
 */
export async function showFullScreenshot(index) {
    const data = await chrome.storage.local.get(['screenshots']);
    const screenshots = data.screenshots || [];
    if (screenshots[index]) {
        const panel = document.getElementById('screenshot-panel');
        const fullImg = document.getElementById('screenshot-preview');
        const croppedImg = document.getElementById('screenshot-cropped');
        const addrLabel = document.getElementById('screenshot-address');

        if (panel && fullImg) {
            panel.classList.remove('hidden');
            fullImg.src = screenshots[index].full;
            croppedImg.src = screenshots[index].cropped;
            addrLabel.textContent = `Address: ${screenshots[index].address || 'Unknown'}`;
        }
    }
}

/**
 * Initialize screenshot UI event listeners
 */
export function initScreenshotUI() {
    const btnClear = document.getElementById('btn-clear-screenshots');
    if (btnClear) {
        btnClear.addEventListener('click', clearScreenshotGallery);
    }
}

// Expose globally for legacy compatibility (inline onclick handlers)
window.showFullScreenshot = showFullScreenshot;

export default {
    initScreenshotUI,
    showScreenshotPreview,
    updateScreenshotStatus,
    processOCRWithUI,
    saveScreenshot,
    loadScreenshotGallery,
    clearScreenshotGallery,
    showFullScreenshot
};
