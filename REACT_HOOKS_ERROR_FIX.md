# React Hooks Error Fix: "Cannot read properties of null (reading 'useRef')"

## Error Details

```
TypeError: Cannot read properties of null (reading 'useRef')
    at Object.useRef (https://...fly.dev/node_modules/.vite/deps/chunk-CYZG5QNB.js...)
    at TooltipProvider (https://.../@radix-ui_react-tooltip.js...)
```

This error occurs when React is either:
1. Not properly loaded/initialized
2. Present in multiple versions (module duplication)
3. Not available in the correct context when hooks are called
4. Improperly bundled for production

## Root Causes

The primary cause was **improper Vite bundling configuration** that was:
- Splitting React and Radix UI into separate chunks
- Creating module resolution issues where React wasn't available when TooltipProvider initialized
- Not optimizing dependencies correctly for production builds

Secondary causes:
- Missing or incorrect Docker/Fly.io deployment configuration
- Unnecessary explicit React imports (breaking new JSX transform)
- No health checks or proper error handling in the deployment

## Solutions Implemented

### 1. Fixed Vite Build Configuration

**File: `vite.config.ts`**

**Changes:**
- Added `@radix-ui/react-tooltip` to `optimizeDeps.include`
- Modified `manualChunks` to keep React, React-DOM, React-Router, and Radix UI in the main bundle
- Removed separate chunking for these critical libraries
- Added proper build optimization settings

**Why:** Radix UI components (especially TooltipProvider) depend on React hooks and must be in the same module context as React. Separating them into different chunks causes the hook context to break.

```typescript
optimizeDeps: {
  include: ['react', 'react-dom', 'react/jsx-runtime', '@radix-ui/react-tooltip'],
},
build: {
  rollupOptions: {
    output: {
      manualChunks: (id) => {
        // Keep critical libraries in main bundle
        if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
          return undefined; // Stay in main
        }
        if (id.includes('@radix-ui')) {
          return undefined; // Stay in main
        }
        if (id.includes('react-router')) {
          return undefined; // Stay in main
        }
        // Only vendor other packages
        if (id.includes('node_modules')) {
          return 'vendor';
        }
      },
    },
  },
}
```

### 2. Updated App.tsx

**File: `src/App.tsx`**

**Changes:**
- Removed explicit `import React` (using modern JSX transform)
- Removed unnecessary console.log statements
- Simplified imports

**Why:** Modern React (17+) with Vite's JSX transform doesn't require explicit React imports. Removing it can prevent module resolution issues.

```typescript
// Before
import React, { useEffect } from "react";
console.log("[App.tsx] Loading app module...");

// After
import { useEffect } from "react";
```

### 3. Created Dockerfile

**File: `Dockerfile`**

**Purpose:**
- Ensures consistent build environment across all deployments
- Uses Node 20 Alpine for smaller image size
- Multi-stage build for production optimization
- Uses `serve` to properly serve the built app

**Key features:**
- Reproducible builds with `npm ci`
- Separate build and production stages
- Health check configuration
- Proper environment variables

### 4. Created fly.toml

**File: `fly.toml`**

**Purpose:**
- Explicit Fly.io configuration for proper deployment
- Ensures Node 20 is used for builds
- Configures HTTP service correctly
- Sets up health checks
- Optimizes resource allocation

**Key configurations:**
```toml
[build]
  builder = "heroku"

[build.args]
  NODE_VERSION = "20"
  NPM_VERSION = "10"

[http_service]
  internal_port = 3000
  force_https = true
  min_machines_running = 1
```

### 5. Enhanced Error Handling

**File: `src/main.tsx`**

**Changes:**
- Added detailed error logging for React initialization
- Specific detection for hook-related errors
- Better error messages with actionable suggestions
- Stack trace visibility in errors
- Warning for React module issues

**Benefits:**
- Users see helpful error messages instead of blank screens
- Stack traces help with debugging
- Specific suggestions for common fixes

### 6. Created .dockerignore

**File: `.dockerignore`**

**Purpose:**
- Reduces Docker build context size
- Faster deployments
- Excludes unnecessary files from the build
- Prevents sensitive files from being included

## Deployment Instructions

### Prerequisites

1. Ensure you have the Fly.io CLI installed:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. Authenticate with Fly.io:
   ```bash
   flyctl auth login
   ```

### Deploy Steps

