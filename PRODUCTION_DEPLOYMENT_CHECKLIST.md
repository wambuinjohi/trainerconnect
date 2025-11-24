# Production Deployment Checklist

## ✅ What's Ready

- [x] PWA installation prompt component (mobile)
- [x] API fallback system (`/api.php`)
- [x] API status monitoring hook
- [x] Service worker (already present)
- [x] PWA manifest (already present)
- [x] All 50+ API functions support fallback
- [x] Dev server running without errors
- [x] Full documentation provided

---

## 🎯 Before Going Live

### Phase 1: Prepare Icons (REQUIRED)

**Time**: ~5 minutes

```bash
# Install converter
npm install -g svgexport

# Convert all icons
svgexport public/icons/icon-192x192.svg public/icons/icon-192x192.png 192:192
svgexport public/icons/icon-512x512.svg public/icons/icon-512x512.png 512:512
svgexport public/icons/icon-maskable-192x192.svg public/icons/icon-maskable-192x192.png 192:192
svgexport public/icons/icon-maskable-512x512.svg public/icons/icon-maskable-512x512.png 512:512
```

**Verify**:
- [ ] PNG files created in `public/icons/`
- [ ] PNG files are 192x192 and 512x512
- [ ] Both regular and maskable variants present

---

### Phase 2: Local Testing (REQUIRED)

**Time**: ~15 minutes

```bash
# Build
npm run build

# Run preview
npm run preview

# Visit: http://localhost:4173
```

**Test on Android Device**:
- [ ] Install prompt appears at bottom
- [ ] Click "Install" button
- [ ] App installs to home screen
- [ ] App launches in full-screen mode
- [ ] No browser UI visible
- [ ] Navigation works offline

**Test on iOS Device**:
- [ ] No auto-install prompt (expected)
- [ ] Check manual install guide appears
- [ ] Follow manual installation steps
- [ ] App installs to home screen
- [ ] App launches in full-screen mode

**Test Offline Mode**:
- [ ] Install PWA on device
- [ ] Turn off network
- [ ] App loads cached content
- [ ] Navigation works
- [ ] API calls fail gracefully with message

**Test Service Worker**:
- [ ] DevTools → Application → Service Workers
- [ ] Should show "registered"
- [ ] Turn on offline mode
- [ ] Reload page
- [ ] Should still work

---

### Phase 3: API Endpoint Verification (REQUIRED)

**Time**: ~10 minutes

**Verify Primary Endpoint**:
```bash
# Check if accessible
curl -X POST https://trainer.skatryk.co.ke/api.php \
  -H "Content-Type: application/json" \
  -d '{"action":"health_check"}'
```

**Verify Fallback Endpoint**:
```bash
# Check if /api.php works on same domain
curl -X POST /api.php \
  -H "Content-Type: application/json" \
  -d '{"action":"health_check"}'
```

**Verify Both Return Valid Responses**:
- [ ] Primary endpoint responds
- [ ] Fallback endpoint responds
- [ ] Both return valid JSON
- [ ] Response has `status: 'success'`

---

### Phase 4: HTTPS & Certificate Check (REQUIRED)

**Time**: ~5 minutes

**Verify HTTPS**:
- [ ] Domain has valid HTTPS certificate
- [ ] Certificate is not expired
- [ ] Certificate is trusted (not self-signed)
- [ ] No browser warnings on page load

**Check Certificate**:
```bash
openssl s_client -connect trainer.skatryk.co.ke:443
# Look for: "Verify return code: 0 (ok)"
```

---

### Phase 5: Pre-Deployment Build (REQUIRED)

**Time**: ~10 minutes

```bash
# Clean build
npm run build

# Verify no errors
# Check for: "built in Xs"
```

**Verify Build Output**:
- [ ] `dist/` folder created
- [ ] `index.html` present
- [ ] `manifest.webmanifest` present
- [ ] `sw.js` present
- [ ] `icons/` folder with PNG files
- [ ] No build errors or warnings

---

## 🚀 Deployment Steps

