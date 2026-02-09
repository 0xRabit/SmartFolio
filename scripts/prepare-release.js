#!/usr/bin/env node
/**
 * Prepare release package for Chrome Web Store
 * - Removes 'key' field from manifest.json
 * - Creates a clean production build
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '../dist');
const MANIFEST_PATH = path.join(DIST_DIR, 'manifest.json');

console.log('🚀 Preparing release package...\n');

// Check if dist directory exists
if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ Error: dist directory not found. Please run "npm run build" first.');
    process.exit(1);
}

// Check if manifest.json exists
if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('❌ Error: manifest.json not found in dist directory.');
    process.exit(1);
}

try {
    // Read manifest.json
    const manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const manifest = JSON.parse(manifestContent);

    // Check if 'key' field exists
    if (!manifest.key) {
        console.log('✅ No "key" field found in manifest.json - already clean for release.');
        process.exit(0);
    }

    console.log('🔑 Found "key" field in manifest.json');
    console.log('   Removing for Chrome Web Store compliance...\n');

    // Remove 'key' field
    delete manifest.key;

    // Write back to manifest.json
    fs.writeFileSync(
        MANIFEST_PATH,
        JSON.stringify(manifest, null, 4) + '\n',
        'utf8'
    );

    console.log('✅ Successfully removed "key" field from dist/manifest.json\n');
    console.log('📦 Your release package is ready in the dist/ directory');
    console.log('   You can now zip and upload to Chrome Web Store.\n');

} catch (error) {
    console.error('❌ Error processing manifest.json:', error.message);
    process.exit(1);
}
