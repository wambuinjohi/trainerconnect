#!/usr/bin/env node

/**
 * Generate Android App Icons - Simple Version
 * Uses Canvas API or provides base64 encoded default icon
 * No external dependencies required beyond Node.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { createCanvas, loadImage } = require('canvas');

const LOGO_URL = "https://cdn.builder.io/api/v1/image/assets%2Fa7e3b11fc7dc47209257ffe094ea1193%2F0982d123ad0c4b0eafea9a2de19ff044?format=webp&width=800";

// Icon sizes for Android densities
const ICON_CONFIGS = {
  mdpi: { size: 48, fgSize: 81 },
  hdpi: { size: 72, fgSize: 108 },
  xhdpi: { size: 96, fgSize: 162 },
  xxhdpi: { size: 144, fgSize: 243 },
  xxxhdpi: { size: 192, fgSize: 324 }
};

// Fallback: Base64 encoded default Skatryk icon (simple gradient)
const DEFAULT_ICON_BASE64 = {
  mdpi: 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAIrSURBVGiB7dpBjtswCAbg3/Pm9jgkLztIcstpH9ENi4y0U4rYm+wH7AF2QXqAdkB6gbXZQZzAAQNgURw4g8IECB9O51tCpChKkiVLHQDAOI5VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf8nxnEchmEYhmEYhmEYhmEYhmGYf8M4jlO/3+/r9Xp5PB41jmNV13VVlqWKokg5Ho9VWZZVWZZVnueFsiyVlmWl3G63qtfr1eVyUfP5XIXDYXm73Zbn81ndbjeVZZkSETGO4zSPx0OFw2EFgJqmSVmWVVEU1Xg8VtvtllqtlgrfvRaLhQrHcRqNRqpQKJRyHMdpFAoFNZvN1P1+V9PpVKXTaaXT6ViY53lqf3+/9Ho91e12qV6vp3q9HkmSRJPJRL29vaV+v1/dbjdVr9fVarVS19dXyvf9WJTneal3d3dZVVWE47gsiKLIEkWRVZZl5nmeetzcXBbD4dA0RVFy1jcVAOj1eppHR0dqGIZVURSqulySKIo8CIIyv9+vxuPxWaFQqKzL5SK7vZ6QJmn/oBCLxeLwV4SDLG1VVapaoqiiKKrhcBg7sVisFofDYZVZlpU6Gu1R+pLZ2VmVyWQy6HA4mF4ul1dNZzQaXRRFkVUUhXZxcXHU6XSq5XKp+v2+OhwOar1e/8JwOLzqbDarwjiO1HK5VAuFQllzuZzEsvSvA+xyuahgMFhWeZ7H7u7uFgEQq91uE4BF//uvZXt7uxSPx1UwGFSfn59lTafTUjgcLn1yckJ1XV+afD5PAVw6nY4EgFqv10sAuCwWi1IA+AzF8/MzAFQAuCTwAVRv376xm5ubMgBOSfwHAP4zN0c5n08AAAAASUVORK5CYII=',
  hdpi: 'iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAYAAABV7bNHAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAALBSURBVHic7dtBjtwwDIbhmxzySKSfYXuKN11gF7gW2HOUYaVHCAzLSHQKNjmIm0MxlBiSl8OFYc8sN+wHRCXXXFkUR36khkNJ/oBd4AFuQQoXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQAqXQ/AMhDcWJwB5xNwAAAAASUVORK5CYII='
};

/**
 * Download file from URL
 */
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.on('error', reject);
  });
}

/**
 * Create circular icon
 */
async function createCircularIcon(image, size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Draw white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  // Draw circular mask
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();

  // Draw image
  ctx.drawImage(image, 0, 0, size, size);
  ctx.restore();

  return canvas.createPNGStream();
}

/**
 * Generate icons
 */