### Step 1: Build

```bash
npm run build
```

**Verify**:
- [ ] Build completes without errors
- [ ] `dist/` folder created
- [ ] All expected files present

---

### Step 2: Deploy to Production

Upload `dist/` folder contents to your web server:

```bash
# Example with scp
scp -r dist/* user@trainer.skatryk.co.ke:/var/www/skatryk/

# Verify files on server
ssh user@trainer.skatryk.co.ke ls -la /var/www/skatryk/
```

**Required Files**:
- [ ] `index.html`
- [ ] `manifest.webmanifest`
- [ ] `sw.js`
- [ ] `icons/` folder with PNG files
- [ ] All bundled JS/CSS files
- [ ] `/api.php` endpoint exists and works

---

### Step 3: Verify Deployment

```bash
# Check manifest loads
curl https://trainer.skatryk.co.ke/manifest.webmanifest | jq .

# Check service worker
curl https://trainer.skatryk.co.ke/sw.js | head -20

# Check API
curl -X POST https://trainer.skatryk.co.ke/api.php \
  -d '{"action":"health_check"}'
```

**Verify in Browser**:
- [ ] https://trainer.skatryk.co.ke loads
- [ ] No console errors
- [ ] DevTools → Application → Manifest loads
- [ ] DevTools → Application → Service Workers shows "registered"
- [ ] Icons display correctly

---

### Step 4: Test on Mobile (Post-Deployment)

**On Android Device**:
- [ ] Visit https://trainer.skatryk.co.ke
- [ ] "Install" prompt appears
- [ ] Click install
- [ ] App appears on home screen
- [ ] Click app icon
- [ ] App launches in standalone mode
- [ ] Logo/icon visible in app

**On iOS Device**:
- [ ] Visit https://trainer.skatryk.co.ke
- [ ] Tap Share button
- [ ] Tap "Add to Home Screen"
- [ ] App appears on home screen
- [ ] Click app icon
- [ ] App launches in standalone mode

---

### Step 5: Test API Functionality

**Test API Calls**:
- [ ] Login works
- [ ] Bookings load
- [ ] User profile updates
- [ ] All CRUD operations work
- [ ] Check console for "Primary API endpoint failed" logs
- [ ] No API errors in console

**Monitor API Fallback**:
- [ ] Check browser console
- [ ] Look for fallback logs (if any)
- [ ] Verify primary endpoint being used
- [ ] Check server logs for API calls

---

## 📊 Post-Deployment Monitoring

### First 24 Hours

- [ ] Monitor server logs for errors
- [ ] Check for API call failures
- [ ] Monitor installation requests
- [ ] Check for service worker errors
- [ ] Review user feedback

### First Week

- [ ] Track PWA installation count
- [ ] Monitor API fallback triggers
- [ ] Collect user feedback
- [ ] Review analytics
- [ ] Check performance metrics

### Ongoing

- [ ] Monitor installation rates trend
- [ ] Track API reliability metrics
- [ ] Review error logs weekly
- [ ] Update cache strategy if needed
- [ ] Plan future PWA enhancements

---

## 🔍 Testing Scenarios

### Scenario 1: Normal Installation

1. User visits on mobile
2. Sees "Install App" banner
3. Clicks "Install"
4. App installs
5. ✅ Expected: App works normally

---

### Scenario 2: API Fallback

1. User makes API call
2. Primary endpoint unavailable
3. Fallback endpoint used automatically
4. ✅ Expected: Call succeeds with `/api.php`

---

### Scenario 3: Offline Mode

1. User has PWA installed
2. User disconnects internet
3. User navigates app
4. ✅ Expected: Cached content loads

---

### Scenario 4: Reinstall

1. User uninstalls PWA
2. User reinstalls PWA
3. Install prompt shown again
4. ✅ Expected: Fresh install, no conflicts

---

## ⚠️ Troubleshooting

### Install Prompt Not Showing

