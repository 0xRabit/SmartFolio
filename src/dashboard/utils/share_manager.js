// share_manager.js - Social Share Feature Manager
// Handles all share functionality: modal, screenshot capture, text generation, and platform sharing

import { generateShareText, formatForPlatform } from './share_text_generator.js';
import { capturePortfolioScreenshot, downloadImage, blobToDataURL } from './screenshot_util.js';

// State
let currentShareBlob = null;
let currentShareMode = 'compact';
let currentLang = 'zh';

/**
 * Initialize share functionality
 * @param {String} language - Current language ('zh' or 'en')
 */
export function initShareUI(language = 'zh') {
    currentLang = language;

    // Share button click - Open modal and generate preview
    const btnShare = document.getElementById('btn-share');
    if (btnShare) {
        btnShare.addEventListener('click', async () => {
            try {
                // Check if on Settings page, switch to Dashboard first
                const currentTab = window.getCurrentActiveTab();
                if (currentTab === 'settings') {
                    window.switchTab('dashboard');
                    // Small delay to let tab switch complete
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                await handleShareClick();
            } catch (error) {
                console.error('Share failed:', error);
                alert('Failed to generate share preview. Please try again.');
            }
        });
    }

    // Close modal
    const closeShareModal = document.getElementById('close-share-modal');
    if (closeShareModal) {
        closeShareModal.addEventListener('click', () => {
            document.getElementById('share-modal').classList.add('hidden');
        });
    }

    // Mode toggle buttons
    initModeToggle();

    // Copy text button
    initCopyButton();

    // Platform share buttons
    initPlatformButtons();
}

/**
 * Handle share button click - generate screenshot and text
 */
async function handleShareClick() {
    const shareModal = document.getElementById('share-modal');
    const shareCanvas = document.getElementById('share-canvas');
    const shareTextarea = document.getElementById('share-text');

    // Show modal with loading state
    shareModal.classList.remove('hidden');
    shareTextarea.value = 'Generating...';

    try {
        // Get current wallets and history
        const data = await chrome.storage.local.get(['wallets', 'history']);
        const wallets = data.wallets || [];
        const history = data.history || [];

        // Generate share text
        const { text, hashtags } = generateShareText(wallets, history, currentLang);
        const formattedText = formatForPlatform(text, hashtags, 'twitter');
        shareTextarea.value = formattedText;

        // Capture screenshot
        currentShareBlob = await capturePortfolioScreenshot(currentShareMode);

        // Display canvas preview
        const dataUrl = await blobToDataURL(currentShareBlob);
        const img = new Image();
        img.onload = () => {
            shareCanvas.width = img.width;
            shareCanvas.height = img.height;
            const ctx = shareCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
        };
        img.src = dataUrl;

        // Auto-copy screenshot to clipboard
        await copyImageToClipboard(currentShareBlob);

    } catch (error) {
        shareTextarea.value = 'Failed to generate content. Please try again.';
        console.error('Share generation error:', error);
    }
}

/**
 * Copy image blob to clipboard
 * @param {Blob} blob - Image blob to copy
 */
async function copyImageToClipboard(blob) {
    const successMsg = document.getElementById('clipboard-success');

    try {
        if (navigator.clipboard && ClipboardItem) {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob
                })
            ]);
            console.log('Screenshot copied to clipboard');

            // Show success message
            if (successMsg) {
                successMsg.classList.remove('hidden');
                // Auto-hide after 3 seconds
                setTimeout(() => {
                    successMsg.classList.add('hidden');
                }, 3000);
            }
        } else {
            console.warn('Clipboard API not supported');
        }
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        // Hide success message if copy failed
        if (successMsg) {
            successMsg.classList.add('hidden');
        }
    }
}

/**
 * Initialize mode toggle buttons (Compact / Full)
 */
function initModeToggle() {
    const modeCompact = document.getElementById('mode-compact');
    const modeFull = document.getElementById('mode-full');

    if (modeCompact && modeFull) {
        modeCompact.addEventListener('click', async () => {
            currentShareMode = 'compact';
            modeCompact.classList.add('active', 'bg-purple-600', 'text-white');
            modeCompact.classList.remove('bg-gray-200', 'text-gray-700');
            modeFull.classList.remove('active', 'bg-purple-600', 'text-white');
            modeFull.classList.add('bg-gray-200', 'text-gray-700');
            await handleShareClick(); // Regenerate
        });

        modeFull.addEventListener('click', async () => {
            currentShareMode = 'full';
            modeFull.classList.add('active', 'bg-purple-600', 'text-white');
            modeFull.classList.remove('bg-gray-200', 'text-gray-700');
            modeCompact.classList.remove('active', 'bg-purple-600', 'text-white');
            modeCompact.classList.add('bg-gray-200', 'text-gray-700');
            await handleShareClick(); // Regenerate
        });
    }
}

/**
 * Initialize copy text button
 */
function initCopyButton() {
    const copyShareText = document.getElementById('copy-share-text');
    if (copyShareText) {
        copyShareText.addEventListener('click', () => {
            const shareTextarea = document.getElementById('share-text');
            shareTextarea.select();
            document.execCommand('copy');
            copyShareText.textContent = 'Copied!';
            setTimeout(() => {
                copyShareText.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy Text`;
            }, 2000);
        });
    }
}

/**
 * Initialize platform share buttons
 */
function initPlatformButtons() {
    const shareTwitter = document.getElementById('share-twitter');
    const shareFacebook = document.getElementById('share-facebook');
    const shareWhatsApp = document.getElementById('share-whatsapp');
    const shareDownload = document.getElementById('share-download');

    if (shareTwitter) {
        shareTwitter.addEventListener('click', () => {
            const text = document.getElementById('share-text').value;
            const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
        });
    }

    if (shareFacebook) {
        shareFacebook.addEventListener('click', () => {
            // Note: Facebook doesn't allow direct image sharing via URL
            alert('Please click "Download" first, then manually upload to Facebook.');
        });
    }

    if (shareWhatsApp) {
        shareWhatsApp.addEventListener('click', () => {
            const text = document.getElementById('share-text').value;
            const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
        });
    }

    if (shareDownload) {
        shareDownload.addEventListener('click', () => {
            if (currentShareBlob) {
                const filename = `smartfolio-portfolio-${new Date().toISOString().split('T')[0]}.png`;
                downloadImage(currentShareBlob, filename);
            } else {
                alert('No screenshot available. Please try again.');
            }
        });
    }
}

/**
 * Update language for share text generation
 * @param {String} lang - Language code ('zh' or 'en')
 */
export function updateShareLanguage(lang) {
    currentLang = lang;
}

export default {
    initShareUI,
    updateShareLanguage
};
