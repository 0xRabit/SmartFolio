// screenshot_util.js - Screenshot Capture Utilities
// Captures Dashboard elements as images using html2canvas

import html2canvas from 'html2canvas';

/**
 * Capture portfolio screenshot
 * @param {String} mode - 'compact' (800x660) or 'full' (1200x1260)
 * @returns {Promise<Blob>} Screenshot image blob
 */
export async function capturePortfolioScreenshot(mode = 'compact') {
    try {
        if (mode === 'compact') {
            // Compact mode: Allocation card with header
            const allocationCard = document.querySelector('.lg\\:col-span-1.bg-white');
            if (!allocationCard) {
                throw new Error('Allocation card not found');
            }

            const contentCanvas = await html2canvas(allocationCard, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false,
                useCORS: true,
                allowTaint: true
            });

            // Create final canvas with header (60px header + 600px content)
            const headerHeight = 60;
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = 800;
            finalCanvas.height = 600 + headerHeight;
            const ctx = finalCanvas.getContext('2d');

            // Fill white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 800, 660);

            // Add header watermark at top
            addHeaderWatermark(finalCanvas, 'SmartFolio');

            // Scale and center content below header
            const contentArea = 600;
            const scale = Math.min(800 / contentCanvas.width, contentArea / contentCanvas.height);
            const scaledWidth = contentCanvas.width * scale;
            const scaledHeight = contentCanvas.height * scale;
            const x = (800 - scaledWidth) / 2;
            const y = headerHeight + (contentArea - scaledHeight) / 2;

            ctx.drawImage(contentCanvas, x, y, scaledWidth, scaledHeight);

            return canvasToBlob(finalCanvas);

        } else {
            // Full mode: All dashboard sections with header
            const tabDashboard = document.getElementById('tab-dashboard');
            if (!tabDashboard) {
                throw new Error('Dashboard tab not found');
            }

            // Capture sections
            const captures = [];

            const statsSection = tabDashboard.querySelector('.grid.grid-cols-1.lg\\:grid-cols-3.gap-6.mb-8');
            if (statsSection) {
                const canvas = await html2canvas(statsSection, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    logging: false,
                    useCORS: true,
                    allowTaint: true
                });
                captures.push({ canvas, marginTop: 0 });
            }

            const healthSection = document.getElementById('asset-health-section');
            if (healthSection) {
                const canvas = await html2canvas(healthSection, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    logging: false,
                    useCORS: true,
                    allowTaint: true
                });
                captures.push({ canvas, marginTop: 32 });
            }

            const trendsSection = tabDashboard.querySelector('.mt-8.grid.grid-cols-1.md\\:grid-cols-2.gap-6');
            if (trendsSection) {
                const canvas = await html2canvas(trendsSection, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    logging: false,
                    useCORS: true,
                    allowTaint: true
                });
                captures.push({ canvas, marginTop: 32 });
            }

            // Composite content canvas
            let contentHeight = 0;
            captures.forEach((c, i) => {
                contentHeight += c.canvas.height + (i > 0 ? c.marginTop * 2 : 0);
            });

            const contentCanvas = document.createElement('canvas');
            contentCanvas.width = 2400;
            contentCanvas.height = contentHeight;
            const contentCtx = contentCanvas.getContext('2d');
            contentCtx.fillStyle = '#f3f4f6';
            contentCtx.fillRect(0, 0, 2400, contentHeight);

            let currentY = 0;
            captures.forEach((c, i) => {
                if (i > 0) currentY += c.marginTop * 2;
                contentCtx.drawImage(c.canvas, 0, currentY);
                currentY += c.canvas.height;
            });

            // Create final with header (120px header @2x + content)
            const headerHeight = 120; // 60 * 2
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = 2400; // 1200 * 2
            finalCanvas.height = 2400;
            const ctx = finalCanvas.getContext('2d');

            ctx.fillStyle = '#f3f4f6';
            ctx.fillRect(0, 0, 2400, 2400);

            // Add header at top (draws at 2x scale)
            addHeaderWatermark(finalCanvas, 'SmartFolio');

            // Scale content to fit below header
            const contentAreaHeight = 2400 - headerHeight;
            const scale = Math.min(2400 / contentCanvas.width, contentAreaHeight / contentCanvas.height);
            const scaledWidth = contentCanvas.width * scale;
            const scaledHeight = contentCanvas.height * scale;
            const x = (2400 - scaledWidth) / 2;
            const y = headerHeight + (contentAreaHeight - scaledHeight) / 2;

            ctx.drawImage(contentCanvas, x, y, scaledWidth, scaledHeight);

            // Scale down to 1200x1200 for final output
            const outputCanvas = document.createElement('canvas');
            outputCanvas.width = 1200;
            outputCanvas.height = 1200;
            const outputCtx = outputCanvas.getContext('2d');
            outputCtx.drawImage(finalCanvas, 0, 0, 1200, 1200);

            return canvasToBlob(outputCanvas);
        }
    } catch (error) {
        console.error('Screenshot capture failed:', error);
        throw error;
    }
}

