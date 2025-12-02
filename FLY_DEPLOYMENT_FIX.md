# Fly.io Deployment Guide - React Hooks Error Fix

## The Problem

The error **"Cannot read properties of null (reading 'useRef')"** occurs because:
- Vite's dependency optimization is creating stale or incomplete bundles
- React and Radix UI components end up in separate chunks where they can't share hook context
- Fly.io caches the old bundle from previous deployments

## Complete Solution

### Step 1: Update Your Local Code

Ensure you have the latest fixes:
```bash
git pull origin main  # Get the latest code
npm install           # Update dependencies
```

Verify these files exist and contain the latest fixes:
- `vite.config.ts` - Has comprehensive `optimizeDeps.include` and `force` option
- `Dockerfile` - Has cache cleaning step
- `fly.toml` - Configured to use Dockerfile builder
- `.npmrc` - Proper peer dependency handling

### Step 2: Test Locally

Before deploying, verify the build works locally:

```bash
# Clean build
rm -rf dist node_modules/.vite node_modules/.cache

# Build
npm run build

# Test the built app
npm install -g serve
serve -s dist

# Visit http://localhost:3000 and check the console for errors
```

The app should load without any React errors.

### Step 3: Deploy with Cache Clearing

**Option A: Force Fresh Build (Recommended)**
```bash
# Deploy with --no-cache flag to ignore Fly.io's cache
flyctl deploy --no-cache
```

**Option B: Manual Cache Clearing**
```bash
# See what builds are cached
flyctl builds list

# Delete old cached builds (keep newest few)
flyctl builds delete <BUILD_ID>

# Redeploy
flyctl deploy
```

**Option C: Nuclear Option (Only if A & B fail)**
```bash
# WARNING: This deletes everything - app becomes unavailable temporarily
flyctl destroy

# Redeploy from scratch
flyctl launch
flyctl deploy
```

### Step 4: Verify Deployment

```bash
# Check deployment status
flyctl status

# View live logs
flyctl logs -f

# Open the app in browser
flyctl open
```

**Success signs:**
- No errors in the logs
- App loads without React errors
- Can click around the interface without errors

**Error signs:**
- Still seeing "Cannot read properties of null (reading 'useRef')"
- Error in logs about React/Vite modules
- Blank page with console errors

### Step 5: If Error Still Occurs

1. **Check what's deployed:**
   ```bash
   flyctl logs | grep -i "react\|vite\|useref" | tail -50
   ```

2. **Try harder cache clear:**
   ```bash
   # Remove all build cache
   flyctl machines list
   flyctl machines restart <MACHINE_ID>
   
   # Redeploy
   flyctl deploy --no-cache
   ```

3. **Verify Dockerfile runs:**
   ```bash
   # The Dockerfile should now clean .vite cache before building
   # Check if this is happening in the logs
   flyctl logs | grep -i "vite\|removing\|cache"
   ```

4. **Check Node version:**
   ```bash
   # Ensure Node 20 is being used
   flyctl machines status <MACHINE_ID>
   ```

## Key Fixes Applied

### 1. Vite Configuration (vite.config.ts)
```typescript
optimizeDeps: {
  force: command === 'build' ? true : false, // Force re-optimization for builds
  include: [
    'react', 'react-dom', 'react/jsx-runtime',
    // All Radix UI components bundled together
    '@radix-ui/react-tooltip',
    '@radix-ui/react-dialog',
    // ... 30+ other Radix UI components
    'react-router-dom',
    '@tanstack/react-query',
    // ... other critical dependencies
  ],
},
```

### 2. Docker Build (Dockerfile)
```dockerfile
# Clear old Vite cache before building
RUN rm -rf node_modules/.vite node_modules/.cache && npm run build
```

### 3. Fly.io Config (fly.toml)
```toml
[build]
  builder = "dockerfile"
  dockerfile = "./Dockerfile"
```

### 4. Tooltip Component (src/components/ui/tooltip.tsx)
```typescript
// Modern React imports instead of namespace imports
import { forwardRef, type ElementRef, type ComponentPropsWithoutRef } from "react";
```

## Environment Variables

If deploying to a different Fly.io app:

```bash
# Set app name
flyctl config set app trainer-coach-connect

# Or use environment variable
export FLY_APP=trainer-coach-connect
```

## Rollback if Needed

```bash
# See previous deployments
flyctl releases

# Rollback to previous version
flyctl releases rollback
```

## Expected Build Times

- Clean build: 3-5 minutes
- With cache: 2-3 minutes
- If using --no-cache: 5-7 minutes (slower but safer)

## Monitoring After Deploy

```bash
# Watch logs in real-time
flyctl logs -f

# Check for React-specific errors
flyctl logs | grep -i "react\|error\|useref"

# Monitor memory/CPU usage
flyctl ssh console
top -bn1 | head -20
```

## Common Issues and Fixes

### Issue: "Cannot read properties of null (reading 'useRef')"
**Fix:** Use `flyctl deploy --no-cache`

### Issue: "Cannot find module '@radix-ui/...'"
**Fix:** Ensure all Radix UI packages are in `vite.config.ts` `optimizeDeps.include`

### Issue: "Chunk failed to load"
**Fix:** Use `flyctl machines restart <MACHINE_ID>`

### Issue: "Node version mismatch"
**Fix:** Check `fly.toml` has `NODE_VERSION = "20"`

### Issue: "Out of memory during build"
**Fix:** The Dockerfile uses Node 20 Alpine which has low memory. This should work but if not, consider:
```bash
# Increase machine size temporarily
flyctl scale vm shared-cpu-1x --memory 1024
```

## Success Checklist

- [ ] Latest code pulled and tested locally
- [ ] Local build works without errors
- [ ] Deployed with `--no-cache` flag
- [ ] Logs show no React errors
- [ ] App loads in browser without errors
- [ ] Can navigate and click buttons
- [ ] No console errors in DevTools

## Additional Resources

- [Vite Documentation](https://vitejs.dev/guide/)
- [Fly.io Node.js Guide](https://fly.io/docs/languages-and-frameworks/nodejs/)
- [React Hooks Rules](https://react.dev/reference/rules-of-hooks)
- [Radix UI Documentation](https://www.radix-ui.com/)

## Support

If you still have issues:

1. Check the [Fly.io Status Page](https://status.fly.io/)
2. Review `flyctl logs` for specific errors
3. Try the nuclear option (flyctl destroy + re-launch)
4. Check your browser's DevTools Console for more details
5. Try in Incognito/Private mode to rule out caching

## Next Steps

After successful deployment:

1. Share the app URL with users
2. Monitor `flyctl logs -f` for errors
3. Set up monitoring/alerts if needed
4. Plan regular updates for dependencies
5. Keep Vite and related packages updated
