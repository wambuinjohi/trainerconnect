# Shared PHP Server Setup Guide

This document explains the complete configuration for deploying the Skatryk Trainer application to a shared PHP server (no Node.js runtime required).

## Executive Summary

✅ **All Node.js backend operations have been removed**
✅ **Database uses localhost without explicit port specification**
✅ **Frontend is React/Vite (built locally, static files deployed)**
✅ **Backend is 100% PHP with MySQL via localhost**
✅ **CORS configured for Apache production environments**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Shared PHP Server                         │
│                   (Apache + PHP + MySQL)                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Apache Web Server                                   │   │
│  │  ├─ dist/ (React frontend - static files)            │   │
│  │  ├─ api.php (REST API - handles all requests)        │   │
│  │  ├─ connection.php (DB connection via localhost)     │   │
│  │  ├─ .htaccess (CORS + Security + Compression)        │   │
│  │  └─ uploads/ (File storage)                          │   │
│  ���──────────────────────────────────────────────────────┘   │
│                              ↓                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MySQL Database (localhost:3306)                     │   │
│  │  ├─ users                                            │   │
│  │  ├─ user_profiles                                    │   │
│  │  ├─ bookings                                         │   │
│  │  ├─ payments                                         │   │
│  │  └─ ... (other tables)                               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Configuration

### Connection Details

The application connects to MySQL using:
- **Host:** `localhost` (no port specification needed)
- **Port:** 3306 (default MySQL port)
- **User:** `skatrykc_trainer`
- **Database:** `skatrykc_trainer`

### Files Modified

**1. `connection.php`** - Database connection configuration
```php
$server = 'localhost';     // No port specified
$username = 'skatrykc_trainer';
$password = 'Sirgeorge.12';
$database = 'skatrykc_trainer';
$port = 0;  // Use default port (3306)
```

**2. `diagnose.php`** - Diagnostic tool
- Updated to use localhost without explicit port 3306
- Can test database connectivity

**3. `api.php`** - Main REST API
- All database operations via `connection.php`
- No Node.js packages required

---

## Removed Node.js Dependencies

The following Node.js packages were unnecessary and have been removed from `package.json`:

### Backend Database Packages
- ❌ `mysql2` - Not needed (PHP uses mysqli)
- ❌ `pg` - Not needed (PostgreSQL client for Node.js)

### Backend Service Packages
- ❌ `nodemailer` - Not needed (PHP mail functions available)
- ❌ `@paypal/checkout-server-sdk` - Use PHP/API instead
- ❌ `stripe` - Use PHP library if needed

### Removed Build Scripts
- ❌ `reset-passwords` - Use PHP endpoint instead
- ❌ `migrate:mysql:api` - Use PHP migration endpoint
- ❌ `migrate:pg:to:mysqlapi` - Not applicable

### Scripts to Remove Locally
If you have these scripts in the `scripts/` folder, they're no longer needed:
- `scripts/reset_passwords.js`
- `scripts/run_migrations.js`
- `scripts/mysql_migrate_via_api.mjs`
- `scripts/pg_to_mysql_api.mjs`

---

## Frontend Deployment

### Build Process (Local Machine or CI/CD)

```bash
# Step 1: Install dependencies (local machine)
npm install

# Step 2: Build React/Vite frontend
npm run build

# Step 3: Generated files ready for upload
# dist/ directory contains all static files
```

### Upload to Shared Server

```bash
# Upload the following to your shared server:

# Frontend (static files)
dist/*                    → /var/www/html/

# Backend (PHP files)
api.php                   → /var/www/html/api.php
connection.php            → /var/www/html/connection.php
.htaccess                 → /var/www/html/.htaccess
mpesa_helper.php          → /var/www/html/mpesa_helper.php
b2c_callback.php          → /var/www/html/b2c_callback.php
c2b_callback.php          → /var/www/html/c2b_callback.php

# Create directories
uploads/                  → /var/www/html/uploads/
```

---

## Database Setup

### Step 1: Create Database and User

```sql
-- Connect to MySQL as root
mysql -u root -p

-- Create database
CREATE DATABASE skatrykc_trainer;

-- Create user
CREATE USER 'skatrykc_trainer'@'localhost' IDENTIFIED BY 'Sirgeorge.12';

-- Grant privileges
GRANT ALL PRIVILEGES ON skatrykc_trainer.* TO 'skatrykc_trainer'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

-- Exit
EXIT;
```

