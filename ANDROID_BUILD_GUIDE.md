# Android APK Build Guide for Skatryk Trainer

This guide provides step-by-step instructions to build a production Android APK using Capacitor.

## Prerequisites

1. **Android Studio** - Download from https://developer.android.com/studio
2. **Java Development Kit (JDK)** - JDK 11 or higher
3. **Node.js & npm** - Version 16 or higher
4. **Android SDK** - Installed via Android Studio (API level 24 or higher recommended)

## Environment Configuration

The app is configured to use the production API endpoint:
- **API Endpoint**: `https://trainer.skatryk.co.ke/api.php`
- **App ID**: `co.skatryk.trainer`
- **App Name**: `Skatryk Trainer`

This is already set in:
- `src/lib/api.ts` (default API URL)
- `.env.production` (production build variables)
- `capacitor.config.json` (Capacitor configuration)

## Build Steps

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Build Web Assets for Production
```bash
npm run build
```
This creates the production bundle in the `dist` folder.

### Step 3: Initialize Capacitor (First Time Only)
If you haven't already set up Capacitor:
```bash
npx cap init
```

### Step 4: Add Android Platform (First Time Only)
```bash
npm run cap:add:android
```

### Step 5: Sync Web Assets to Android Project
```bash
npm run cap:copy android
npx cap sync android
```

### Step 6: Open in Android Studio
```bash
npm run cap:open:android
```

This opens the Android project in Android Studio.

## Building Debug APK (for testing)

In Android Studio:
1. Click **Build** in the top menu
2. Select **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. The debug APK will be generated at: `android/app/build/outputs/apk/debug/app-debug.apk`

**To install on device/emulator:**
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## Building Release APK (for production)

### Step 1: Generate a Signing Key (First Time Only)
In Android Studio:
1. Click **Build** → **Generate Signed Bundle / APK**
2. Select **APK** and click **Next**
3. Click **Create new...** to create a new signing key
4. Fill in the details:
   - **Key store path**: Choose a location to save the keystore (e.g., `skatryk-trainer.jks`)
   - **Password**: Create a strong password (save this securely)
   - **Key alias**: e.g., `skatryk-trainer`
   - **Key password**: Same or different from keystore password
   - **Validity**: 25 years or more for production apps
5. Click **Create**

**⚠️ IMPORTANT**: Save the keystore file and passwords securely. You'll need these for future releases.

### Step 2: Build Signed Release APK
In Android Studio:
1. Click **Build** → **Generate Signed Bundle / APK**
2. Select **APK** and click **Next**
3. Select your keystore file
4. Enter your keystore password and key password
5. Select **release** build variant
6. Click **Create**

The release APK will be generated at:
```
android/app/build/outputs/apk/release/app-release.apk
```

## Command Line Release Build (Alternative)

If you prefer using the command line:

```bash
# 1. Build web assets
npm run build

# 2. Sync with Android
npx cap sync android

# 3. Build release APK using Gradle
cd android
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=/path/to/skatryk-trainer.jks \
  -Pandroid.injected.signing.store.password=YOUR_KEYSTORE_PASSWORD \
  -Pandroid.injected.signing.key.alias=skatryk-trainer \
  -Pandroid.injected.signing.key.password=YOUR_KEY_PASSWORD

cd ..
```

APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

## App Permissions

The app requests these Android permissions (already configured):
- **ACCESS_FINE_LOCATION** - For precise geolocation tracking
- **ACCESS_COARSE_LOCATION** - For approximate location
- **INTERNET** - For API communication

These are automatically added to `AndroidManifest.xml` during the Capacitor sync.

## Distribution

### For Testing
- Share the debug APK (`app-debug.apk`) with testers
- Or upload to internal testing track on Google Play Console

### For Production
1. **Google Play Store**:
   - Create a Google Play Developer account ($25 one-time fee)
   - Create an app listing
   - Upload the signed release APK
   - Fill in store listing details, screenshots, etc.
   - Submit for review

2. **Direct Distribution**:
   - Host the APK on your website
   - Users can download and install directly (requires "Unknown sources" permission)

## Troubleshooting

### "Build Failed" Errors
```bash
# Clean build
cd android
./gradlew clean
cd ..

# Rebuild
npm run build
npx cap sync android
```

### Gradle Issues
```bash
# Update Gradle wrapper
cd android
./gradlew wrapper --gradle-version=8.0
cd ..
```

### API Connection Issues
- Verify `https://trainer.skatryk.co.ke/api.php` is accessible
- Check device has internet connectivity
- Review console logs in Android Studio for network errors

### Signing Errors
- Ensure keystore file exists and password is correct
- Check keystore hasn't expired (shouldn't be an issue with 25-year validity)

## Version Updates

### Incrementing Version for New Release
Edit `android/app/build.gradle`:
```gradle
android {
    ...
    defaultConfig {
        ...
        versionCode 2  // Increment this (must increase)
        versionName "1.1.0"  // Update version string
    }
}
```

### Build Commands After Version Change
```bash
npm run build
npx cap sync android
# Then build as described above
```

## Notes

- Always build with `npm run build` before syncing to Android
- Sync with `npx cap sync android` after code or dependency changes
- Test the debug APK on actual devices before releasing
- The API endpoint can be changed in `src/lib/api.ts` if needed
- Keep your signing keystore secure and backed up

## Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Studio Guide](https://developer.android.com/studio/intro)
- [Google Play Console](https://play.google.com/console)
- [Android App Signing](https://developer.android.com/studio/publish/app-signing)
