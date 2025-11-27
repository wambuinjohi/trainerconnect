# CORS Fixes Summary

## What Was Fixed

The `api.php` file has been updated with comprehensive CORS (Cross-Origin Resource Sharing) configuration to properly handle requests from different origins in a production Apache environment.

## Key Changes Made

### 1. **Dynamic Origin Validation** (Lines 14-27)
**Before:** Used wildcard `*` for all origins
```php
header("Access-Control-Allow-Origin: *");
```

**After:** Validates origins against a whitelist
```php
$allowedOrigins = [
    'https://trainer.skatryk.co.ke',      // Production
    'http://localhost:3000',               // Development
    'http://localhost:5173',               // Development
    'http://localhost:8080',               // Development
    'http://127.0.0.1:3000',               // Development
    'http://127.0.0.1:5173',               // Development
    'http://127.0.0.1:8080',               // Development
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$corsOrigin = in_array($origin, $allowedOrigins) ? $origin : 'https://trainer.skatryk.co.ke';
```

**Benefits:**
- ✅ More secure - only allows known origins
- ✅ Supports both production and development
- ✅ Enables credentials in requests (important for authentication)
- ✅ Fallback to production domain if origin is unknown

### 2. **Comprehensive CORS Headers** (Lines 33-44)
Added all necessary CORS headers for proper browser communication:

```php
header("Access-Control-Allow-Origin: " . $corsOrigin);
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-Admin-Actor, X-Requested-With");
header("Access-Control-Max-Age: 86400");
```

**Headers Explained:**
- `Access-Control-Allow-Origin`: The origin allowed to access the API
- `Access-Control-Allow-Credentials`: Allows cookies/auth headers in cross-origin requests
- `Access-Control-Allow-Methods`: HTTP methods the API supports
- `Access-Control-Allow-Headers`: Headers the API accepts in requests
- `Access-Control-Max-Age`: Browser can cache preflight response for 24 hours

### 3. **Explicit OPTIONS Preflight Handling** (Lines 115-131)
**Enhanced the preflight request handler:**

```php
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    
    // Re-add CORS headers for preflight responses
    if (!headers_sent()) {
        header("Access-Control-Allow-Origin: " . ($corsOrigin ?? "*"));
        header("Access-Control-Allow-Credentials: true");
        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS");
        header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-Admin-Actor, X-Requested-With");
        header("Access-Control-Max-Age: 86400");
    }
    exit;
}
```

**Benefits:**
- ✅ Proper handling of browser preflight requests
- ✅ Returns 200 with appropriate headers (required by CORS spec)
- ✅ Prevents browser from blocking requests

### 4. **CORS Headers in Error Responses** (Lines 52-97)
**Added CORS headers to error handlers:**

```php
// In error handler
if (!empty($corsOrigin)) {
    header("Access-Control-Allow-Origin: " . $corsOrigin);
    header("Access-Control-Allow-Credentials: true");
} else {
    header("Access-Control-Allow-Origin: *");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-Admin-Actor, X-Requested-With");
```

**Benefits:**
- ✅ CORS headers in 500 errors
- ✅ CORS headers in fatal errors
- ✅ Browser can read error messages from other origins

### 5. **CORS Headers in All Responses** (Lines 146-174)
**Updated the `respond()` utility function:**

```php
function respond($status, $message, $data = null, $code = 200) {
    global $corsOrigin;
    
    if (!headers_sent()) {
        http_response_code($code);
        header("Content-Type: application/json; charset=utf-8");
        
        // Add CORS headers to all responses
        if (!empty($corsOrigin)) {
            header("Access-Control-Allow-Origin: " . $corsOrigin);
            header("Access-Control-Allow-Credentials: true");
        } else {
            header("Access-Control-Allow-Origin: *");
        }
        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS");
        header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-Admin-Actor, X-Requested-With");
    }
    
    // ... rest of function
}
```

**Benefits:**
- ✅ Ensures CORS headers in all success responses
- ✅ Consistent across all API endpoints
- ✅ No manual header management needed in individual endpoints

### 6. **Cache Control Headers** (Lines 46-49)
**Prevents browsers from caching API responses:**

```php
header("Cache-Control: no-cache, no-store, must-revalidate, max-age=0");
header("Pragma: no-cache");
header("Expires: 0");
```

**Benefits:**
- ✅ Ensures fresh data from API
- ✅ Prevents stale responses in browser cache
- ✅ Proper for dynamic API endpoints

## Additional Files Created