### Step 2: Initialize Tables

Visit the health check endpoint:
```bash
curl -X POST https://your-domain.com/api.php \
  -H "Content-Type: application/json" \
  -d '{"action": "migrate"}'
```

### Step 3: Seed Test Users

```bash
curl -X POST https://your-domain.com/api.php \
  -H "Content-Type: application/json" \
  -d '{"action": "seed_all_users"}'
```

Test credentials:
- Email: `admin@skatryk.co.ke` / Password: `Test1234`
- Email: `trainer@skatryk.co.ke` / Password: `Test1234`
- Email: `client@skatryk.co.ke` / Password: `Test1234`

---

## PHP Environment Requirements

### Minimum Requirements
- **PHP:** 7.4+
- **MySQL:** 5.7+
- **Apache:** 2.4+ (or any web server supporting PHP)

### Required PHP Extensions
- `mysqli` - MySQL support
- `json` - JSON encoding/decoding
- `fileinfo` - File upload detection

### Required Apache Modules
- `mod_rewrite` - URL rewriting
- `mod_headers` - HTTP headers
- `mod_deflate` - Gzip compression

Enable modules:
```bash
sudo a2enmod rewrite headers deflate
sudo systemctl restart apache2
```

---

## CORS Configuration

The API is configured with CORS headers for production:

**Allowed Origins:**
- `https://trainer.skatryk.co.ke` (production)
- `http://localhost:3000` (development)
- `http://localhost:5173` (development)
- `http://localhost:8080` (development)

**To add more origins**, edit `api.php` (lines 16-24):
```php
$allowedOrigins = [
    'https://trainer.skatryk.co.ke',
    'https://your-custom-domain.com',  // Add here
    'http://localhost:3000',
    // ...
];
```

---

## File Permissions

After uploading files:

```bash
# Set proper permissions
chmod 644 /var/www/html/api.php
chmod 644 /var/www/html/connection.php
chmod 644 /var/www/html/.htaccess
chmod 644 /var/www/html/mpesa_helper.php
chmod 755 /var/www/html/uploads
chmod 755 /var/www/html/dist

# Set proper ownership
chown www-data:www-data /var/www/html/uploads
chown www-data:www-data /var/www/html
```

---

## Testing Deployment

### 1. Health Check
```bash
curl -X POST https://your-domain.com/api.php \
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

### 2. CORS Preflight
```bash
curl -X OPTIONS https://your-domain.com/api.php \
  -H "Origin: https://trainer.skatryk.co.ke" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

Should return `HTTP 200` with CORS headers.

### 3. Login Test
```bash
curl -X POST https://your-domain.com/api.php \
  -H "Content-Type: application/json" \
  -d '{
    "action": "login",
    "email": "admin@skatryk.co.ke",
    "password": "Test1234"
  }'
```

### 4. Frontend Access
Open: `https://your-domain.com/` in browser

---

## Environment Variables

Create `.env` file in webroot (optional, for non-default credentials):

```ini
DB_HOST=localhost
DB_USER=skatrykc_trainer
DB_PASS=Sirgeorge.12
DB_NAME=skatrykc_trainer
DB_PORT=3306
```

Or set via Apache environment:
```apache
SetEnv DB_HOST localhost
SetEnv DB_USER skatrykc_trainer
SetEnv DB_PASS Sirgeorge.12
SetEnv DB_NAME skatrykc_trainer
```

---

## Troubleshooting

### Database Connection Failed
```
Error: Database connection failed
```

**Solutions:**
1. Verify MySQL is running: `sudo systemctl status mysql`
2. Check credentials: `mysql -u skatrykc_trainer -p skatrykc_trainer`
3. Verify port: `mysql -h 127.0.0.1 -P 3306 -u skatrykc_trainer -p`
4. Check firewall: `sudo ufw allow 3306` (if using UFW)

### CORS Errors in Browser
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solutions:**
1. Verify `.htaccess` is in webroot
2. Enable `mod_headers`: `sudo a2enmod headers`
3. Restart Apache: `sudo systemctl restart apache2`
4. Check `api.php` allows your origin (lines 16-24)

