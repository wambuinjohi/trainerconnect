# Android App Links and assetlinks.json Setup

This guide explains how to set up Android App Links (also known as Digital Asset Links) for your APK so users can open URLs in your app.

---

## What Are Android App Links?

Android App Links allow your app to handle specific URLs (like `https://trainer.skatryk.co.ke/`) directly. When users click links to your domain:

1. **With App Links**: Opens directly in your app (no browser prompt)
2. **Without App Links**: Browser asks "Open with app?" or opens in browser

---

## Step 1: Get Your App's SHA256 Fingerprint

The SHA256 fingerprint uniquely identifies your app and signing key.

### Option A: Get from Android Studio (Recommended)

1. Open your Android project in Android Studio
2. **View** → **Tool Windows** → **Gradle** (or click Gradle icon on right)
3. Expand: **Tasks** → **android** → **signingReport**
4. Double-click **signingReport**
5. Check the **Gradle** output panel

You should see:
```
Variant: release
Config: release
Store: /path/to/skatryk-trainer.jks
Alias: skatryk-trainer
MD5: XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
SHA1: XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
SHA-256: XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
```

**Copy the SHA-256 value** (remove colons for assetlinks.json):
```
Original:  AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99
For JSON:  AABBCCDDEEFF00112233445566778899AABBCCDDEEFF00112233445566778899
```

### Option B: Get from Keystore Using Command Line

```bash
# Using keytool (included with Java)
keytool -list -v -keystore /path/to/skatryk-trainer.jks

# Enter keystore password when prompted
# Look for "SHA256:" in output
```

### Option C: Get from Built APK

```bash
# Extract cert from release APK
unzip -p android/app/build/outputs/apk/release/app-release.apk \
  META-INF/CERT.RSA | keytool -printcert -v -file /dev/stdin

# Look for "SHA256:" in output
```

---

## Step 2: Update assetlinks.json

Edit `public/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "co.skatryk.trainer",
      "sha256_cert_fingerprints": [
        "AABBCCDDEEFF00112233445566778899AABBCCDDEEFF00112233445566778899"
      ]
    }
  }
]
```

**Replace** `AABBCCDDEEFF00112233445566778899AABBCCDDEEFF00112233445566778899` with your actual SHA-256 fingerprint.

---

## Step 3: Deploy assetlinks.json to Your Server

The file must be accessible at:
```
https://trainer.skatryk.co.ke/.well-known/assetlinks.json
```

### Using cPanel/Web Hosting

1. Login to cPanel or file manager
2. Navigate to public root (`public_html` or similar)
3. Create folder: `.well-known` (starts with dot)
4. Upload `assetlinks.json` into `.well-known/` folder
5. Verify: Visit `https://trainer.skatryk.co.ke/.well-known/assetlinks.json` in browser

### Using Linux/SSH Server

```bash
# SSH into your server
ssh user@trainer.skatryk.co.ke

# Create the directory
mkdir -p /var/www/skatryk/.well-known

# Copy the file
scp public/.well-known/assetlinks.json \
  user@trainer.skatryk.co.ke:/var/www/skatryk/.well-known/

# Verify permissions
chmod 644 /var/www/skatryk/.well-known/assetlinks.json

# Test
curl https://trainer.skatryk.co.ke/.well-known/assetlinks.json
```

### Using FTP

1. Connect to FTP: `ftp.trainer.skatryk.co.ke`
2. Create folder `.well-known` in root
3. Upload `assetlinks.json` into `.well-known/`

---

## Step 4: Verify Setup

### Test in Android Studio

1. Open your app project in Android Studio
2. **Tools** → **App Links Assistant**
3. Click **Open URL Mapping Editor**
4. Add mapping: `https://trainer.skatryk.co.ke/`
5. Click **Verify** or **Test**

Android will test the app links setup.

### Command Line Verification

```bash
# Check if assetlinks.json is accessible
curl -I https://trainer.skatryk.co.ke/.well-known/assetlinks.json

# Should return HTTP 200

# View content
curl https://trainer.skatryk.co.ke/.well-known/assetlinks.json
```

### On Device/Emulator

```bash
# Install the app
adb install app-release.apk

# Open a link from your app domain
adb shell am start -a android.intent.action.VIEW \
  -d https://trainer.skatryk.co.ke/

# Should open in your app, not browser
```

---

## Step 5: Update AndroidManifest.xml (Optional)

