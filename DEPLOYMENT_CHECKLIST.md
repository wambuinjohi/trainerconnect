# Apache Deployment Checklist

## Pre-Deployment Preparation

- [ ] Review `CORS_FIXES_SUMMARY.md` to understand changes
- [ ] Read `APACHE_DEPLOYMENT_GUIDE.md` for complete setup
- [ ] Backup current `api.php` file
- [ ] Test locally if possible before production deployment

## File Uploads to Apache

- [ ] Upload `api.php` to `/var/www/html/` or your webroot
- [ ] Upload `.htaccess` to `/var/www/html/` or your webroot
- [ ] Verify `connection.php` is present and accessible
- [ ] Verify `mpesa_helper.php` is present and accessible

## File Permissions

```bash
# Execute these commands:
chmod 644 /var/www/html/api.php
chmod 644 /var/www/html/.htaccess
mkdir -p /var/www/html/uploads
chmod 755 /var/www/html/uploads
chown www-data:www-data /var/www/html/uploads
```

- [ ] api.php permissions set to 644
- [ ] .htaccess permissions set to 644
- [ ] uploads directory created with 755 permissions
- [ ] uploads directory owned by www-data user

## Apache Modules

Enable required modules:

```bash
sudo a2enmod rewrite
sudo a2enmod headers
sudo a2enmod deflate
sudo a2enmod fcgid    # Optional, for PHP-FPM
```

Verify modules:
```bash
apache2ctl -M | grep -E "rewrite|headers|deflate"
```

- [ ] mod_rewrite enabled
- [ ] mod_headers enabled
- [ ] mod_deflate enabled
- [ ] PHP handler configured (fcgid or mod_php)

## Apache Configuration

- [ ] VirtualHost configured for `https://trainer.skatryk.co.ke`
- [ ] HTTPS/SSL certificates installed and configured
- [ ] Document root points to `/var/www/html`
- [ ] `AllowOverride All` enabled in VirtualHost
- [ ] `.htaccess` file is readable by Apache

## Database Configuration

- [ ] `connection.php` updated with correct database credentials
- [ ] Database server is running and accessible
- [ ] Database user has appropriate permissions
- [ ] Test connection with: `curl -X POST https://trainer.skatryk.co.ke/api.php -d '{"action":"health_check"}'`

## CORS Configuration

- [ ] Review allowed origins in `api.php` (lines 16-24)
- [ ] Verify `https://trainer.skatryk.co.ke` is in the whitelist
- [ ] Add any additional allowed origins to the whitelist
- [ ] Remove development origins if deploying to production only

Allowed origins currently configured:
```
✓ https://trainer.skatryk.co.ke (production)
✓ http://localhost:3000 (development)
✓ http://localhost:5173 (development)
✓ http://localhost:8080 (development)
✓ http://127.0.0.1:3000 (development)
✓ http://127.0.0.1:5173 (development)
✓ http://127.0.0.1:8080 (development)
```

- [ ] Confirm allowed origins are correct for your environment
- [ ] Update origins if needed
- [ ] Save and re-upload `api.php` if changes made

## Service Restart

```bash
sudo systemctl restart apache2
# or
sudo service apache2 restart
```

- [ ] Apache restarted successfully
- [ ] No errors in Apache error log
- [ ] Apache is running and responding

## Testing

### Health Check
```bash
curl -X POST https://trainer.skatryk.co.ke/api.php \
  -H "Content-Type: application/json" \
  -d '{"action": "health_check"}'
```
Expected response:
```json
{
  "status": "success",
  "message": "API is healthy and responding correctly.",
  "data": null
}
```

- [ ] Health check returns success
- [ ] Response includes proper JSON format

### Preflight Test
```bash
curl -X OPTIONS https://trainer.skatryk.co.ke/api.php \
  -H "Origin: https://trainer.skatryk.co.ke" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

Expected headers in response:
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://trainer.skatryk.co.ke
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-Admin-Actor, X-Requested-With
```

- [ ] Preflight request returns 200 status
- [ ] CORS headers present in response
- [ ] Correct origin in Access-Control-Allow-Origin