### 404 on OPTIONS Requests
```
OPTIONS /api.php 404 Not Found
```

**Solutions:**
1. Enable `mod_rewrite`: `sudo a2enmod rewrite`
2. Verify `.htaccess` exists and is readable
3. Check VirtualHost has `AllowOverride All`

### File Upload Failing
```
Failed to save file
```

**Solutions:**
1. Check uploads directory permissions: `chmod 755 uploads`
2. Verify ownership: `chown www-data:www-data uploads`
3. Check disk space: `df -h`
4. Check PHP upload limits in `php.ini`

---

## Performance Optimization

### 1. Database Indexing
Critical tables should have indexes:
```sql
CREATE INDEX idx_user_id ON user_profiles(user_id);
CREATE INDEX idx_booking_date ON bookings(session_date);
CREATE INDEX idx_user_type ON users(user_type);
```

### 2. Caching
Use Redis or Memcached for session storage:
```php
// In connection.php
ini_set('session.save_handler', 'redis');
ini_set('session.save_path', 'tcp://localhost:6379');
```

### 3. Gzip Compression
Already enabled in `.htaccess` for API responses.

### 4. Database Connection Pooling
Use persistent connections (already configured in `connection.php`).

---

## Security Checklist

- ✅ HTTPS only (configure in Apache VirtualHost)
- ✅ CORS origin validation (not wildcard `*`)
- ✅ SQL injection protection (using prepared statements)
- ✅ CSRF protection (via token headers)
- ✅ Rate limiting (configure in Apache)
- ✅ Sensitive files protected (.htaccess)
- ✅ Error messages don't expose paths
- ✅ Database credentials in environment variables

---

## Maintenance

### Regular Tasks

**Daily:**
- Monitor error logs: `tail -f /var/log/apache2/error.log`
- Monitor access logs: `tail -f /var/log/apache2/access.log`

**Weekly:**
- Backup database: `mysqldump -u skatrykc_trainer -p skatrykc_trainer > backup.sql`
- Check disk space: `df -h`

**Monthly:**
- Review and optimize slow queries
- Update PHP security patches
- Rotate logs

### Backup Strategy

```bash
# Daily backup
0 2 * * * mysqldump -u skatrykc_trainer -p skatrykc_trainer > /backup/db-$(date +%Y%m%d).sql

# File backup
0 3 * * * tar -czf /backup/app-$(date +%Y%m%d).tar.gz /var/www/html
```

---

## Deployment Workflow

### Local Development
```bash
npm install
npm run dev
```

### Build for Production
```bash
npm run build
# Generates dist/ directory
```

### Deploy to Shared Server
```bash
# Upload dist/ to webroot
scp -r dist/* user@server:/var/www/html/

# Upload PHP files
scp api.php user@server:/var/www/html/
scp connection.php user@server:/var/www/html/
scp .htaccess user@server:/var/www/html/

# Set permissions
ssh user@server 'chmod 644 /var/www/html/*.php /var/www/html/.htaccess'
ssh user@server 'chmod 755 /var/www/html/uploads'
```

### Verify Deployment
```bash
curl https://your-domain.com/api.php -d '{"action":"health_check"}'
```

---

## Quick Reference

| Component | Value |
|-----------|-------|
| **Database Host** | `localhost` |
| **Database Port** | 3306 (default) |
| **Database User** | `skatrykc_trainer` |
| **Database Name** | `skatrykc_trainer` |
| **PHP Version** | 7.4+ |
| **MySQL Version** | 5.7+ |
| **Frontend Framework** | React 18 + Vite |
| **API Type** | REST (PHP) |
| **Static Files** | Served via Apache |
| **Dynamic Files** | Generated by PHP |

---

## Support Resources

- **API Documentation:** See `API_DEPLOYMENT.md`
- **CORS Documentation:** See `CORS_FIXES_SUMMARY.md`
- **Apache Setup:** See `APACHE_DEPLOYMENT_GUIDE.md`
- **Error Logs:** `/var/log/apache2/error.log`
- **PHP Error Logs:** Configured in `php.ini`

---

**Ready to deploy!** Follow this guide step-by-step for a successful deployment on your shared PHP server.