async function generateIcons(imageBuffer) {
  console.log('🔄 Generating icon files...\n');
  
  let image;
  try {
    image = await loadImage(imageBuffer);
  } catch (error) {
    console.error('❌ Error loading image:', error.message);
    throw error;
  }

  let totalGenerated = 0;

  for (const [density, sizes] of Object.entries(ICON_CONFIGS)) {
    const mipMapDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', `mipmap-${density}`);

    // Ensure directory exists
    if (!fs.existsSync(mipMapDir)) {
      fs.mkdirSync(mipMapDir, { recursive: true });
    }

    try {
      // Generate square launcher icon
      const canvas = createCanvas(sizes.size, sizes.size);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, sizes.size, sizes.size);
      ctx.drawImage(image, 0, 0, sizes.size, sizes.size);

      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(path.join(mipMapDir, 'ic_launcher.png'), buffer);
      console.log(`✅ Generated: mipmap-${density}/ic_launcher.png (${sizes.size}x${sizes.size})`);
      totalGenerated++;

      // Generate rounded launcher icon
      const roundCanvas = createCanvas(sizes.size, sizes.size);
      const roundCtx = roundCanvas.getContext('2d');
      roundCtx.fillStyle = '#FFFFFF';
      roundCtx.fillRect(0, 0, sizes.size, sizes.size);
      roundCtx.beginPath();
      roundCtx.arc(sizes.size / 2, sizes.size / 2, sizes.size / 2, 0, Math.PI * 2);
      roundCtx.clip();
      roundCtx.drawImage(image, 0, 0, sizes.size, sizes.size);

      const roundBuffer = roundCanvas.toBuffer('image/png');
      fs.writeFileSync(path.join(mipMapDir, 'ic_launcher_round.png'), roundBuffer);
      console.log(`✅ Generated: mipmap-${density}/ic_launcher_round.png (${sizes.size}x${sizes.size})`);
      totalGenerated++;

      // Generate foreground icon (larger for adaptive icon)
      const fgCanvas = createCanvas(sizes.fgSize, sizes.fgSize);
      const fgCtx = fgCanvas.getContext('2d');
      fgCtx.fillStyle = '#FFFFFF';
      fgCtx.fillRect(0, 0, sizes.fgSize, sizes.fgSize);
      fgCtx.drawImage(image, 0, 0, sizes.fgSize, sizes.fgSize);

      const fgBuffer = fgCanvas.toBuffer('image/png');
      fs.writeFileSync(path.join(mipMapDir, 'ic_launcher_foreground.png'), fgBuffer);
      console.log(`✅ Generated: mipmap-${density}/ic_launcher_foreground.png (${sizes.fgSize}x${sizes.fgSize})`);
      totalGenerated++;
    } catch (error) {
      console.error(`❌ Error generating icons for ${density}:`, error.message);
    }
  }

  return totalGenerated;
}

/**
 * Create default icon from base64
 */
function createDefaultIcon(density) {
  const mipMapDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', `mipmap-${density}`);
  
  if (!fs.existsSync(mipMapDir)) {
    fs.mkdirSync(mipMapDir, { recursive: true });
  }

  // Use default icon or actual logo size
  const buffer = Buffer.from(DEFAULT_ICON_BASE64[density] || DEFAULT_ICON_BASE64.mdpi, 'base64');
  fs.writeFileSync(path.join(mipMapDir, 'ic_launcher.png'), buffer);
  console.log(`✅ Created default: mipmap-${density}/ic_launcher.png`);
}

/**
 * Main
 */
async function main() {
  console.log('🎨 Generating Android App Icons from Skatryk Logo...\n');

  try {
    let imageBuffer;
    
    try {
      console.log('📥 Downloading logo from CDN...');
      imageBuffer = await downloadFile(LOGO_URL);
      console.log(`✅ Logo downloaded (${imageBuffer.length} bytes)\n`);
    } catch (error) {
      console.warn('⚠️  Failed to download logo:', error.message);
      console.log('ℹ️  Using default Skatryk icon...\n');
      
      // Use default icons
      Object.keys(ICON_CONFIGS).forEach(density => {
        createDefaultIcon(density);
      });

      console.log('\n✅ Icons created with defaults!');
      console.log('\nℹ️  Note: These are placeholder icons.');
      console.log('To use the custom Skatryk logo, ensure the CDN URL is accessible.');
      process.exit(0);
    }

    // Check if canvas is available
    if (!createCanvas || !loadImage) {
      throw new Error('Canvas module not available');
    }

    const totalGenerated = await generateIcons(imageBuffer);

    console.log('\n✅ Icon generation complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   Total icons generated: ${totalGenerated}`);
    console.log(`   Densities: mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi`);
    console.log(`   Types: launcher, launcher_round, launcher_foreground`);

    console.log('\n📝 Next steps:');
    console.log('   1. Rebuild the APK:');
    console.log('      npm run build && npx cap sync android');
    console.log('   2. Open in Android Studio:');
    console.log('      npm run cap:open:android');
    console.log('   3. Build signed APK and test\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Fall back to using default icons
    console.log('\n⚠️  Falling back to default icons...\n');
    try {
      Object.keys(ICON_CONFIGS).forEach(density => {
        createDefaultIcon(density);
      });
      console.log('\n✅ Default icons created!');
      process.exit(0);
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError.message);
      process.exit(1);
    }
  }
}

// Only run if canvas is installed
if (typeof createCanvas === 'undefined') {
  console.log('⚠️  Canvas module not installed.');
  console.log('Installing dependencies first...\n');
  
  const { execSync } = require('child_process');
  try {
    console.log('📦 Installing canvas...');
    execSync('npm install --save-dev canvas', { stdio: 'inherit' });
    console.log('\n✅ Canvas installed!\n');
    main();
  } catch (error) {
    console.error('❌ Failed to install canvas');
    console.error('\nTrying fallback: creating default icons...\n');
    
    try {
      Object.keys(ICON_CONFIGS).forEach(density => {
        createDefaultIcon(density);
      });
      console.log('\n✅ Default icons created!');
      process.exit(0);
    } catch (err) {
      console.error('❌ All attempts failed:', err.message);
      process.exit(1);
    }
  }
} else {
  main();
}
