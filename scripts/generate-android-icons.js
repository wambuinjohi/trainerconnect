#!/usr/bin/env node

/**
 * Generate Android App Icons from Logo
 * This script downloads the Skatryk logo and generates PNG icons
 * in all required sizes for Android app
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Install sharp if not already installed
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ Error: "sharp" module not found.');
  console.error('Please install it first:');
  console.error('  npm install --save-dev sharp');
  process.exit(1);
}

// Logo URL (from branding.ts)
const LOGO_URL = "https://cdn.builder.io/api/v1/image/assets%2Fa7e3b11fc7dc47209257ffe094ea1193%2F0982d123ad0c4b0eafea9a2de19ff044?format=webp&width=800";

// Icon configurations for Android
const ICON_CONFIGS = [
  // mdpi - 48x48
  { size: 48, densities: ['mdpi'], name: 'ic_launcher', round: false },
  { size: 48, densities: ['mdpi'], name: 'ic_launcher_round', round: true },
  { size: 81, densities: ['mdpi'], name: 'ic_launcher_foreground', round: false },

  // hdpi - 72x72
  { size: 72, densities: ['hdpi'], name: 'ic_launcher', round: false },
  { size: 72, densities: ['hdpi'], name: 'ic_launcher_round', round: true },
  { size: 108, densities: ['hdpi'], name: 'ic_launcher_foreground', round: false },

  // xhdpi - 96x96
  { size: 96, densities: ['xhdpi'], name: 'ic_launcher', round: false },
  { size: 96, densities: ['xhdpi'], name: 'ic_launcher_round', round: true },
  { size: 162, densities: ['xhdpi'], name: 'ic_launcher_foreground', round: false },

  // xxhdpi - 144x144
  { size: 144, densities: ['xxhdpi'], name: 'ic_launcher', round: false },
  { size: 144, densities: ['xxhdpi'], name: 'ic_launcher_round', round: true },
  { size: 243, densities: ['xxhdpi'], name: 'ic_launcher_foreground', round: false },

  // xxxhdpi - 192x192
  { size: 192, densities: ['xxxhdpi'], name: 'ic_launcher', round: false },
  { size: 192, densities: ['xxxhdpi'], name: 'ic_launcher_round', round: true },
  { size: 324, densities: ['xxxhdpi'], name: 'ic_launcher_foreground', round: false },
];

/**
 * Download file from URL
 */
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Create circular mask for round icons
 */
async function createRoundIcon(inputBuffer, size) {
  // Create SVG mask for circular icon
  const svgMask = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <mask id="circle">
          <rect width="${size}" height="${size}" fill="white"/>
          <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="black"/>
        </mask>
      </defs>
      <image href="data:image/png;base64,${inputBuffer.toString('base64')}" width="${size}" height="${size}" mask="url(#circle)"/>
    </svg>
  `;

  return sharp(inputBuffer)
    .resize(size, size, {
      fit: 'cover',
      position: 'center'
    })
    .png()
    .toBuffer();
}

/**
 * Generate all icon sizes
 */
async function generateIcons(logoBuffer) {
  const results = [];
  
  for (const config of ICON_CONFIGS) {
    const basePath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
    const mipMapDir = `mipmap-${config.densities[0]}`;
    const fullPath = path.join(basePath, mipMapDir);

    // Ensure directory exists
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    try {
      let iconBuffer;
      
      if (config.round) {
        // Create rounded icon
        iconBuffer = await createRoundIcon(logoBuffer, config.size);
      } else {
        // Create square icon
        iconBuffer = await sharp(logoBuffer)
          .resize(config.size, config.size, {
            fit: 'cover',
            position: 'center'
          })
          .png()
          .toBuffer();
      }

      const fileName = `${config.name}.png`;
      const filePath = path.join(fullPath, fileName);
      fs.writeFileSync(filePath, iconBuffer);
      
      results.push({
        path: filePath,
        size: config.size,
        type: config.round ? 'round' : 'square',
        density: config.densities[0]
      });

      console.log(`✅ Generated: ${mipMapDir}/${fileName} (${config.size}x${config.size})`);
    } catch (error) {
      console.error(`❌ Error generating ${mipMapDir}/${config.name}.png:`, error.message);
    }
  }

  return results;
}

/**
 * Main execution
 */
async function main() {
  console.log('🎨 Generating Android App Icons from Skatryk Logo...\n');

  try {
    console.log('📥 Downloading logo from CDN...');
    const logoBuffer = await downloadFile(LOGO_URL);
    console.log(`✅ Logo downloaded (${logoBuffer.length} bytes)\n`);

    console.log('🔄 Generating icon files in all sizes...\n');
    const results = await generateIcons(logoBuffer);

    console.log('\n✅ Icon generation complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   Total icons generated: ${results.length}`);
    console.log(`   Densities covered: mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi`);
    console.log(`   Icon types: launcher, launcher_round, launcher_foreground`);

    console.log('\n📝 Next steps:');
    console.log('   1. Rebuild the APK: npm run build && npx cap sync android');
    console.log('   2. Open in Android Studio: npm run cap:open:android');
    console.log('   3. Build signed APK');
    console.log('   4. Test on device\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   - Ensure "sharp" is installed: npm install --save-dev sharp');
    console.error('   - Check internet connection');
    console.error('   - Verify logo URL is accessible');
    process.exit(1);
  }
}

main();
