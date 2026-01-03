#!/bin/bash

# Android Icon Setup Script
# Downloads Skatryk logo and generates icons for all Android densities

set -e

LOGO_URL="https://cdn.builder.io/api/v1/image/assets%2Fa7e3b11fc7dc47209257ffe094ea1193%2F0982d123ad0c4b0eafea9a2de19ff044?format=webp&width=800"
TEMP_LOGO="/tmp/skatryk-logo.webp"
ANDROID_RES_PATH="android/app/src/main/res"

echo "🎨 Setting up Android App Icon..."
echo ""

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "⚠️  ImageMagick is not installed."
    echo ""
    echo "Please install ImageMagick:"
    echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "  macOS: brew install imagemagick"
    echo "  Windows: choco install imagemagick"
    echo ""
    echo "Or use the Node.js version:"
    echo "  npm install --save-dev sharp"
    echo "  node scripts/generate-android-icons.js"
    exit 1
fi

echo "📥 Downloading logo from CDN..."
if ! curl -f -L -o "$TEMP_LOGO" "$LOGO_URL"; then
    echo "❌ Failed to download logo"
    exit 1
fi

echo "✅ Logo downloaded"
echo ""

# Icon sizes for each density
# Format: size=density
declare -A SIZES=(
    ["mdpi"]="48"
    ["hdpi"]="72"
    ["xhdpi"]="96"
    ["xxhdpi"]="144"
    ["xxxhdpi"]="192"
)

echo "🔄 Generating icon files..."
echo ""

total_generated=0

for density in "${!SIZES[@]}"; do
    size=${SIZES[$density]}
    mipmap_dir="$ANDROID_RES_PATH/mipmap-$density"
    
    mkdir -p "$mipmap_dir"
    
    # Generate square icons
    echo "  Generating ic_launcher ($density - ${size}x${size})..."
    convert "$TEMP_LOGO" -resize "${size}x${size}" -background white -gravity center -extent "${size}x${size}" \
        "$mipmap_dir/ic_launcher.png"
    ((total_generated++))
    
    # Generate rounded icons
    echo "  Generating ic_launcher_round ($density - ${size}x${size})..."
    convert "$TEMP_LOGO" -resize "${size}x${size}" -background white -gravity center -extent "${size}x${size}" \
        \( +clone -threshold -1 -negate -morphology EdgeOut octagon:2 -morphology Dilate octagon:1 \
           -morphology Erode octagon:1 -morphology EdgeOut octagon:2 -fuzz 40% -fill none -floodfill +0+0 white \) \
        -compose CopyOpacity -composite -trim -transparent white \
        "$mipmap_dir/ic_launcher_round.png"
    ((total_generated++))
    
    # Generate foreground icons (larger for adaptive icon)
    foreground_size=$((size * 108 / 48))
    echo "  Generating ic_launcher_foreground ($density - ${foreground_size}x${foreground_size})..."
    convert "$TEMP_LOGO" -resize "${foreground_size}x${foreground_size}" -background white \
        "$mipmap_dir/ic_launcher_foreground.png"
    ((total_generated++))
done

# Clean up
rm -f "$TEMP_LOGO"

echo ""
echo "✅ Icon generation complete!"
echo ""
echo "📊 Summary:"
echo "   Total icons generated: $total_generated"
echo "   Densities: mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi"
echo "   Types: ic_launcher, ic_launcher_round, ic_launcher_foreground"
echo ""
echo "📝 Next steps:"
echo "   1. Rebuild the APK:"
echo "      npm run build && npx cap sync android"
echo "   2. Open in Android Studio:"
echo "      npm run cap:open:android"
echo "   3. Build and test signed APK"
echo ""
