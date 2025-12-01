# API Error Fix: "Server returned HTML instead of JSON"

## Problem Description

The error message:
```
Failed to parse API response: Server returned HTML instead of JSON. Status: 200. 
The API endpoint may be down or misconfigured. Status: 200 StatusText:
```

This error occurs when the API endpoint returns an HTTP 200 status code but sends HTML content instead of JSON.

## Root Causes

This issue typically happens due to one or more of the following:

1. **Missing `.htaccess` file** - Apache cannot properly route requests to `api.php`
2. **PHP not enabled** - The server is serving the PHP file as static text instead of executing it
3. **Incorrect routing** - Requests are being intercepted by the SPA's index.html
4. **Missing includes** - `connection.php` or `mpesa_helper.php` files are not accessible
5. **Server error pages** - Apache/provider returning error pages (maintenance, 404, etc.)
6. **CORS misconfiguration** - Headers not being set correctly

## Solutions Implemented

### 1. Created `.htaccess` File

A new `.htaccess` file has been created at the project root with:

- **URL Rewriting**: Properly routes requests to `api.php` for API calls and `index.html` for SPA routes
- **CORS Headers**: Configures proper cross-origin resource sharing
- **Security Headers**: Adds security headers for protection
- **Error Handling**: Custom error page handling
- **PHP Configuration**: Ensures PHP files are executed correctly
- **Caching**: Prevents caching of API responses

**Location**: `/.htaccess`

**Key configurations**:
```apache
# Ensure api.php is not rewritten to index.html
RewriteCond %{REQUEST_URI} !^/api\.php$ [NC]

# CORS headers for API
<FilesMatch "api\.php$">
    Header always set Access-Control-Allow-Origin "*"
    Header always set Content-Type "application/json; charset=utf-8"
</FilesMatch>
```

### 2. Enhanced Error Detection in API Client

Updated `src/lib/api.ts` to provide better diagnostics:

- **Content-Type checking**: Checks response headers first before parsing body
- **Detailed error messages**: Includes API URL and response snippet in error message
- **Development mode debugging**: In development, shows the first 200 characters of the response
- **Better HTML detection**: Detects both HTML responses and wrong content types

**Improved error message includes**:
- Content-Type header value
- HTTP status code
- API URL that was called
- Response preview (first 200 chars in dev mode)

### 3. Created API Diagnostics Page

A new diagnostic tool at `/api-diagnostics` helps troubleshoot API issues:

**Features**:
- Tests API connectivity with health check
- Validates CORS preflight requests
- Shows current API configuration
- Displays browser and location info
- Provides step-by-step troubleshooting guide
- Exports diagnostics as JSON for support requests

**Access**: Navigate to `/api-diagnostics` in the application

## Deployment Checklist

### Before Deploying

1. **Ensure PHP is enabled** on your hosting:
   - Check with your provider if PHP is installed
   - Verify PHP version is 7.4 or higher
   - Confirm PHP extensions: mysqli, json, curl

2. **Verify file structure**:
   ```
   /
   ├── api.php (main API handler)
   ├── connection.php (database connection)
   ├── mpesa_helper.php (M-Pesa integration)
   ├── .htaccess (new file - IMPORTANT)
   ├── .env (database credentials)
   ├── index.html (React SPA)
   └── ... other files
   ```

3. **Check server configuration**:
   - Ensure `mod_rewrite` is enabled
   - Ensure `mod_headers` is enabled
   - Verify `AllowOverride All` is set for your document root

### Deployment Steps

1. **Upload files to webroot**:
   ```bash
   # Ensure all files are uploaded, especially:
   scp -r . user@server:/home/user/public_html/
   ```

2. **Set file permissions**:
   ```bash
   # SSH into server
   ssh user@server
   
   # Make api.php executable
   chmod 644 api.php
   
   # Make .htaccess readable
   chmod 644 .htaccess
   
   # Ensure directories are readable
   chmod 755 uploads/
   chmod 755 public/
   ```

3. **Verify .htaccess is in place**:
   ```bash
   ls -la | grep htaccess
   # Should show: -rw-r--r-- ... .htaccess
   ```

