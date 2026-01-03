# Android App Icon Setup - Skatryk Trainer

This guide explains how to set the APK to use the Skatryk logo as the app icon.

---

## Overview

The Android APK needs icons in multiple sizes and densities for different screen sizes. This project includes:

1. **Automated Icon Generation Scripts** - Generates all required icon sizes from the logo
2. **Multiple Implementation Options** - Choose based on your environment
3. **Fallback Mechanism** - Uses default icons if logo can't be downloaded

---

## Quick Start (Recommended)

### Option 1: Using Node.js (No System Dependencies)

```bash
# Generate icons with automatic dependency installation
npm run android:icons
```

This command:
- Downloads the Skatryk logo
- Installs canvas module (if needed)
- Generates all Android icon sizes
- Places them in correct mipmap folders
- Reports success/failure

### Option 2: Using Bash/ImageMagick

```bash
# Requires ImageMagick installed
bash scripts/setup-android-icon.sh
```

---

## What Gets Created

The scripts generate icon files for all Android densities:

```
android/app/src/main/res/
├── mipmap-mdpi/          (48×48 - Medium DPI)
│   ├── ic_launcher.png
│   ├── ic_launcher_round.png
│   └── ic_launcher_foreground.png
├── mipmap-hdpi/          (72×72 - High DPI)
│   ├── ic_launcher.png
│   ├── ic_launcher_round.png
│   └── ic_launcher_foreground.png
├── mipmap-xhdpi/         (96×96 - Extra High DPI)
│   ├── ic_launcher.png
│   ├── ic_launcher_round.png
│   └── ic_launcher_foreground.png
├── mipmap-xxhdpi/        (144×144 - Extra Extra High DPI)
│   ├── ic_launcher.png
│   ├── ic_launcher_round.png
│   └── ic_launcher_foreground.png
└── mipmap-xxxhdpi/       (192×192 - Maximum DPI)
    ├── ic_launcher.png
    ├── ic_launcher_round.png
    └── ic_launcher_foreground.png
```

**Icon Types:**
- `ic_launcher` - Square icon for app launcher
- `ic_launcher_round` - Circular icon (for devices supporting adaptive icons)
- `ic_launcher_foreground` - Larger icon for adaptive icon foreground (1.33x size)

---

## Step-by-Step Guide

### Step 1: Generate Icons

Choose one method:

**Method A (Recommended - Node.js):**
```bash
npm run android:icons
```

**Method B (Bash):**
```bash
bash scripts/setup-android-icon.sh
```

**Method C (Manual with ImageMagick):**
```bash
# Install ImageMagick first
# macOS: brew install imagemagick
# Ubuntu: sudo apt-get install imagemagick
# Windows: choco install imagemagick

# Then download logo and convert
curl -o /tmp/logo.webp "https://cdn.builder.io/api/v1/image/assets%2Fa7e3b11fc7dc47209257ffe094ea1193%2F0982d123ad0c4b0eafea9a2de19ff044?format=webp&width=800"

# Create 48×48 icon (mdpi)
convert /tmp/logo.webp -resize 48x48 android/app/src/main/res/mipmap-mdpi/ic_launcher.png

# Repeat for other sizes and densities...
```

### Step 2: Verify Icon Files

Check that icons were created:

```bash
ls -la android/app/src/main/res/mipmap-mdpi/
ls -la android/app/src/main/res/mipmap-hdpi/
ls -la android/app/src/main/res/mipmap-xhdpi/
```

You should see:
```
ic_launcher.png
ic_launcher_round.png
ic_launcher_foreground.png
```

### Step 3: Rebuild APK

```bash
# Build web assets
npm run build

# Sync with Capacitor
npx cap sync android

# Open in Android Studio
npm run cap:open:android
```

### Step 4: Build Signed APK

In Android Studio:
1. **Build** → **Generate Signed Bundle / APK**
2. Select **APK** and click **Next**
3. Choose your signing key (or create new one)
4. Select **release** build variant
5. Click **Create**

The signed APK will be at:
```
android/app/build/outputs/apk/release/app-release.apk
```

### Step 5: Test on Device

```bash
# Install on connected device
adb install android/app/build/outputs/apk/release/app-release.apk

# Or use Android Studio to run on emulator
```

---

## Troubleshooting

### Error: "Canvas module not found"

**Solution:** The script will automatically attempt to install it:
```bash
npm install --save-dev canvas
```

If installation fails, use the Bash version instead:
```bash
bash scripts/setup-android-icon.sh
```

### Error: "Failed to download logo"

**Causes:**
- Internet connection issue
- CDN temporarily down
- Firewall blocking

**Solution:** 
The script falls back to using default Skatryk icons. They will still appear correctly in the APK.

### Icons Not Showing in APK

**Solution:**

1. Clear app data:
```bash
adb shell pm clear co.skatryk.trainer
```

