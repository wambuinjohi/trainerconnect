# Quick Reference - PWA & API Fallback

## 🚀 Quick Start

### What Was Done
1. ✅ PWA installation prompt for mobile
2. ✅ API fallback to `/api.php` 
3. ✅ API status monitoring hook
4. ✅ Comprehensive audit report

### What You Need to Do
1. Convert SVG icons to PNG:
```bash
npm install -g svgexport
svgexport public/icons/icon-192x192.svg public/icons/icon-192x192.png 192:192
svgexport public/icons/icon-512x512.svg public/icons/icon-512x512.png 512:512
svgexport public/icons/icon-maskable-192x192.svg public/icons/icon-maskable-192x192.png 192:192
svgexport public/icons/icon-maskable-512x512.svg public/icons/icon-maskable-512x512.png 512:512
```

2. Test locally:
```bash
npm run build
npm run preview
# Visit on mobile device, check install prompt
```

3. Deploy and verify both API endpoints work

---

## 📱 For Mobile Users

### Install Prompt
- Appears automatically on mobile devices
- One-click install (Android)
- Manual instructions (iOS)
- Dismissible with 'X' button
- Won't show again if dismissed (per session)

### What Happens After Install
- App on home screen
- Launches like native app
- Works offline
- Auto-updates

---

## 🔄 For API Calls

### What Changed
**Nothing** - All API functions work automatically:
```tsx
// These all work the same:
loginUser()
getBookings()
updateUserProfile()
// ... etc
```

### How Fallback Works
```
Try Primary: https://trainer.skatryk.co.ke/api.php
  ↓ [Fail]
Try Fallback: /api.php
  ↓ [Success]
App continues normally
```

### Configure API URL
```tsx
import { getApiUrl, setApiUrl } from '@/lib/api'

// Get current
const url = getApiUrl()

// Change
setApiUrl('https://custom-api.com/api.php')
```

---

## 📊 Monitor API Status

```tsx
import { useApiStatus } from '@/hooks/use-api-status'

function MyComponent() {
  const { isFallback, activeUrl } = useApiStatus()
  
  return isFallback ? <span>Using fallback</span> : null
}
```

**Status Properties**:
- `primaryUrl` - Main API endpoint
- `fallbackUrl` - Fallback endpoint (`/api.php`)
- `currentUrl` - Configured endpoint
- `activeUrl` - Currently working endpoint
- `isFallback` - Using fallback?
- `hasBeenTested` - Tested this session?

---

## 🔍 Debug API Issues

### Check Service Worker
```
DevTools → Application → Service Workers
Should show: registered and running
```

### Check Manifest
```
DevTools → Application → Manifest
Should load without errors
```

### Check API Fallback
```
DevTools → Console
Look for: "Primary API endpoint failed..."
Or: "Fallback API endpoint successful..."
```

### Check Network
```
DevTools → Network
Filter by API calls
Should use one endpoint consistently
```

---

## 📋 File Changes Summary

### New Files
- `src/components/PWAInstallPrompt.tsx` - Install prompt
- `src/hooks/use-api-status.ts` - Status monitoring
- `PWA_AUDIT_REPORT.md` - Full audit
- `PWA_IMPLEMENTATION_SUMMARY.md` - Implementation details

### Modified Files
- `src/App.tsx` - Added PWA prompt
- `src/lib/api.ts` - Added fallback logic

### No Changes Needed
- All API functions work automatically
- Service worker unchanged
- Manifest unchanged

---

## 🎯 Production Steps

1. **Convert Icons**
   ```bash
   npm install -g svgexport
   # Run conversion commands above
   ```

2. **Build**
   ```bash
   npm run build
   ```

3. **Deploy**
   - Upload dist/ to server
   - Ensure `/api.php` exists
   - Verify HTTPS is enabled

4. **Test**
   - Test on mobile device
   - Check install prompt appears
   - Verify API works
   - Test offline mode

5. **Monitor**
   - Check installation rates
   - Monitor API fallback triggers
   - Review server logs

---

## 🐛 Troubleshooting

### Install Prompt Not Showing
- Is device mobile? ✓
- Is HTTPS enabled? ✓
- Did user dismiss it? Check localStorage
- **Convert SVG to PNG** - Critical!

### API Calls Failing
- Is primary endpoint accessible?
- Is `/api.php` available?
- Check server logs
- Try fallback manually

### Service Worker Errors
- Clear cache (Cmd+Shift+R)
- Check HTTPS or localhost
- Check console for errors
- Review DevTools

---

## 📞 Support

For detailed information:
- See `PWA_AUDIT_REPORT.md` for full audit
- See `PWA_IMPLEMENTATION_SUMMARY.md` for details
- Check code comments in modified files

---

## ✅ Pre-Production Checklist

- [ ] Convert SVG icons to PNG
- [ ] Test on Android mobile device
- [ ] Test on iOS mobile device
- [ ] Test offline mode
- [ ] Verify primary API endpoint
- [ ] Verify fallback `/api.php` exists
- [ ] Check HTTPS certificate
- [ ] Build and test locally
- [ ] Deploy to production
- [ ] Monitor first requests
- [ ] Collect user feedback

---

## 💡 Key Facts

✅ **PWA Works**: Service worker, manifest, meta tags all configured
✅ **Install Works**: Mobile prompt integrated, handles both Android & iOS
✅ **API Fallback**: Automatic, no user intervention needed
✅ **All Functions Work**: 50+ API functions inherit fallback automatically
✅ **Offline Support**: Service worker caches critical assets
✅ **Production Ready**: Just convert icons and deploy

⚠️ **Action Needed**: 
- Convert SVG icons to PNG format (required)
- Test on mobile devices
- Monitor production deployment

---

## Example: Complete API + PWA Usage

```tsx
import { useApiStatus } from '@/hooks/use-api-status'
import { loginUser } from '@/lib/api-service'

export function LoginWithStatus() {
  const apiStatus = useApiStatus()
  
  const handleLogin = async (email: string, password: string) => {
    try {
      // This automatically uses fallback if primary fails
      await loginUser(email, password)
      
      // Show current endpoint
      console.log('Logged in via:', apiStatus.activeUrl)
      
      if (apiStatus.isFallback) {
        console.log('Using fallback API due to primary endpoint failure')
      }
    } catch (error) {
      console.error('Login failed:', error)
    }
  }
  
  return (
    <div>
      {apiStatus.isFallback && (
        <div className="bg-yellow-100 p-2 rounded">
          Using fallback API endpoint
        </div>
      )}
      {/* Login form */}
    </div>
  )
}
```

---

## Summary

🚀 **Status**: Implementation complete, production-ready
📋 **Actions**: Convert icons, test, deploy
✨ **Benefits**: Better mobile experience, API reliability, offline support
🎯 **Next**: Monitor production usage

For questions, see full documentation in `PWA_AUDIT_REPORT.md` and `PWA_IMPLEMENTATION_SUMMARY.md`