/**
 * Resize canvas to target dimensions
 * @param {HTMLCanvasElement} sourceCanvas - Source canvas
 * @param {Number} targetWidth - Target width
 * @param {Number} targetHeight - Target height
 * @returns {HTMLCanvasElement} Resized canvas
 */
function resizeCanvas(sourceCanvas, targetWidth, targetHeight) {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');

    const scaleX = targetWidth / sourceCanvas.width;
    const scaleY = targetHeight / sourceCanvas.height;
    const scale = Math.min(scaleX, scaleY);

    const scaledWidth = sourceCanvas.width * scale;
    const scaledHeight = sourceCanvas.height * scale;

    const x = (targetWidth - scaledWidth) / 2;
    const y = (targetHeight - scaledHeight) / 2;

    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    ctx.drawImage(sourceCanvas, x, y, scaledWidth, scaledHeight);

    return canvas;
}

/**
 * Add header watermark banner (logo + SmartFolio + slogan)
 * @param {HTMLCanvasElement} canvas - Canvas to add header
 * @param {String} text - Product name
 */
function addHeaderWatermark(canvas, text = 'SmartFolio') {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;

    // Detect scale based on canvas width
    const scale = width >= 1600 ? 2 : 1;

    const headerHeight = 60 * scale;
    const padding = 16 * scale;
    const logoSize = 32 * scale;

    ctx.save();

    // White header background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, headerHeight);

    // Bottom border
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(width, headerHeight);
    ctx.stroke();

    let currentX = padding;

    // Draw logo
    const logoImg = document.querySelector('img[src*="icon"]');
    if (logoImg) {
        try {
            ctx.drawImage(logoImg, currentX, (headerHeight - logoSize) / 2, logoSize, logoSize);
            currentX += logoSize + (12 * scale);
        } catch (error) {
            console.warn('Logo not found:', error);
        }
    }

    // Draw "SmartFolio"
    ctx.font = `bold ${24 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = '#1f2937';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, currentX, headerHeight / 2);

    const nameWidth = ctx.measureText(text).width;
    currentX += nameWidth + (12 * scale);

    // Draw slogan with gradient
    const slogan = 'PRIVATE · UNIFIED · SMART';
    ctx.font = `bold ${11 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

    const gradient = ctx.createLinearGradient(currentX, 0, currentX + (200 * scale), 0);
    gradient.addColorStop(0, '#10b981');
    gradient.addColorStop(1, '#2563eb');

    ctx.fillStyle = gradient;
    ctx.fillText(slogan, currentX, headerHeight / 2);

    ctx.restore();
}

/**
 * Legacy watermark function - kept for compatibility
 * @param {HTMLCanvasElement} canvas - Canvas to add watermark
 * @param {String} text - Watermark text
 */
export function addWatermark(canvas, text = 'SmartFolio') {
    // Now redirects to header watermark
    addHeaderWatermark(canvas, text);
}

/**
 * Convert canvas to blob
 * @param {HTMLCanvasElement} canvas - Canvas to convert
 * @returns {Promise<Blob>} Image blob
 */
function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Failed to create blob'));
            }
        }, 'image/png');
    });
}

/**
 * Download image blob as file
 * @param {Blob} blob - Image blob
 * @param {String} filename - Download filename
 */
export function downloadImage(blob, filename = 'smartfolio-portfolio.png') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Convert blob to data URL
 * @param {Blob} blob - Image blob
 * @returns {Promise<String>} Data URL
 */
export function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export default {
    capturePortfolioScreenshot,
    addWatermark,
    downloadImage,
    blobToDataURL
};
