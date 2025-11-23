# Android APK Quick Build Reference

## Quick Build Commands

### First Time Setup
```bash
npm install
npm run build
npm run cap:add:android
npm run cap:sync
npm run cap:open:android
```

### Debug APK (Testing)
```bash
npm run build
npm run cap:copy android
npx cap sync android
npm run cap:open:android
# Then in Android Studio: Build > Build APK(s)
# APK location: android/app/build/outputs/apk/debug/app-debug.apk
```

### Release APK (Production)
```bash
npm run build
npm run cap:copy android
npx cap sync android
npm run cap:open:android
# Then in Android Studio: Build > Generate Signed Bundle / APK > APK > Create/Select keystore
# APK location: android/app/build/outputs/apk/release/app-release.apk
```

## One-Liner Scripts

Add these to your `package.json` for convenience:

```json
{
  "scripts": {
    "android:setup": "npm install && npm run build && npm run cap:add:android && npm run cap:sync",
    "android:debug": "npm run build && npm run cap:copy android && npx cap sync android && npm run cap:open:android",
    "android:release": "npm run build && npm run cap:copy android && npx cap sync android && npm run cap:open:android"
  }
}
```

Then run:
```bash
npm run android:setup    # First time only
npm run android:debug    # For testing
npm run android:release  # For production (opens Android Studio)
```

## Key Configuration

- **API Endpoint**: `https://trainer.skatryk.co.ke/api.php`
- **App ID**: `co.skatryk.trainer`
- **App Name**: `Skatryk Trainer`
- **Permissions**: Geolocation (ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION)

## Essential Files

- `capacitor.config.json` - Capacitor app configuration ✓ Already configured
- `.env.production` - Production environment variables ✓ Already configured
- `src/lib/api.ts` - Default API endpoint ✓ Set to trainer.skatryk.co.ke
- `android/app/build.gradle` - Android build configuration

## Checklist Before Release

- [ ] Code changes tested in web app (npm run dev)
- [ ] Production build created (npm run build)
- [ ] No build errors
- [ ] Capacitor synced (npx cap sync android)
- [ ] Tested on Android emulator or device
- [ ] Version code incremented in `android/app/build.gradle`
- [ ] Signing keystore created and secured (first release only)
- [ ] Signed APK generated
- [ ] APK tested on device before distribution

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Build fails | Run `cd android && ./gradlew clean && cd ..` then retry |
| API not connecting | Check device has internet, verify `trainer.skatryk.co.ke` is accessible |
| Geolocation permission denied | User must grant location permission at runtime |
| Signing key not found | Ensure keystore file path is correct in Android Studio build dialog |
| Version won't update | Increment `versionCode` in `android/app/build.gradle` |

## For More Details

See `ANDROID_BUILD_GUIDE.md` for comprehensive build instructions.