**Checklist**:
- [ ] Device is mobile (Android/iOS)
- [ ] HTTPS is enabled
- [ ] Icons are PNG (not SVG)
- [ ] Manifest is valid
- [ ] Cache is cleared

**Fix**:
1. Verify PNG icons are deployed
2. Clear browser cache
3. Hard reload (Cmd+Shift+R)
4. Check DevTools for errors

### API Calls Failing

**Checklist**:
- [ ] Primary endpoint accessible
- [ ] `/api.php` exists and responds
- [ ] Network connectivity ok
- [ ] No CORS errors

**Check**:
```bash
# Test endpoints
curl https://trainer.skatryk.co.ke/api.php
curl /api.php
```

### Service Worker Not Registering

**Checklist**:
- [ ] HTTPS enabled (or localhost)
- [ ] `sw.js` file exists
- [ ] Browser cache cleared
- [ ] No console errors

**Fix**:
1. Hard reload (Cmd+Shift+R)
2. Check DevTools → Application → Service Workers
3. Check console for errors
4. Verify sw.js file deployed

---

## 📋 Sign-Off Checklist

### Technical Lead
- [ ] Code reviewed
- [ ] No breaking changes
- [ ] All tests pass
- [ ] Documentation complete

### QA Team
- [ ] Android testing complete
- [ ] iOS testing complete
- [ ] Offline functionality works
- [ ] API fallback tested
- [ ] No blocking issues found

### Operations
- [ ] Server configured
- [ ] HTTPS certificate valid
- [ ] `/api.php` endpoint working
- [ ] Monitoring configured
- [ ] Backup plan ready

### Product Owner
- [ ] Requirements met
- [ ] User experience acceptable
- [ ] Performance acceptable
- [ ] Ready for launch

---

## 📞 Support Contacts

**If Issues Occur**:

1. **Check Documentation**:
   - PWA_AUDIT_REPORT.md - Full details
   - PWA_QUICK_REFERENCE.md - Quick answers
   - CODE_CHANGES_REFERENCE.md - Code changes

2. **Check Logs**:
   - Browser console (DevTools)
   - Server error logs
   - Network requests (DevTools → Network)

3. **Debug Steps**:
   - Clear cache and reload
   - Hard refresh (Cmd+Shift+R)
   - Test in private/incognito mode
   - Test on different device

---

## 🎉 Go Live!

Once all checklist items are complete:

```
✅ Icons converted to PNG
✅ Local testing passed
✅ API endpoints verified
✅ HTTPS certificate valid
✅ Build successful
✅ Deployment verified
✅ Mobile testing passed
✅ API functionality works
✅ Monitoring configured
✅ Sign-offs complete

🚀 READY FOR PRODUCTION LAUNCH!
```

---

## Timeline Estimate

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Icon conversion | 5 min | ⏳ TODO |
| 2 | Local testing | 15 min | ⏳ TODO |
| 3 | API verification | 10 min | ⏳ TODO |
| 4 | HTTPS check | 5 min | ⏳ TODO |
| 5 | Build | 10 min | ⏳ TODO |
| 6 | Deploy | 10 min | ⏳ TODO |
| 7 | Post-deploy test | 20 min | ⏳ TODO |
| **Total** | | **75 min** | |

**Estimated Go-Live**: ~2 hours from start

---

## Success Criteria

✅ **PWA Installation Works**:
- Install prompt appears on mobile
- One-click installation works
- App icon on home screen
- App launches in standalone mode

✅ **API Works Reliably**:
- All API calls succeed
- Fallback works if primary fails
- No API errors in console
- Response times acceptable

✅ **Offline Support**:
- App loads when offline
- Cached content available
- Graceful error messages
- No blank screens

✅ **Performance**:
- App loads in < 3 seconds
- No console errors
- Service worker caches assets
- Battery usage reasonable

✅ **User Experience**:
- No confusing prompts
- Clear install instructions
- Smooth navigation
- Professional appearance

---

**Deployment Checklist Version**: 1.0
**Last Updated**: November 24, 2024
**Status**: Ready for Production
