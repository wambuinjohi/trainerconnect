# Android APK Image Loading - Testing Guide

## Quick Test Checklist

### Phase 1: Backend Verification (5 minutes)

**1. Verify API Responses Return Absolute URLs**

```bash
# Test profile image URL in API response
curl -X POST https://trainer.skatryk.co.ke/api.php \
  -H "Content-Type: application/json" \
  -d '{
    "action": "profile_get",
    "user_id": "YOUR_TRAINER_USER_ID"
  }' | jq '.data.profile_image'
```

Expected output:
```
"https://trainer.skatryk.co.ke/uploads/file_123456.jpg"
```

❌ Wrong (relative path):
```
"/uploads/file_123456.jpg"
```

**2. Test File Upload Endpoint**

Upload a test image via the trainer profile editor and verify:
- API returns absolute URL in response
- Check browser DevTools → Network tab
- Look for upload response with `url` field containing full domain

### Phase 2: Web Browser Testing (10 minutes)

**1. Test on Web (npm run dev)**

```bash
npm run dev
# Navigate to http://localhost:5173
```

Steps:
1. Go to trainer listing page (/explore)
2. Click on any trainer card
3. ✅ Verify profile photo displays in modal
4. Click "Edit Profile" (if trainer)
5. ✅ Verify profile photo preview shows in editor
6. Upload new profile photo
7. ✅ Image should display immediately after upload
8. Check browser DevTools → Network tab
9. ✅ All image requests should be to `https://trainer.skatryk.co.ke/uploads/...`

**Expected Results:**
- ✅ All profile images visible
- ✅ No broken image icons
- ✅ No 404 errors in console
- ✅ No mixed content warnings (all HTTPS)

### Phase 3: Android APK Testing (15 minutes)

**Setup:**

```bash
# Build production bundle
npm run build

# Sync with Android
npx cap sync android

# Open in Android Studio
npm run cap:open:android
```

**In Android Studio:**
1. Select "Build" → "Generate Signed Bundle / APK"
2. Build release APK
3. Install on device/emulator

**Testing Steps:**

1. **Launch APK on Android Device/Emulator**
   - Start the app
   - Wait for initial load (30 seconds)

2. **Test Trainer Listing Page**
   - Navigate to trainer listing
   - ✅ Verify trainer profile photos appear
   - ✅ Images should load within 5 seconds
   - ✅ No placeholder/broken images

3. **Test Trainer Details Modal**
   - Click on trainer card
   - ✅ Verify profile photo shows in modal
   - ✅ Image quality should be clear
   - Close and open another trainer
   - ✅ All trainers show photos

4. **Test Profile Upload (if Trainer Account)**
   - Sign in as trainer
   - Go to edit profile
   - ✅ Verify existing profile photo displays
   - Upload new profile photo
   - ✅ Image should display in preview immediately
   - ✅ Photo persists after page reload

5. **Test Network Activity**
   - Open Chrome DevTools via `chrome://inspect/#devices`
   - Watch Network tab while browsing trainers
   - ✅ Image requests should show URLs like:
     ```
     https://trainer.skatryk.co.ke/uploads/file_*.jpg
     ```
   - ✅ All requests should be HTTP 200 (success)
   - ✅ No 404 or network errors

6. **Test Error Handling**
   - Intentionally delete an image file from server
   - Navigate to that trainer's profile
   - ✅ No broken image icon should appear
   - ✅ Fallback emoji/icon should show instead

### Phase 4: Stress Testing (Optional)

1. **Many Trainers**
   - Scroll through full trainer list (50+ trainers)
   - ✅ All images should load
   - ✅ No memory issues
   - ✅ No app crashes

2. **Slow Network**
   - Use Android emulator network throttling
   - Simulate 3G/slow connection
   - ✅ Images should eventually load
   - ✅ App shouldn't freeze

3. **Offline + Online**
   - Go offline (flight mode)
   - Try to load trainer page
   - Images shouldn't load (expected)
   - Go online
   - ✅ Images should load when connection restored

## Debugging - If Tests Fail

### Images Not Showing in APK

**Step 1: Check API Responses**
```bash
# On your server
tail -f /var/log/apache2/access.log

# Watch for image requests - should be 200 OK
# Example:
# GET /uploads/file_123.jpg 200
```

**Step 2: Check Capacitor WebView**
```
adb logcat | grep -i image
adb logcat | grep -i http
```

**Step 3: Inspect Capacitor Config**
```bash
cat capacitor.config.json
```

Should show:
```json
{
  "appId": "co.skatryk.trainer",
  "webDir": "dist",
  "server": {
    "androidScheme": "https"
  }
}
```

**Step 4: Verify HTTPS**
```bash
curl -v https://trainer.skatryk.co.ke/api.php
```
Should return HTTP 200 with JSON response

### Relative URLs Still in Database

If you see `/uploads/` in API responses:

```bash
# Check database directly
SELECT user_id, profile_image FROM user_profiles LIMIT 5;
```

- ✅ Good: `https://trainer.skatryk.co.ke/uploads/file_123.jpg`
- ❌ Bad: `/uploads/file_123.jpg`

**Fix:** Automatic conversion happens in PHP via `makeImageUrlAbsolute()` function. Database doesn't need to change immediately.

### Mixed Content Warnings

If you see "Mixed content" errors:
- APK uses HTTPS scheme (configured ✓)
- API must be HTTPS (it is ✓)
- Images must be served via HTTPS (they are ✓)

### CORS/Network Issues

Check browser console:
```javascript
// This should work in APK
fetch('https://trainer.skatryk.co.ke/uploads/file.jpg')
  .then(r => r.blob())
  .then(blob => console.log('Image loaded!'))
```

## Test Case Summary

| Test | Web | APK | Status |
|------|-----|-----|--------|
| Profile images load | ✅ | ✅ | **MUST PASS** |
| Image upload works | ✅ | ✅ | **MUST PASS** |
| Absolute URLs in API | ✅ | ✅ | **MUST PASS** |
| No 404 errors | ✅ | ✅ | **MUST PASS** |
| Error handling works | ✅ | ✅ | Nice to have |
| Slow network works | N/A | ✅ | Nice to have |

## Success Criteria

✅ **PASS** if:
- All trainer profile photos visible in APK
- Image uploads work and display immediately
- No console errors related to images
- All image URLs are absolute (https://...)
- No broken image icons

❌ **FAIL** if:
- Any trainer shows broken image icon
- Uploaded images don't display
- Console shows 404 or "Cannot GET /uploads/..."
- Mixed content warnings appear
- Trainer list crashes

## Performance Benchmarks

- Image load time: < 3 seconds (depends on image size & network)
- Trainer listing: < 2 seconds to populate
- Image upload: < 5 seconds including preview display
- Zero memory leaks when scrolling

## Reporting Results

When testing, provide:
```
Web Testing:
- Date tested: ___
- Device/Browser: ___
- Images loaded: YES/NO
- No errors: YES/NO

APK Testing:
- Device: (emulator/physical)
- Android version: ___
- Images loaded: YES/NO
- Uploads work: YES/NO
- Network requests: (paste example)

Issues found:
- ...
```

---

**Ready to Test!** Follow the phases above and report results. 🚀