### 1. `.htaccess`
**Apache configuration file for:**
- Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- Gzip compression for API responses
- Proper MIME type handling
- Protection of sensitive files
- Directory listing prevention

### 2. `APACHE_DEPLOYMENT_GUIDE.md`
**Complete guide for deploying to Apache with:**
- Step-by-step deployment instructions
- Apache module requirements
- VirtualHost configuration example
- Troubleshooting guide
- Security best practices
- Performance optimization tips

## Browser CORS Request Flow

```
Browser (https://trainer.skatryk.co.ke)
    |
    ├─ Preflight Request (OPTIONS)
    │  └─ api.php returns 200 with CORS headers
    │
    └─ Actual Request (POST/GET/etc)
       └─ api.php returns data with CORS headers
       └─ Browser allows script to read response
```

## Testing the CORS Fix

### Using curl:

```bash
# Test preflight
curl -X OPTIONS https://trainer.skatryk.co.ke/api.php \
  -H "Origin: https://trainer.skatryk.co.ke" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Should see:
# HTTP/1.1 200 OK
# Access-Control-Allow-Origin: https://trainer.skatryk.co.ke
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
# ...

# Test actual request
curl -X POST https://trainer.skatryk.co.ke/api.php \
  -H "Content-Type: application/json" \
  -H "Origin: https://trainer.skatryk.co.ke" \
  -d '{"action": "health_check"}' \
  -v

# Should see CORS headers in response
```

### Using Browser DevTools:

1. Open browser console (F12)
2. Make a request to the API
3. Check the Response Headers tab
4. Verify these headers are present:
   - `Access-Control-Allow-Origin: https://trainer.skatryk.co.ke`
   - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS`
   - `Access-Control-Allow-Headers: Content-Type, Authorization, ...`

## Required Apache Modules

Ensure these are enabled on your Apache server:

```bash
sudo a2enmod rewrite      # For URL rewriting
sudo a2enmod headers      # For custom headers
sudo a2enmod deflate      # For compression
```

Check if modules are loaded:
```bash
apache2ctl -M | grep -E "rewrite|headers|deflate"
```

## Deployment Steps

1. **Backup current api.php**
   ```bash
   cp api.php api.php.backup
   ```

2. **Upload new api.php and .htaccess**
   ```bash
   cp api.php /var/www/html/
   cp .htaccess /var/www/html/
   ```

3. **Set permissions**
   ```bash
   chmod 644 /var/www/html/api.php
   chmod 644 /var/www/html/.htaccess
   ```

4. **Restart Apache**
   ```bash
   sudo systemctl restart apache2
   ```

5. **Test the API**
   ```bash
   curl -X POST https://trainer.skatryk.co.ke/api.php \
     -H "Content-Type: application/json" \
     -d '{"action": "health_check"}'
   ```

## Common Issues After Deployment

### CORS headers still missing
- ✅ Check Apache error logs: `tail -f /var/log/apache2/error.log`
- ✅ Verify modules are loaded: `apache2ctl -M | grep headers`
- ✅ Clear browser cache
- ✅ Test with curl (excludes browser cache)

### OPTIONS returns 404
- ✅ Ensure `mod_rewrite` is enabled
- ✅ Check `.htaccess` is present and readable
- ✅ Verify `AllowOverride All` in VirtualHost config

### File upload failing
- ✅ Check uploads directory permissions: `chmod 755 uploads`
- ✅ Verify owner: `chown www-data:www-data uploads`
- ✅ Check disk space: `df -h`
- ✅ Review PHP error logs

## Summary of Improvements

| Issue | Before | After |
|-------|--------|-------|
| CORS Origin | Wildcard `*` (insecure) | Whitelist with validation |
| Credentials | Not allowed | `Access-Control-Allow-Credentials: true` |
| Error Responses | No CORS headers | CORS headers in all responses |
| Preflight Handling | Basic | Explicit with all headers |
| Cache Control | None | Prevent caching of API responses |
| Security | Basic | Added security headers |

## Next Steps

1. ✅ Upload `api.php` to Apache server
2. ✅ Upload `.htaccess` to webroot
3. ✅ Enable required Apache modules
4. ✅ Restart Apache
5. ✅ Test with curl and browser
6. ✅ Add custom origins to whitelist if needed (edit `$allowedOrigins`)
7. ✅ Monitor error logs for issues
8. ✅ Verify frontend can connect successfully

---

**Ready to deploy!** All CORS issues have been fixed and the api.php file is ready for production Apache servers.
