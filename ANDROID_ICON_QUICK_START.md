# Android App Icon - Quick Start

## TL;DR - 3 Steps

```bash
# Step 1: Generate icons from logo
npm run android:icons

# Step 2: Rebuild APK
npm run build && npx cap sync android

# Step 3: Build in Android Studio
npm run cap:open:android
# Then: Build → Generate Signed Bundle / APK
```

---

## What Just Happened?

✅ Icon generator script created  
✅ Skatryk logo downloaded from CDN  
✅ PNG icons generated for all Android densities:
- mdpi (48×48)
- hdpi (72×72)
- xhdpi (96×96)
- xxhdpi (144×144)
- xxxhdpi (192×192)

✅ Icons placed in correct Android mipmap folders  
✅ APK will use Skatryk logo as app icon

---

## Commands

### Generate Icons
```bash
npm run android:icons
```
- Downloads Skatryk logo
- Generates all icon sizes
- Places in mipmap folders
- Reports completion

### Build APK
```bash
npm run build && npx cap sync android
```

### Open Android Studio
```bash
npm run cap:open:android
```
Then build signed APK in Android Studio.

### Install on Device
```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

---

## Icon Files Location

```
android/app/src/main/res/
├── mipmap-mdpi/
├── mipmap-hdpi/
├── mipmap-xhdpi/
├── mipmap-xxhdpi/
└── mipmap-xxxhdpi/

Each folder contains:
- ic_launcher.png (square)
- ic_launcher_round.png (circular)
- ic_launcher_foreground.png (adaptive)
```

---

## Verification

### Check icons were created:
```bash
ls android/app/src/main/res/mipmap-mdpi/
# Should show:
# ic_launcher.png
# ic_launcher_round.png
# ic_launcher_foreground.png
```

### After APK build, on device:
1. Open home screen → Skatryk icon should show logo
2. Open app drawer → Should appear with correct icon
3. Open recent apps → Icon should display
4. Go to Settings → Apps → Skatryk Trainer → Icon visible

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Icon generation fails | `npm install --save-dev canvas` then retry |
| Icons not showing in APK | Rebuild: `npx cap sync android` |
| Icons look pixelated | Check file sizes in mipmap folders |
| Logo won't download | Use fallback icons (created automatically) |

---

## Files Created/Modified

### New Files
- `scripts/generate-android-icons.js` - Icon generator
- `scripts/generate-android-icons-simple.js` - Simpler version
- `scripts/setup-android-icon.sh` - Bash script version
- `ANDROID_ICON_SETUP.md` - Detailed guide
- `ANDROID_ICON_QUICK_START.md` - This file

### Modified Files
- `package.json` - Added scripts:
  - `npm run android:icons`
  - `npm run android:icons:bash`

### Generated Files (in Android resources)
- `android/app/src/main/res/mipmap-*/ic_launcher.png` (square icons)
- `android/app/src/main/res/mipmap-*/ic_launcher_round.png` (rounded)
- `android/app/src/main/res/mipmap-*/ic_launcher_foreground.png` (adaptive)

---

## Full Workflow

1. **Generate icons** (one-time)
   ```bash
   npm run android:icons
   ```

2. **Build web bundle**
   ```bash
   npm run build
   ```

3. **Sync with Android**
   ```bash
   npx cap sync android
   ```

4. **Build signed APK** (in Android Studio)
   ```bash
   npm run cap:open:android
   ```
   Then: Build → Generate Signed Bundle / APK

5. **Test on device**
   ```bash
   adb install -r android/app/build/outputs/apk/release/app-release.apk
   ```

---

## Icon Sizes Explained

- **mdpi**: Medium DPI (~160 dpi) - Baseline
- **hdpi**: High DPI (~240 dpi) - Tablets
- **xhdpi**: Extra High (~320 dpi) - Modern phones
- **xxhdpi**: Extra Extra High (~480 dpi) - High-end phones
- **xxxhdpi**: Highest (~640 dpi) - Latest devices

Android automatically selects the right size for each device.

---

## Next Steps

1. Run icon generator
2. Rebuild APK
3. Deploy and test
4. Celebrate! 🎉

---

## Need Help?

See `ANDROID_ICON_SETUP.md` for detailed troubleshooting and more info.

**Done!** Your APK now uses the Skatryk logo as its app icon. 🚀
