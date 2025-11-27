# Apache Deployment Guide for Skatryk Trainer API

This guide explains how to deploy the API to Apache with proper CORS configuration for production on a shared PHP server environment.

**Environment:** Shared PHP Server (MySQL via localhost, no Node.js runtime)

## Database Configuration

The API uses **MySQL via localhost** without requiring explicit port specification:
- Default connection: `localhost` (no port needed)
- MySQL port: `3306` (default)
- Connection file: `connection.php`

The frontend is a React/Vite application that communicates with the PHP API via HTTP/HTTPS.

## Fixed CORS Issues

The `api.php` file has been updated with the following CORS improvements:

### 1. **Dynamic Origin Validation**
- Whitelist of allowed origins instead of using `*`
- Supports production domain: `https://trainer.skatryk.co.ke`
- Includes local development origins: `localhost:3000`, `localhost:5173`, `localhost:8080`
- Fallback to production domain if origin is not in whitelist

### 2. **Complete CORS Headers**
All API responses now include:
```
Access-Control-Allow-Origin: [validated origin]
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-Admin-Actor, X-Requested-With
Access-Control-Max-Age: 86400
```

### 3. **Preflight Request Handling**
- OPTIONS requests are handled explicitly with proper CORS headers
- Returns 200 status code with appropriate CORS headers
- Prevents browser from blocking subsequent requests

### 4. **Error Response CORS Headers**
- CORS headers are included in error responses (4xx, 5xx)
- Ensures consistency across all API responses

### 5. **Cache Control Headers**
```
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```

## Apache Requirements

Ensure the following Apache modules are enabled:

```bash
sudo a2enmod rewrite
sudo a2enmod headers
sudo a2enmod deflate
sudo a2enmod fcgid    # For PHP-FPM (optional but recommended)
```

To enable modules on your Apache server:
```bash
sudo a2enmod mod_name
sudo systemctl restart apache2
```

## Deployment Steps

### 1. Upload Files to Apache Root

```bash
# Copy api.php to your Apache webroot
cp api.php /var/www/html/api.php

# Copy .htaccess for security and compression
cp .htaccess /var/www/html/.htaccess

# Create uploads directory with proper permissions
mkdir -p /var/www/html/uploads
chmod 755 /var/www/html/uploads
chmod 755 /var/www/html
```

### 2. Set File Permissions

```bash
# Ensure api.php is executable by the web server
chmod 644 /var/www/html/api.php

# Ensure .htaccess is readable
chmod 644 /var/www/html/.htaccess

# Set proper permissions for uploads
chown www-data:www-data /var/www/html/uploads
chmod 755 /var/www/html/uploads
```

### 3. Configure Apache VirtualHost

For production domain `https://trainer.skatryk.co.ke`:

```apache
<VirtualHost *:443>
    ServerName trainer.skatryk.co.ke
    DocumentRoot /var/www/html

    # Enable HTTPS
    SSLEngine on
    SSLCertificateFile /path/to/certificate.crt
    SSLCertificateKeyFile /path/to/private.key
    SSLCertificateChainFile /path/to/ca_bundle.crt

    # Enable mod_rewrite
    <Directory /var/www/html>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        
        # Require Apache 2.4+
        Require all granted
    </Directory>

    # Log files
    ErrorLog ${APACHE_LOG_DIR}/trainer_api_error.log
    CustomLog ${APACHE_LOG_DIR}/trainer_api_access.log combined
    
    # Enable compression
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE application/json text/html text/plain
    </IfModule>
</VirtualHost>
```

### 4. Add to CORS Allowed Origins (if needed)

Edit `api.php` and update the `$allowedOrigins` array:

```php
$allowedOrigins = [
    'https://trainer.skatryk.co.ke',
    'https://app.skatryk.co.ke',        // Add more domains here
    'http://localhost:3000',
    'http://localhost:5173',
];
```

### 5. Verify Installation

Test the API with curl:

```bash
# Test health check
curl -X POST https://trainer.skatryk.co.ke/api.php \
  -H "Content-Type: application/json" \
  -d '{"action": "health_check"}'

# Test preflight request
curl -X OPTIONS https://trainer.skatryk.co.ke/api.php \
  -H "Origin: https://trainer.skatryk.co.ke" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Check CORS headers are present
curl -X POST https://trainer.skatryk.co.ke/api.php \
  -H "Content-Type: application/json" \
  -H "Origin: https://trainer.skatryk.co.ke" \
  -d '{"action": "health_check"}' \
  -v
```

## Troubleshooting

### CORS Headers Not Appearing

1. **Check Apache modules**
   ```bash
   apache2ctl -M | grep headers
   ```
   
2. **Enable mod_headers if not loaded**
   ```bash
   sudo a2enmod headers
   sudo systemctl restart apache2
   ```

3. **Check PHP execution**
   - Ensure PHP is properly configured in Apache
   - Verify the `api.php` file is executable
   - Check Apache error logs: `/var/log/apache2/error.log`

### 404 or 405 on OPTIONS Requests

1. Verify `.htaccess` is in the correct directory
2. Check that `AllowOverride All` is set in your VirtualHost
3. Ensure `mod_rewrite` is enabled

### File Upload Issues

1. Check uploads directory permissions: `chmod 755 /var/www/html/uploads`
2. Verify owner: `chown www-data:www-data /var/www/html/uploads`
3. Check disk space: `df -h`
4. Review upload_max_filesize in php.ini

### Database Connection Issues

1. Verify `connection.php` is present and properly configured
2. Check database credentials in `connection.php`
3. Ensure database server is running and accessible
4. Review PHP error logs in Apache logs

## Security Best Practices

1. **HTTPS Only**: Always use HTTPS in production
2. **Origin Validation**: Keep the whitelist of allowed origins limited
3. **Authentication**: Use proper authentication tokens in the `Authorization` header
4. **Input Validation**: Sanitize all user inputs (already done in api.php with prepared statements)
5. **Error Messages**: Don't expose sensitive information in error messages
6. **Logs**: Keep API event logs secure and rotated

## Performance Optimization

1. **Enable Compression**: Already configured in `.htaccess`
2. **Browser Caching**: Set appropriate cache headers for static files
3. **Database Indexing**: Ensure frequently queried tables have proper indexes
4. **Connection Pooling**: Consider using persistent MySQL connections for high traffic

## Testing with Frontend

Once deployed, update the frontend API configuration in `src/lib/api-config.ts`:

```typescript
export function getApiBaseUrl(): string {
  const storedUrl = localStorage.getItem('api_url');
  if (storedUrl) return storedUrl;

  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;

  // For production
  if (isCapacitorApp()) {
    return 'https://trainer.skatryk.co.ke';
  }

  // Local testing can use relative path
  return '/api.php';
}
```

## Common API Endpoints

```bash
# Login
POST /api.php
{"action": "login", "email": "user@example.com", "password": "password"}

# Signup
POST /api.php
{"action": "signup", "email": "user@example.com", "password": "password", "user_type": "client"}

# Health Check
POST /api.php
{"action": "health_check"}

# Database Migration
POST /api.php
{"action": "migrate"}

# Seed Test Data
POST /api.php
{"action": "seed_all_users"}
```

## Support

If you encounter CORS errors after deployment:

1. Check browser console for specific error messages
2. Review Apache error logs: `tail -f /var/log/apache2/error.log`
3. Test with curl to isolate the issue
4. Verify all allowed origins are configured in `api.php`
5. Ensure all required Apache modules are enabled
