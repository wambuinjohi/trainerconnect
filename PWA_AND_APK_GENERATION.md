# PWA and Android APK Generation Guide

This guide provides complete instructions for converting your application into a Progressive Web App (PWA) and generating an Android APK that connects to your API.

---

## Overview

Your application now supports three deployment methods:

1. **Progressive Web App (PWA)** - Installable, offline-capable web app
2. **Android APK** - Native Android app using Capacitor
3. **Traditional Web App** - Standard web browser deployment

---

## Part 1: PWA Setup (Web + Offline Support)

### Step 1.1: Prepare PWA Icons

The PWA requires icons in PNG format. SVG templates have been created at:
- `public/icons/icon-192x192.svg`
- `public/icons/icon-512x512.svg`
- `public/icons/icon-maskable-192x192.svg`
- `public/icons/icon-maskable-512x512.svg`

**Convert SVG icons to PNG using one of these methods:**

#### Option A: Using ImageMagick (Recommended)
```bash
# Install ImageMagick (macOS)
brew install imagemagick

# Convert all SVG icons to PNG
for svg in public/icons/*.svg; do
  convert "$svg" "${svg%.svg}.png"
done
```

#### Option B: Using Inkscape
```bash
# Install Inkscape (macOS)
brew install inkscape

# Convert icons
inkscape public/icons/icon-192x192.svg --export-filename=public/icons/icon-192x192.png
inkscape public/icons/icon-512x512.svg --export-filename=public/icons/icon-512x512.png
inkscape public/icons/icon-maskable-192x192.svg --export-filename=public/icons/icon-maskable-192x192.png
inkscape public/icons/icon-maskable-512x512.svg --export-filename=public/icons/icon-maskable-512x512.png
```