1. **Build locally to verify** (optional but recommended):
   ```bash
   npm run build
   npm install -g serve
   serve -s dist
   # Visit http://localhost:3000 to test
   ```

2. **Deploy to Fly.io**:
   ```bash
   # If this is the first deployment
   flyctl launch
   
   # For subsequent deployments
   flyctl deploy
   ```

3. **Verify deployment**:
   ```bash
   flyctl status
   flyctl logs
   ```

4. **Check the app**:
   ```bash
   flyctl open
   ```

### Rollback if needed

```bash
# View recent deployments
flyctl releases

# Rollback to previous version
flyctl releases rollback
```

## Fly.io Cache Clearing (If Error Persists)

The most common issue is that Fly.io is caching the old Vite deps bundle. To force a clean rebuild:

### Option 1: Clear Fly.io Builder Cache
```bash
# This removes all cached builds on Fly.io
flyctl builds list
flyctl builds delete <BUILD_ID>  # Delete old builds

# Then redeploy
flyctl deploy
```

### Option 2: Force a Fresh Deployment
```bash
# This forces Fly.io to rebuild without using cache
flyctl deploy --no-cache
```

### Option 3: Rebuild Machines
```bash
# Restart machines to ensure they get the latest deploy
flyctl machines list
flyctl machines restart <MACHINE_ID>
```

### Option 4: Complete Reset (Nuclear Option)
```bash
# Only use if all else fails - removes all Fly.io resources
flyctl destroy

# Then redeploy (creates new app)
flyctl launch
```

## Troubleshooting

### If the error persists after clearing cache:

1. **Clear browser cache and hard refresh**:
   - Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
   - Or open DevTools > Application > Clear site data

2. **Check browser console** for additional errors:
   - Open DevTools (F12)
   - Look for error messages in the Console tab
   - Check Network tab for failed requests

3. **Verify the build** locally:
   ```bash
   npm run build
   npm install -g serve
   serve -s dist
   ```

4. **Check Fly.io logs**:
   ```bash
   flyctl logs
   ```

5. **Verify Node.js version** on deployment:
   ```bash
   # In fly.toml, ensure:
   NODE_VERSION = "20"
   ```

6. **Try a clean rebuild**:
   ```bash
   # Delete node_modules and reinstall
   rm -rf node_modules
   npm ci
   npm run build
   flyctl deploy
   ```

### If you see "React is not defined":

This shouldn't happen with modern JSX, but if it does:
1. Ensure all React imports in components use: `import { useXXX } from "react"`
2. Don't use: `import React from "react"`
3. Check tsconfig.json has correct JSX settings

### If chunks fail to load:

1. Check the Network tab in DevTools
2. Look for failed chunk requests
3. This might indicate a CDN or deployment issue
4. Try clearing dist folder and rebuilding: `rm -rf dist && npm run build`

## Files Changed Summary

| File | Change | Reason |
|------|--------|--------|
| `vite.config.ts` | Simplified bundling, kept critical libs in main | Fix module resolution |
| `src/App.tsx` | Removed explicit React import | Modern JSX transform |
| `src/main.tsx` | Enhanced error handling | Better debugging |
| `Dockerfile` | NEW | Consistent deployments |
| `fly.toml` | NEW | Proper Fly.io config |
| `.dockerignore` | NEW | Faster builds |

## Prevention Tips

1. **Always test locally before deploying**:
   ```bash
   npm run build
   serve -s dist
   ```

2. **Monitor Fly.io logs regularly**:
   ```bash
   flyctl logs -f  # Follow logs
   ```

3. **Keep dependencies updated**:
   ```bash
   npm update
   npm audit
   ```

4. **Use proper bundling configuration** for production apps

5. **Test with StrictMode** to catch React issues early

## Additional Resources

- [Vite Documentation](https://vitejs.dev/)
- [React Hooks Rules](https://react.dev/reference/rules-of-hooks)
- [Fly.io Node.js Deployment](https://fly.io/docs/languages-and-frameworks/nodejs/)
- [Radix UI Documentation](https://www.radix-ui.com/)

## Support

If issues persist after these fixes:

1. Check the [Fly.io Status](https://status.fly.io/)
2. Review deployment logs with: `flyctl logs`
3. Try a fresh deployment with clean build
4. Check for conflicting browser extensions
5. Test in incognito/private mode to rule out cache issues