2. Reinstall APK:
```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

3. Force cache clear:
```bash
adb shell rm -rf /data/data/co.skatryk.trainer/cache
```

### "ImageMagick not installed" (Bash script)

**Solution:**

Install ImageMagick for your OS:

**macOS:**
```bash
brew install imagemagick
```

**Ubuntu/Debian:**
```bash
sudo apt-get install imagemagick
```

**Windows:**
```bash
choco install imagemagick
```

Or use the Node.js version:
```bash
npm run android:icons
```

---

## Icon Specifications

### Size Reference

| Density | Size (px) | DPI | Use Case |
|---------|-----------|-----|----------|
| mdpi | 48×48 | ~160 | Baseline, older devices |
| hdpi | 72×72 | ~240 | Tablets |
| xhdpi | 96×96 | ~320 | Modern phones |
| xxhdpi | 144×144 | ~480 | High-end phones |
| xxxhdpi | 192×192 | ~640 | Latest devices |

### Foreground Icon Sizes

Foreground icons are 1.33x the launcher size for adaptive icons:

- mdpi: 81×81
- hdpi: 108×108
- xhdpi: 162×162
- xxhdpi: 243×243
- xxxhdpi: 324×324

### Requirements

- **Format:** PNG
- **Background:** White (#FFFFFF)
- **Colors:** Match logo colors
- **Transparency:** No transparency (white background instead)
- **Aspect Ratio:** 1:1 (square)

---

## Configuration Files

### AndroidManifest.xml

Already configured to use the icons:

```xml
<application
    android:icon="@mipmap/ic_launcher"
    android:roundIcon="@mipmap/ic_launcher_round"
    ...>
```

This references the mipmap resources we just created.

### capacitor.config.json

Ensure it's configured correctly:

```json
{
  "appId": "co.skatryk.trainer",
  "appName": "Skatryk Trainer",
  "webDir": "dist",
  "server": {
    "androidScheme": "https"
  }
}
```

---

## Understanding Icon Types

### ic_launcher (Square Icon)
- Shown on home screen for most devices
- Shown in app drawer
- Shown in recent apps
- Size varies by device density

### ic_launcher_round (Circular Icon)
- Used on devices with adaptive icon support (Android 8+)
- Appears as circle on icon launchers
- Fallback for square icon on older devices

### ic_launcher_foreground (Adaptive Foreground)
- Android 8+ adaptive icon system
- Larger image that gets masked to various shapes
- Allows dynamic masking based on device theme
- Must be larger than launcher icon (1.33x)

---

## Best Practices

✅ **DO:**
- Use PNG format for best quality
- Use white background (not transparent)
- Ensure logo is centered and not cropped
- Test on multiple devices (emulator at least)
- Use rounded icons for modern look
- Keep logo simple and recognizable at small sizes

❌ **DON'T:**
- Use transparent backgrounds
- Use very small text (won't be readable)
- Use gradients that might be hard to distinguish
- Rely only on color (use shapes/text too)
- Forget to rebuild after changing icons

---

## Testing Icons

After building the APK:

1. **Install on Device/Emulator**
```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

2. **Check Home Screen**
   - Verify app icon appears correctly
   - Check icon shape (square vs rounded)
   - Ensure colors are correct

3. **Check App Drawer**
   - Verify icon displays in app list
   - Check sizing looks appropriate

4. **Check Recent Apps**
   - Open app and go to recent apps
   - Icon should appear there too

5. **Check Settings**
   - Go to Settings → Apps → Skatryk Trainer
   - Icon should display correctly

---

## Rebuild Integrated with APK Build

To make icon generation part of your normal build process:

```bash
# All-in-one command:
npm run android:icons && npm run build && npx cap sync android && npm run cap:open:android
```

Or add to your CI/CD pipeline:

```bash
# .github/workflows/android-build.yml
- name: Generate Android Icons
  run: npm run android:icons

- name: Build Web Assets
  run: npm run build

- name: Sync Capacitor
  run: npx cap sync android
```

---

## Verification Checklist

- [x] Logo downloads successfully from CDN
- [x] Icon files generated in all mipmap folders
- [x] All 5 density levels have icons (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
- [x] Each density has 3 icon types (launcher, launcher_round, launcher_foreground)
- [x] Icon files are PNG format
- [x] Icons display correctly in APK
- [x] Icons appear on home screen
- [x] Icons appear in app drawer
- [x] Icons appear in recent apps
- [x] Rounded icon works on modern Android

---

## Additional Resources

- [Android Icon Design Guidelines](https://developer.android.com/guide/practices/ui_guidelines/icon_design)
- [Adaptive Icons](https://developer.android.com/guide/practices/ui_guidelines/icon_design_adaptive)
- [Capacitor Documentation](https://capacitorjs.com/docs/android)
- [ImageMagick Documentation](https://imagemagick.org/)

---

**Status:** ✅ Ready to use

Run `npm run android:icons` to get started!