If you want to handle specific routes, edit `android/app/src/main/AndroidManifest.xml`:

```xml
<activity
    android:name=".MainActivity"
    ...>
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        
        <data
            android:scheme="https"
            android:host="trainer.skatryk.co.ke"
            android:pathPrefix="/" />
    </intent-filter>
</activity>
```

**Note**: `android:autoVerify="true"` tells Android to verify app links at install time.

---

## Troubleshooting

### assetlinks.json returns 404

**Problem**: File not found at expected location

**Solution**:
```bash
# Check file exists
ls -la /var/www/skatryk/.well-known/assetlinks.json

# Check web server is serving it
curl -v https://trainer.skatryk.co.ke/.well-known/assetlinks.json

# Check .well-known folder permissions
chmod 755 /var/www/skatryk/.well-known
chmod 644 /var/www/skatryk/.well-known/assetlinks.json
```

### assetlinks.json returns 403 Forbidden

**Problem**: Web server denies access

**Solution**:
```bash
# Check folder permissions (should be executable)
chmod 755 /var/www/skatryk/.well-known

# Check file permissions (should be readable)
chmod 644 /var/www/skatryk/.well-known/assetlinks.json

# Check nginx/Apache is configured to serve hidden files
# In nginx: try_files $uri $uri/ =404;
# In Apache: <FilesMatch "^\.">
#   Require all granted
# </FilesMatch>
```

### Wrong SHA256 fingerprint

**Problem**: SHA256 in assetlinks.json doesn't match app's key

**Solution**:
1. Extract fingerprint again using keytool
2. **Remove colons** and use uppercase
3. Update assetlinks.json
4. Rebuild and sign APK with same keystore
5. Redeploy assetlinks.json
6. Reinstall app

### App still opens in browser instead of app

**Problem**: App links not verified

**Solution**:
```bash
# Clear app cache
adb shell pm clear co.skatryk.trainer

# Reinstall app
adb install -r app-release.apk

# Test again
adb shell am start -a android.intent.action.VIEW -d https://trainer.skatryk.co.ke/
```

---

## Multiple Domains (Optional)

If your app uses multiple domains, add multiple entries:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "co.skatryk.trainer",
      "sha256_cert_fingerprints": [
        "AABBCCDDEEFF00112233445566778899AABBCCDDEEFF00112233445566778899"
      ]
    }
  }
]
```

**Each domain** must have its own `.well-known/assetlinks.json`:
- `https://trainer.skatryk.co.ke/.well-known/assetlinks.json`
- `https://example.com/.well-known/assetlinks.json`

Each file should contain the same JSON.

---

## Multiple Apps from Same Domain (Optional)

If you have multiple apps from the same domain, add multiple apps:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "co.skatryk.trainer",
      "sha256_cert_fingerprints": [
        "FINGERPRINT_FOR_TRAINER_APP"
      ]
    }
  },
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "co.skatryk.admin",
      "sha256_cert_fingerprints": [
        "FINGERPRINT_FOR_ADMIN_APP"
      ]
    }
  }
]
```

---

## App Links vs Regular Intent Filters

| Feature | App Links | Regular Intent Filter |
|---------|-----------|----------------------|
| Verification | Yes (automatic) | No |
| Requires assetlinks.json | Yes | No |
| Browser prompt | No | Yes (sometimes) |
| One-tap opening | Yes | No (asks user) |
| Setup complexity | Medium | Easy |
| Recommended | Yes | Only for testing |

---

## FAQ

**Q: Do I need app links?**
A: Not required, but strongly recommended. Better user experience.

**Q: Can I update the fingerprint later?**
A: Yes, but you must sign releases with the same keystore forever.

**Q: What if I lose my keystore?**
A: You can't update the app. You'd need a new package ID (`co.skatryk.trainer.v2`).

**Q: How often do I update assetlinks.json?**
A: Only when adding/removing apps or changing keys (rarely).

**Q: Is assetlinks.json public?**
A: Yes, it's intentionally public for app verification.

---

## Summary

1. Get your app's SHA-256 fingerprint from Android Studio or keytool
2. Update `public/.well-known/assetlinks.json` with your fingerprint
3. Deploy to `https://trainer.skatryk.co.ke/.well-known/assetlinks.json`
4. Verify with curl or Android Studio App Links Assistant
5. Reinstall app on device to verify app links work

The setup is one-time and rarely needs updates.