#### Option C: Using Online Tool
1. Visit [CloudConvert](https://cloudconvert.com/svg-to-png) or [Online Converter](https://online-convert.com/category/image)
2. Upload each SVG file
3. Download as PNG
4. Place PNG files in `public/icons/` directory

#### Option D: Using svgexport
```bash
# Install svgexport globally
npm install -g svgexport

# Convert all icons
svgexport public/icons/icon-192x192.svg public/icons/icon-192x192.png 192:192
svgexport public/icons/icon-512x512.svg public/icons/icon-512x512.png 512:512
svgexport public/icons/icon-maskable-192x192.svg public/icons/icon-maskable-192x192.png 192:192
svgexport public/icons/icon-maskable-512x512.svg public/icons/icon-maskable-512x512.png 512:512
```

### Step 1.2: Verify PWA Configuration

Checklist:
- ✅ `public/manifest.webmanifest` - Contains PWA metadata
- ✅ `public/sw.js` - Service worker for offline support
- ✅ `src/main.tsx` - Service worker registration (environment-aware)
- ✅ `index.html` - PWA meta tags and manifest link
- ✅ `public/icons/icon-*.png` - PNG icons (convert from SVG)

### Step 1.3: Build and Deploy PWA

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Output will be in dist/ folder
# Deploy dist/ folder to your web server

# For example, deploy to https://trainer.skatryk.co.ke/
# The app will then be installable as a PWA
```

### Step 1.4: Test PWA Locally

```bash
# Build
npm run build

# Serve locally
npm run preview

# Open http://localhost:4173 in your browser

# Test PWA installation:
# 1. Open browser DevTools
# 2. Go to Application > Manifest
# 3. Verify manifest loads correctly
# 4. Check that SW is registered in Application > Service Workers
# 5. Test offline: DevTools > Network > Offline, then reload page
```

### Step 1.5: Deploy to Production

```bash
# Build locally
npm run build

# Upload dist/ contents to https://trainer.skatryk.co.ke/
# Ensure these files are served:
# - index.html
# - manifest.webmanifest
# - sw.js (in root)
# - icons/ folder
# - All other bundled assets

# After deployment, test at https://trainer.skatryk.co.ke/
```

---

## Part 2: Android APK Generation

### Prerequisites

Before generating APK, ensure you have installed:

1. **Android Studio** - https://developer.android.com/studio
2. **Java Development Kit (JDK)** - Version 11 or higher
3. **Android SDK** - API level 24 or higher (installed via Android Studio)
4. **Gradle** - Included with Android Studio

Verify installation:
```bash
# Check Java version
java -version  # Should be 11+

# Check if Android SDK is installed
ls $ANDROID_HOME/platforms  # Should show API levels
```

### Step 2.1: First-Time Android Setup

Run these commands **once** to set up the Android platform:

```bash
# Install npm dependencies
npm install

# Initialize Capacitor Android platform (creates android/ folder)
npm run cap:add:android

# This creates the following structure:
# android/
#   ├── app/
#   ├── build.gradle
#   └── settings.gradle
```

### Step 2.2: Build Web Assets

```bash
# Build for production
npm run build

# This creates dist/ folder with optimized assets
# The API endpoint is set to: https://trainer.skatryk.co.ke/api.php
```

### Step 2.3: Sync with Android Platform

```bash
# Copy web assets to Android project
npx cap copy android

# Sync Capacitor plugins with Android project
npx cap sync android

# This step:
# - Copies dist/ to android/app/src/main/assets/public/
# - Syncs Geolocation plugin
# - Updates AndroidManifest.xml with permissions
```

**One-command approach (Recommended):**
```bash
npm run cap:build:android
# This runs: npm run build && npx cap copy android && npx cap sync android
```

### Step 2.4: Open in Android Studio

```bash
npm run cap:open:android

# This opens the Android project in Android Studio
# You can also manually open: android/app
```

### Step 2.5: Build Debug APK (for Testing)

In Android Studio:

1. Click **Build** menu → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Wait for build to complete (5-10 minutes)
3. Android Studio shows notification when complete
4. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

**Install on device/emulator:**
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Step 2.6: Build Release APK (for Play Store)

#### Using Android Studio UI (Recommended for first-time):

1. **Open Android Studio** with the Android project
2. **Build** menu → **Generate Signed Bundle / APK**
3. **Select APK** (not Bundle) → **Next**
4. **Create new keystore** (first release only):
   - Click **Create new...**
   - **Key store path**: Choose a secure location, e.g., `/Users/yourname/Developer/skatryk-trainer.jks`
   - **Password**: Create a strong password (e.g., `MyP@ssw0rd123!`)
   - **Key alias**: `skatryk-trainer`
   - **Key password**: Same as keystore password (or different, your choice)
   - **Validity**: `25` years (for long-term support)
   - Click **Create**
5. **Select build variant**: `release`
6. **Finish signing** and click **Create**

**APK will be saved at:**
```
android/app/build/outputs/apk/release/app-release.apk
```

**⚠️ CRITICAL**: Save the keystore file and passwords securely:
```
Location: /Users/yourname/Developer/skatryk-trainer.jks
Keystore Password: [your password]
Key Alias: skatryk-trainer
Key Password: [your password]
```

You'll need these for **every future release**. Losing the keystore means you can't update your app on Play Store.

#### Using Command Line (Alternative):

```bash
# Ensure web assets are built
npm run build

# Sync with Android
npx cap sync android

# Navigate to Android project
cd android

# Build release APK using Gradle
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=/path/to/skatryk-trainer.jks \
  -Pandroid.injected.signing.store.password=YOUR_KEYSTORE_PASSWORD \
  -Pandroid.injected.signing.key.alias=skatryk-trainer \
  -Pandroid.injected.signing.key.password=YOUR_KEY_PASSWORD

cd ..

# APK will be at: android/app/build/outputs/apk/release/app-release.apk
```

### Step 2.7: Test APK on Device

```bash
# Using Android Studio: Run > Run 'app'
# Or manually:
adb install android/app/build/outputs/apk/release/app-release.apk

# Test on the device:
# 1. Open the app
# 2. Navigate through all features
# 3. Test API connectivity: Make a request that calls the API
# 4. Check location permissions work
# 5. Verify app icon displays correctly
```

---

## Part 3: Deployment Options

### Option A: Direct Distribution

Host the APK on your website for users to download and install:

```bash
# 1. Copy APK to your web server
scp android/app/build/outputs/apk/release/app-release.apk \
  user@trainer.skatryk.co.ke:/var/www/skatryk/apps/

# 2. Users can download from:
# https://trainer.skatryk.co.ke/apps/app-release.apk

# 3. Users must enable "Unknown Sources" in Android settings
# Settings > Security > Unknown Sources > Enable
```

### Option B: Google Play Store Distribution

1. **Create Google Play Developer Account**
   - Go to [Google Play Console](https://play.google.com/console)
   - Pay $25 one-time developer fee
   - Verify account with phone number

2. **Create App Listing**
   - Click "Create app"
   - Fill in app name: "Skatryk Trainer"
   - Category: "Lifestyle"
   - App type: "App"

3. **Upload Release APK**
   - Collect from: `android/app/build/outputs/apk/release/app-release.apk`
   - Go to **Release** → **Production**
   - Click **Create new release**
   - Upload APK file
   - Add release notes
   - Click **Review release**
   - Click **Start rollout to Production**

4. **Fill in Store Listing**
   - Screenshots (2-8 images showing app features)
   - Description (short and long)
   - Icon (512x512 PNG)
   - Feature graphic (1024x500 PNG)
   - Category and rating
   - Content rating questionnaire
   - Pricing (Free or paid)

5. **Submit for Review**
   - Complete all required fields
   - Click **Submit app for review**
   - Google reviews in 24 hours (usually)
   - App appears in Play Store within hours of approval

---

## Part 4: Customizing API Endpoint

### Build-Time Configuration

To change the API endpoint before building:

```bash
# Build with custom API endpoint
VITE_API_URL=https://your-api.com/api.php npm run build

# Then sync with Android
npx cap sync android
```

### Runtime Configuration (In App)

Users can override the API endpoint in the app:
1. Open app settings
2. Change API URL
3. Restart app

The app stores the URL in `localStorage` and persists it.

---

## Part 5: Version Management

### Updating App Version

Before each release, update the version in `android/app/build.gradle`:

```gradle
android {
    ...
    defaultConfig {
        ...
        versionCode 2  // ⬅️ MUST INCREMENT (integer, always increasing)
        versionName "1.1.0"  // For display (can be any format)
    }
}
```

**Important Rules:**
- `versionCode` must ALWAYS increase (even when going from 2.0 → 1.9)
- `versionName` is just for users (e.g., "1.0.0", "1.1.0", "2.0.0")
- Play Store requires `versionCode` to increase for each update

### Release Checklist

Before releasing to Play Store:

- [ ] Code changes tested on web (`npm run dev`)
- [ ] Production build succeeds (`npm run build`)
- [ ] No TypeScript or build errors
- [ ] Capacitor synced (`npx cap sync android`)
- [ ] Debug APK tested on emulator/device
- [ ] Release APK tested on device
- [ ] All features work (API connection, location, etc.)
- [ ] Version code incremented in `android/app/build.gradle`
- [ ] Signing keystore backed up securely
- [ ] Release notes written
- [ ] Screenshots updated (for Play Store)

---

## Troubleshooting

### "Build failed" errors

```bash
# Clean and rebuild
cd android
./gradlew clean
cd ..

npm run build
npx cap sync android

# Then rebuild in Android Studio
```

### "android/ folder not found"

```bash
npm run cap:add:android
# This creates the android platform folder
```

### "dist/ folder not found"

```bash
npm run build
# Build web assets first
```

### Service worker errors in logcat

✅ **Expected** - The fix in `src/main.tsx` prevents registration on native.
Check logcat: `adb logcat | grep "ServiceWorker"`

Should see:
```
Service worker registration skipped on native platform
```

Or no errors at all.

### App can't connect to API

```bash
# Check API endpoint
# In app: Settings > API URL should be: https://trainer.skatryk.co.ke/api.php

# Test connectivity:
adb shell ping trainer.skatryk.co.ke

# Check Android logcat for network errors:
adb logcat | grep API
adb logcat | grep http
```

### Geolocation not working

1. **Grant permission**: When app starts, grant location permission
2. **Check Android version**: Geolocation permission is runtime on Android 6+
3. **Verify permission in manifest**:
   - Android Studio > AndroidManifest.xml
   - Should contain:
     ```xml
     <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
     <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
     ```

### Signing key errors

**Lost keystore file?**
- Only option: Increment package ID (e.g., `co.skatryk.trainer.v2`)
- Old app users will see a different app
- ⚠️ Prevent this by backing up keystore immediately

**Wrong password?**
- Can't recover - same issue as above
- Keep password in secure password manager

---

## Security Best Practices

1. **Protect Keystore File**
   - Store on secure, backed-up device
   - Use password manager for keystore password
   - Never commit to version control

2. **Protect API Keys**
   - Don't hardcode API keys in app
   - Use server-side API proxy if needed
   - Rotate keys periodically

3. **App Security**
   - Update dependencies: `npm audit fix`
   - Review permissions before release
   - Use HTTPS for all API calls ✅ (already configured)

---

## Useful Commands Reference

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Build production assets

# Android setup (one-time)
npm run cap:add:android       # Initialize Android platform

# Android builds (for each release)
npm run cap:build:android     # Build + sync (recommended)
npm run cap:copy android      # Copy web assets to Android
npx cap sync android          # Sync plugins

# Android testing
npm run cap:open:android      # Open in Android Studio
adb install -r app-debug.apk  # Install debug APK
adb logcat                     # View device logs
adb logcat -c                  # Clear logs

# Android clean
cd android && ./gradlew clean && cd ..
```

---

## Summary

1. **PWA Setup**: Convert SVG icons to PNG, build, deploy to web server
2. **Android APK**: Set up Android once, then build-sync-generate for each release
3. **Distribution**: Play Store (recommended) or direct download from website
4. **Maintenance**: Keep keystore safe, increment version for each release

---

## Next Steps

1. ✅ Convert SVG icons to PNG (use ImageMagick, Inkscape, or online tool)
2. ✅ Test PWA locally: `npm run build && npm run preview`
3. ✅ Set up Android: `npm run cap:add:android`
4. ✅ Build APK: `npm run cap:build:android` then Android Studio
5. ✅ Test on Android device
6. ✅ Deploy to Play Store or host directly

Questions? See `ANDROID_BUILD_AUDIT.md` for detailed technical analysis.