4. **Test the API endpoint**:
   ```bash
   # From command line or browser
   curl -X POST https://yourdomain.com/api.php \
     -H "Content-Type: application/json" \
     -d '{"action":"health_check"}'
   
   # Should return JSON like:
   # {"status":"success","message":"Server is running","data":{"timestamp":"..."}}
   ```

5. **Check error logs** if issues persist:
   ```bash
   # View PHP error log
   tail -100 /var/log/php-errors.log
   
   # View Apache error log
   tail -100 /var/log/apache2/error.log
   
   # Or via cPanel/Hosting panel error logs
   ```

## Troubleshooting

### Symptom: HTML response instead of JSON

**Test with curl**:
```bash
curl -v -X POST https://yourdomain.com/api.php \
  -H "Content-Type: application/json" \
  -d '{"action":"health_check"}'
```

**Check response headers**:
- Should see: `Content-Type: application/json`
- Should NOT see: `Content-Type: text/html`

**If you see HTML response**:
1. Check if api.php is being served as text (PHP not enabled)
2. Verify .htaccess file is in place
3. Check that connection.php file exists and is readable
4. Review server error logs for PHP errors

### Symptom: CORS errors

**Check CORS headers**:
```bash
curl -v -X OPTIONS https://yourdomain.com/api.php
```

**Should see headers like**:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
```

**If missing**:
1. Verify mod_headers is enabled on Apache
2. Ensure .htaccess has `<IfModule mod_headers.c>` section
3. Check that VirtualHost has `AllowOverride All`

### Symptom: 404 or "api.php not found"

**Solutions**:
1. Verify api.php is uploaded to webroot
2. Check file permissions (should be readable: 644 or 755)
3. Test direct URL: `https://yourdomain.com/api.php` (should not give 404)
4. Review .htaccess rewrite rules

### Symptom: Database connection errors

**Check .env file**:
```env
DB_HOST=localhost
DB_USER=your_username
DB_PASS=your_password
DB_NAME=your_database
```

**Test database connection**:
```bash
# SSH into server
ssh user@server

# Test with mysql command
mysql -h localhost -u your_username -p your_password your_database -e "SHOW TABLES;"
```

## Using the API Diagnostics Page

1. Navigate to `https://yourdomain.com/api-diagnostics`
2. Click "Run Diagnostics"
3. Review the results:
   - **Green checkmarks**: Everything is working
   - **Red X marks**: Issues that need fixing
   - **Yellow warnings**: Configuration warnings

4. Common issues shown:
   - HTML response instead of JSON
   - Missing CORS headers
   - Wrong Content-Type
   - Connection failures

## Local Development

For local development with the Vite dev server:

1. **Vite dev middleware** automatically mocks the API for testing
2. **No .htaccess needed** for local testing
3. **API_URL defaults** to `/api.php` which dev server handles

To test with the real PHP API:
1. Set environment variable: `VITE_API_URL=http://localhost/api.php`
2. Run a local web server (Apache, Nginx, etc.)
3. Ensure PHP is installed locally

## Support and Additional Resources

If issues persist:

1. **Check deployment docs**: See `DEPLOYMENT_CHECKLIST.md` and `SHARED_SERVER_SETUP.md`
2. **Review Apache logs**: Check error logs for specific errors
3. **Test with curl**: Use command line to test API directly
4. **Export diagnostics**: Use the API Diagnostics page to export JSON and share with support
5. **Enable debug mode**: Check `api.php` logging for detailed error messages

## Summary of Changes

| File | Changes |
|------|---------|
| `.htaccess` | NEW - Added Apache configuration for routing, CORS, and security |
| `src/lib/api.ts` | ENHANCED - Better error detection and diagnostics |
| `src/pages/ApiDiagnostics.tsx` | NEW - Diagnostic tool for troubleshooting |
| `src/App.tsx` | UPDATED - Added route for diagnostics page |

## Next Steps

1. Ensure `.htaccess` file is deployed to your webroot
2. Run diagnostics from `/api-diagnostics` page to verify setup
3. Check logs if any issues remain
4. Contact hosting support if PHP or Apache modules need to be enabled