### CORS Headers Test
```bash
curl -X POST https://trainer.skatryk.co.ke/api.php \
  -H "Content-Type: application/json" \
  -H "Origin: https://trainer.skatryk.co.ke" \
  -d '{"action": "health_check"}' \
  -i  # Include headers in output
```

- [ ] CORS headers present in actual request
- [ ] Access-Control-Allow-Origin matches request origin
- [ ] Access-Control-Allow-Credentials is true

### Database Migration Test
```bash
curl -X POST https://trainer.skatryk.co.ke/api.php \
  -H "Content-Type: application/json" \
  -d '{"action": "migrate"}'
```

- [ ] Migration runs without errors
- [ ] Tables are created successfully
- [ ] Check Apache error logs for SQL issues

### Seed Test Users
```bash
curl -X POST https://trainer.skatryk.co.ke/api.php \
  -H "Content-Type: application/json" \
  -d '{"action": "seed_all_users"}'
```

- [ ] Test users created successfully
- [ ] Check database for new user records

### Login Test
```bash
curl -X POST https://trainer.skatryk.co.ke/api.php \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@skatryk.co.ke", "password": "Test1234", "action": "login"}'
```

- [ ] Login successful with test credentials
- [ ] Access token returned in response
- [ ] User profile data included

## Frontend Integration

- [ ] Frontend environment variable `VITE_API_URL` set to `https://trainer.skatryk.co.ke` (or left empty for relative path)
- [ ] Frontend `api-config.ts` configured correctly
- [ ] Frontend can reach the API from the domain
- [ ] Authentication flows work end-to-end
- [ ] File uploads work if applicable

## Monitoring

- [ ] Apache error log monitored: `tail -f /var/log/apache2/error.log`
- [ ] Apache access log checked for request patterns: `tail -f /var/log/apache2/access.log`
- [ ] API event log monitored: `/api_events.log`
- [ ] Disk space monitored for uploads directory
- [ ] Database connection tested periodically

## Troubleshooting Quick Links

If you encounter issues:

1. **CORS Headers Missing**: See "CORS headers not appearing" in `APACHE_DEPLOYMENT_GUIDE.md`
2. **OPTIONS Returns 404**: See "404 or 405 on OPTIONS Requests" in guide
3. **File Upload Failing**: See "File upload issues" in guide
4. **Database Connection Issues**: See "Database connection issues" in guide
5. **General Debugging**: Check Apache error logs at `/var/log/apache2/error.log`

## Post-Deployment

- [ ] Monitor error logs for first 24-48 hours
- [ ] Test all major API endpoints
- [ ] Verify authentication and authorization
- [ ] Test file uploads if applicable
- [ ] Monitor server performance and resource usage
- [ ] Keep backups of working api.php version
- [ ] Document any custom configuration changes

## Rollback Plan

If issues occur after deployment:

```bash
# Restore backup if available
cp /var/www/html/api.php.backup /var/www/html/api.php

# Restart Apache
sudo systemctl restart apache2

# Check logs
tail -f /var/log/apache2/error.log
```

- [ ] Backup location documented
- [ ] Rollback procedure understood
- [ ] Contact support information handy

## Success Criteria

✅ All items checked means your Apache deployment is ready!

- [ ] API responds to requests
- [ ] CORS headers present in all responses
- [ ] Preflight requests handled correctly
- [ ] Database operations working
- [ ] Authentication functional
- [ ] No errors in Apache logs
- [ ] Frontend can connect successfully

---

## Deployment Summary

**Files to Upload:**
1. `api.php` - Main API file with CORS fixes
2. `.htaccess` - Apache configuration for security and compression
3. `connection.php` - Database connection (if not already present)
4. `mpesa_helper.php` - M-Pesa helper functions (if not already present)

**Documentation Files:**
1. `CORS_FIXES_SUMMARY.md` - Detailed explanation of all changes
2. `APACHE_DEPLOYMENT_GUIDE.md` - Complete deployment guide
3. `DEPLOYMENT_CHECKLIST.md` - This checklist

**Key Changes:**
- ✅ Dynamic CORS origin validation (security improvement)
- ✅ Explicit preflight request handling
- ✅ CORS headers in all responses (including errors)
- ✅ Cache control headers
- ✅ Apache security headers
- ✅ Gzip compression enabled

Ready to deploy! 🚀
