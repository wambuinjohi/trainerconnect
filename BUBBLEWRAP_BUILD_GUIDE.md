# Bubblewrap/TWA Build Guide - Android APK for Skatryk Trainer

This guide will help you generate a production-ready Android APK using Bubblewrap (Google's Trusted Web Activity builder) instead of Capacitor.

## ✅ Why Bubblewrap Instead of Capacitor?

- ✅ Simpler - wraps your existing PWA, no code changes needed
- ✅ Smaller APK - uses web assets directly
- ✅ Better compatibility - fewer blank screen issues
- ✅ Official Google approach - for PWA-to-APK conversion
- ✅ Offline support - service worker works seamlessly

## 📋 Prerequisites

1. **Node.js 16+** (already have this)
2. **Java Development Kit (JDK) 11+**
   ```bash
   # Check if you have JDK
   java -version
   # If not, install from: https://adoptium.net/
   ```

3. **Android SDK**
   - Install Android Studio: https://developer.android.com/studio
   - Or install Android SDK command-line tools separately

4. **Bubblewrap CLI**
   ```bash
   npm install -g @bubblewrap/cli
   ```

5. **Keystore file** (for signing APK)
   - Generate below in Step 2

## 🚀 Step-by-Step Build Process

### Step 1: Build Web Assets

First, create the production build:

```bash
npm run build
```

This creates the `dist/` folder that will be embedded in the APK.

**Verify the build:**
```bash
ls -la dist/
# Should contain: index.html, manifest.webmanifest, sw.js, icons/, etc.
```

### Step 2: Generate Signing Keystore

You need a keystore file to sign the APK. Generate it once and keep it safe:

```bash
keytool -genkeypair -v \
  -keystore ~/skatryk-trainer.jks \
  -alias skatryk-trainer-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**When prompted, enter:**
- Keystore password: `[Choose a strong password, save it!]`
- Key password: `[Same as keystore password or different - your choice]`
- First and last name: `Skatryk`
- Organizational unit: `Engineering`
- Organization: `Skatryk`
- City/Locality: `Nairobi`
- State/Province: `Nairobi`
- Country code: `KE`

**⚠️ IMPORTANT**: Save this file and password securely. You'll need it for all future app updates.

### Step 3: Get SHA-256 Fingerprint

Extract your signing certificate's SHA-256 fingerprint:

```bash
keytool -list -v -keystore ~/skatryk-trainer.jks \
  -alias skatryk-trainer-key \
  -storepass YOUR_KEYSTORE_PASSWORD
```

Look for the line: `SHA-256: XX:XX:XX:...`

Copy the fingerprint (without colons):
```
XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX
```

Convert to format without spaces:
```
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### Step 4: Update assetlinks.json

Update the file at `public/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "co.skatryk.trainer",
      "sha256_cert_fingerprints": [
        "PASTE_YOUR_SHA256_FINGERPRINT_HERE"
      ]
    }
  }
]
```

Replace `PASTE_YOUR_SHA256_FINGERPRINT_HERE` with your actual fingerprint (no spaces, no colons).

**Important**: This file must be accessible at:
```
https://trainer.skatryk.co.ke/.well-known/assetlinks.json
```

After updating, deploy it to your server (see Step 8).

### Step 5: Generate TWA with Bubblewrap

Initialize the Bubblewrap/TWA project (creates `twa-build/` directory):

```bash
npx @bubblewrap/cli init \
  --manifest https://trainer.skatryk.co.ke/manifest.webmanifest \
  --applicationId co.skatryk.trainer \
  --name "Skatryk Trainer" \
  --shortName Skatryk \
  --launcherName Skatryk
```

This creates a `twa-build/` folder with the Android project.

### Step 6: Build Debug APK (Testing)

Build an unsigned debug APK first:

```bash
cd twa-build
npx @bubblewrap/cli build
```

**Output location:**
```
twa-build/dist/app-debug.apk
```

**Test on device:**
```bash
adb install twa-build/dist/app-debug.apk
```

If the debug APK works without blank screen, you can proceed to release build.

### Step 7: Build Release APK (Production)

Build a signed, optimized APK for Play Store:

```bash
cd twa-build
npx @bubblewrap/cli build \
  --release \
  --keystore ~/skatryk-trainer.jks \
  --keystoreAlias skatryk-trainer-key
```

When prompted, enter your keystore password.

**Output location:**
```
twa-build/dist/app-release.apk
```

**Size check** - Should be 5-15 MB:
```bash
ls -lh twa-build/dist/app-release.apk
```

### Step 8: Deploy assetlinks.json

Upload `public/.well-known/assetlinks.json` to your server at:
```
https://trainer.skatryk.co.ke/.well-known/assetlinks.json
```

This must be accessible and return valid JSON for the app to verify your domain.

**Verify it's accessible:**
```bash
curl https://trainer.skatryk.co.ke/.well-known/assetlinks.json
# Should return the JSON content
```

## 🧪 Testing APK

### On Device

```bash
# Install debug APK
adb install twa-build/dist/app-debug.apk

# Or install release APK
adb install twa-build/dist/app-release.apk

# View logs
adb logcat | grep -i skatryk
```

### What to Check

- ✅ App launches without blank screen
- ✅ Can navigate to different pages
- ✅ API calls work (check network requests)
- ✅ Offline mode works (service worker)
- ✅ Home screen icon displays correctly
- ✅ App title shows as "Skatryk Trainer"

### Troubleshooting

**Blank screen on app start:**
- Check `adb logcat` for errors
- Ensure `https://trainer.skatryk.co.ke/manifest.webmanifest` is accessible
- Verify API endpoint is reachable from device's network

**"Cannot connect to host":**
- Device network isolation issue
- Try on different WiFi or device
- Check firewall rules on server

**Icon not displaying:**
- Ensure icons are PNG format (SVG conversion may be needed)
- Check manifest icon paths are correct
- Rebuild APK after icon changes

## 📦 Deploying to Google Play Store

### 1. Create Google Play Developer Account

Visit: https://play.google.com/console
- Cost: $25 one-time
- Setup takes 24-48 hours for approval

### 2. Create App Listing

1. Go to **Create app**
2. Fill in:
   - App name: `Skatryk Trainer`
   - Default language: English
   - App type: App
   - Category: Sports / Fitness / Lifestyle (choose appropriate)
3. Fill in content rating questionnaire
4. Add screenshots (minimum 2-5)
5. Add description, release notes, privacy policy link

### 3. Upload Release APK

1. Go to **Release** → **Production**
2. Create new release
3. Upload `twa-build/dist/app-release.apk`
4. Review and submit for approval (24-48 hours typically)

### 4. Future Updates

When you want to release a new version:

1. Update version in `twa-build/app/build.gradle`:
   ```gradle
   android {
       defaultConfig {
           versionCode 2  // Must increment
           versionName "1.1.0"
       }
   }
   ```

2. Rebuild:
   ```bash
   npm run build
   npx @bubblewrap/cli build --release --keystore ~/skatryk-trainer.jks --keystoreAlias skatryk-trainer-key
   ```

3. Upload new APK to Play Store

## 📋 Quick Checklist

Before each build:

- [ ] Web build created (`npm run build`)
- [ ] Keystore file exists and password saved
- [ ] SHA-256 fingerprint generated and noted
- [ ] assetlinks.json updated with fingerprint
- [ ] assetlinks.json deployed to server
- [ ] manifest.webmanifest accessible
- [ ] service worker (sw.js) accessible
- [ ] API endpoint (trainer.skatryk.co.ke) reachable

## 🔧 Command Reference

```bash
# Build web assets
npm run build

# Generate signing key (one-time)
keytool -genkeypair -v \
  -keystore ~/skatryk-trainer.jks \
  -alias skatryk-trainer-key \
  -keyalg RSA -keysize 2048 -validity 10000

# Initialize TWA
npx @bubblewrap/cli init \
  --manifest https://trainer.skatryk.co.ke/manifest.webmanifest \
  --applicationId co.skatryk.trainer \
  --name "Skatryk Trainer" \
  --shortName Skatryk \
  --launcherName Skatryk

# Build debug APK
cd twa-build && npx @bubblewrap/cli build && cd ..

# Build release APK
cd twa-build && npx @bubblewrap/cli build --release \
  --keystore ~/skatryk-trainer.jks \
  --keystoreAlias skatryk-trainer-key && cd ..

# Install on device
adb install twa-build/dist/app-release.apk

# View device logs
adb logcat | grep -i skatryk
```

## 🎯 What Happens Next

1. **First Build**: Debug APK tests the setup (~10 mins)
2. **Release Build**: Optimized, signed APK (~5 mins)
3. **Testing**: Manual testing on device (~5 mins)
4. **Deployment**: Upload to Play Store (~1 hour with review)
5. **Live**: App available to millions of Android users

## 🆘 Need Help?

Common issues and solutions:

| Issue | Solution |
|-------|----------|
| Blank screen | Check network, verify API accessible, view logcat |
| Build errors | Ensure JDK 11+, Android SDK installed |
| Fingerprint format | Remove colons and spaces from keytool output |
| assetlinks.json not found | Deploy to `.well-known/assetlinks.json` on root domain |
| APK won't install | Ensure device has Android 5.0+, try uninstalling old version |

## 📚 Additional Resources

- Bubblewrap Docs: https://github.com/GoogleChromeLabs/bubblewrap
- Google Play Console Help: https://support.google.com/googleplay/android-developer
- TWA Documentation: https://developer.chrome.com/docs/android/trusted-web-activity/
- Android App Signing: https://developer.android.com/studio/publish/app-signing

---

**Next Step**: Follow Step 1 above to build web assets and start the TWA generation process.

For any issues, check the troubleshooting section or review the generated `twa-build/app/build.gradle` file for configuration details.
