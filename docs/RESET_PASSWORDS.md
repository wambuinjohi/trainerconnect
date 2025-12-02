# Reset User Passwords

This guide explains how to reset test user passwords for the TrainerCoachConnect application.

## Available Scripts

There are three ways to reset passwords:

### 1. NPM Script (Recommended)

```bash
npm run reset-passwords
```

This uses the Node.js script and resets all test user passwords to `Pass1234`.

### 2. Node.js Script

```bash
node scripts/reset_passwords.js [API_URL]
```

**Examples:**
```bash
# Use default URL (https://trainer.skatryk.co.ke/api.php)
node scripts/reset_passwords.js

# Use custom URL
node scripts/reset_passwords.js https://trainer.skatryk.co.ke/api.php
```

### 3. Bash Script

```bash
bash scripts/reset_passwords.sh [API_URL]
```

**Examples:**
```bash
# Use default URL
bash scripts/reset_passwords.sh

# Use custom URL
bash scripts/reset_passwords.sh https://trainer.skatryk.co.ke/api.php
```

### 4. PHP Script

```bash
php scripts/reset_passwords.php [API_URL]
```

**Examples:**
```bash
# Use default URL
php scripts/reset_passwords.php

# Use custom URL
php scripts/reset_passwords.php https://trainer.skatryk.co.ke/api.php
```

## Test User Credentials After Reset

After running any of these scripts, the test user credentials are:

- **Admin**: `admin@skatryk.co.ke` / `Pass1234`
- **Trainer**: `trainer@skatryk.co.ke` / `Pass1234`
- **Client**: `client@skatryk.co.ke` / `Pass1234`

## API Endpoint

The scripts call the `/api.php` endpoint with the following payload:

```json
{
  "action": "reset_passwords"
}
```

This action:
1. Resets the password for all three test users
2. Uses bcrypt (PASSWORD_BCRYPT) for hashing
3. Sets the password to `Pass1234`
4. Logs each password reset for audit purposes

## Troubleshooting

### "Server returned non-JSON response"

This usually means:
- The API endpoint is not accessible
- The API is returning an error (HTML error page)
- The server is down

**Solution**: Check that your API URL is correct and the server is running.

### "Failed to connect to API"

The API endpoint could not be reached.

**Solution**: 
- Verify the API URL is correct
- Check your internet connection
- Ensure the remote server is accessible
- For local development, update the API URL accordingly

### Manual Reset via Database

If the API scripts fail, you can reset passwords directly in the database:

```sql
UPDATE users 
SET password_hash = '$2y$10$your_bcrypt_hash_here' 
WHERE email IN ('admin@skatryk.co.ke', 'trainer@skatryk.co.ke', 'client@skatryk.co.ke');
```

To generate a bcrypt hash for `Pass1234`, run:
```php
<?php echo password_hash('Pass1234', PASSWORD_BCRYPT); ?>
```

## Environment Configuration

To use a different API endpoint or environment, simply pass the URL as an argument:

```bash
npm run reset-passwords  # Uses https://trainer.skatryk.co.ke/api.php

node scripts/reset_passwords.js http://localhost:3000/api.php  # Local
node scripts/reset_passwords.js https://staging.example.com/api.php  # Staging
```
