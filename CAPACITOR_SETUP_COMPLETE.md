# Capacitor Setup - Complete Configuration

Your project is now fully configured for Capacitor Android development. Here's what was set up:

## ✅ What Was Done

1. **Installed Capacitor packages** (v7.0+)
   - @capacitor/core
   - @capacitor/android
   - @capacitor/geolocation

2. **Initialized Android platform**
   - Created `android/` directory with native Android project structure
   - Configured Gradle, AndroidManifest.xml, and build files

3. **Updated configuration**
   - Fixed deprecated Capacitor options
   - Set up proper server configuration
   - Configured geolocation plugin with location permissions

4. **Built and synced assets**
   - Created production build (`dist/` folder)
   - Copied web assets to Android project
   - Synced plugins and permissions

---

## Prerequisites

Before building the APK, install these on your computer:

### Required
- **Android Studio** - Download from https://developer.android.com/studio
- **JDK 11+** - Included with Android Studio
- **Android SDK** - Installed via Android Studio (API level 24+)
- **Node.js 16+** (already have this)

### Recommended
- 10+ GB free disk space
- Android device or emulator for testing

---

## Build Instructions

### Step 1: Open Android Project in Android Studio

Run this command to open the Android project:
```bash
npm run cap:open:android
```

This opens `android/` folder in Android Studio. The first time it opens:
- Android Studio will download Gradle and build tools
- Project indexing will take 2-5 minutes
- Wait for "Build > Build Bundle(s) / APK(s)" menu to become active

### Step 2: Build Debug APK (for testing)

1. In Android Studio, go to **Build** menu
2. Select **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. Wait for build to complete
4. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

**Install on device:**
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Or drag APK file to Android device/emulator.

### Step 3: Build Release APK (for production/Play Store)

#### Option A: Using Android Studio GUI (Recommended for first time)
1. Go to **Build** → **Generate Signed Bundle / APK**
2. Select **APK** and click **Next**
3. If new to signing:
   - Click **Create new...** 
   - Choose a location to save keystore (e.g., `skatryk-trainer.jks`)
   - Create a strong password (save securely!)
   - Set validity to 25+ years
4. Select **release** build variant
5. Click **Create**
6. APK location: `android/app/build/outputs/apk/release/app-release.apk`

⚠️ **IMPORTANT**: Save the keystore file and password securely. You need it for future app updates.

#### Option B: Using Command Line (Advanced)
```bash
# Build web assets (if you made code changes)
npm run build

# Sync to Android
npx cap copy android
npx cap sync android

# Build release APK
cd android
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=/path/to/skatryk-trainer.jks \
  -Pandroid.injected.signing.store.password=YOUR_PASSWORD \
  -Pandroid.injected.signing.key.alias=skatryk-trainer \
  -Pandroid.injected.signing.key.password=YOUR_KEY_PASSWORD

cd ..
```

---

## Development Workflow

After making code changes:

```bash
# 1. Build and sync
npm run cap:build:android

# 2. Open in Android Studio
npm run cap:open:android

# 3. Build APK in Android Studio
# Build > Build Bundle(s) / APK(s) > Build APK(s)
```

---

## Testing on Device/Emulator

### Using Android Emulator
1. In Android Studio, click **AVD Manager**
2. Select or create a device
3. Click the green play button to launch emulator
4. Build APK and it will auto-install

### Using Physical Device
1. Connect Android phone via USB
2. Enable Developer Mode:
   - Go to Settings → About Phone
   - Tap Build Number 7 times
   - Go to Developer Options, enable USB Debugging
3. Build APK in Android Studio or use adb:
   ```bash
   adb install app-debug.apk
   ```

---

## App Configuration

### App Details
- **App ID**: `co.skatryk.trainer`
- **App Name**: `Skatryk Trainer`
- **API Endpoint**: `https://trainer.skatryk.co.ke/api.php`

### Permissions
The app requests:
- **ACCESS_FINE_LOCATION** - For precise geolocation
- **ACCESS_COARSE_LOCATION** - For approximate location
- **INTERNET** - For API calls

These are automatically configured in `AndroidManifest.xml`.

---

## Deploying to Google Play Store

### First Time Setup
1. Create Google Play Developer account at https://play.google.com/console ($25 one-time fee)
2. Create new app listing
3. Fill in store details (description, screenshots, privacy policy, etc.)

### Upload Release APK
1. Go to **Release** section
2. Click **Create new release**
3. Upload signed APK (`app-release.apk`)
4. Review and submit for approval (24-48 hours typically)

### Future Updates
1. Increment version code in `android/app/build.gradle`:
   ```gradle
   android {
       defaultConfig {
           versionCode 2  // Increment this (must be higher)
           versionName "1.1.0"  // Update version string
       }
   }
   ```
2. Build new release APK
3. Upload to Play Store

---

## Troubleshooting

### "Build Failed" Error
```bash
# Clean and rebuild
cd android
./gradlew clean
cd ..

npm run cap:build:android
npm run cap:open:android
```

### "Gradle Sync Failed"
- Go to **File** → **Sync Now** in Android Studio
- Or update Gradle version

### App Shows Blank Screen
- Check Android logcat for errors: **View** → **Tool Windows** → **Logcat**
- Ensure API endpoint is accessible from device
- Verify all network permissions are granted

### "Cannot find Android SDK"
- In Android Studio: **Tools** → **SDK Manager**
- Install API level 24+ (preferably latest)

### Service Worker/PWA Errors (Expected)
✅ **This is normal on Android.** Service workers are disabled by native apps and are only active on web (https://). Your app will work fine.

---

## Quick Commands Reference

```bash
# Development
npm run dev                   # Test on web
npm run build                # Create production build
npm run cap:build:android    # Build + copy + sync (all-in-one)

# Android Workflow
npm run cap:add:android      # First time only
npm run cap:open:android     # Open in Android Studio
npm run cap:copy android     # Copy web assets
npx cap sync android         # Sync plugins & permissions

# Testing
adb install app-debug.apk    # Install APK on device
adb logcat                   # View device logs
```

---

## Next Steps

1. **Install Android Studio** (if not already)
2. **Run**: `npm run cap:open:android`
3. **Wait** for Android Studio to load and index files
4. **Build**: Go to **Build** → **Build APK(s)**
5. **Test**: Install on emulator or device
6. **Deploy**: When ready, build release APK for Play Store

---

## Documentation Links

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Android Studio Guide](https://developer.android.com/studio/intro)
- [Google Play Console](https://play.google.com/console)
- [Android App Signing](https://developer.android.com/studio/publish/app-signing)
