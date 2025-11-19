# API Deployment Guide

This guide explains how to deploy `api.php` to your external server at `https://trainer.skatryk.co.ke/api.php`.

## Files to Copy

Copy these files to your external server:
- `api.php` - Main API file
- `connection.php` - Database connection handler
- `.env` - Database configuration (create from `.env.example`)

## Setup Instructions

### Step 1: Copy Files to Server

Copy the following files to the root directory of `https://trainer.skatryk.co.ke/`:

```
/api.php
/connection.php
/.env
```

### Step 2: Create `.env` File

1. On your server, create a `.env` file in the root directory
2. Copy the content from `.env.example` and update with your database credentials:

```env
DB_HOST=your-database-host.com
DB_USER=your-database-user
DB_PASS=your-database-password
DB_NAME=trainer_db
DB_PORT=3306
```

### Step 3: Create Upload Directory

Create the `public/uploads/` directory on your server:

```bash
mkdir -p public/uploads
chmod 755 public/uploads
```

### Step 4: Verify Installation

Test the API by making a POST request:

```bash
curl -X POST https://trainer.skatryk.co.ke/api.php \
  -H "Content-Type: application/json" \
  -d '{"action": "migrate"}'
```

Expected response:
```json
{
  "status": "success",
  "message": "Migration successful: users table created or already exists.",
  "data": null
}
```

## Environment Variables

The API uses the following environment variables (defined in `.env`):

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | Database host address | `localhost` |
| `DB_USER` | Database username | `root` |
| `DB_PASS` | Database password | `` (empty) |
| `DB_NAME` | Database name | `trainer_db` |
| `DB_PORT` | Database port | `3306` |

## Supported Actions

The API supports the following actions:

### Authentication
- `login` - User login
- `signup` - User registration
- `request_password_reset` - Request password reset
- `reset_password_with_token` - Reset password with token
- `reset_passwords` - Reset all test user passwords

### Database Management
- `migrate` - Create users and password_reset_tokens tables
- `seed_all_users` - Seed test users
- `seed_users` - Create test users
- `get_users` - Fetch all users with profiles

### Data Operations
- `select` - Query data
- `insert` - Insert data
- `update` - Update data
- `delete` - Delete data
- `create_table` - Create table dynamically

### File Uploads
- POST with multipart form data (automatic handling)

## CORS Support

The API supports CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Security Notes

⚠️ **Important:** Before deploying to production:

1. **Do NOT commit `.env` files** - They contain sensitive credentials
2. **Use strong database passwords**
3. **Restrict database access** to only your server
4. **Set proper file permissions** on uploads directory (755)
5. **Enable HTTPS** for all API endpoints
6. **Remove test credentials** from production seeding
7. **Implement proper authentication** and authorization

## Troubleshooting

### Database Connection Fails
- Verify `DB_HOST`, `DB_USER`, `DB_PASS` in `.env`
- Ensure database server is accessible from your web server
- Check database user has proper permissions

### Permission Denied on Uploads
- Ensure `public/uploads/` directory is writable (755 or 777)
- Check web server user has write permissions

### CORS Issues
- The API automatically includes CORS headers
- Ensure your server is returning proper Content-Type headers

## Testing from Frontend

Once deployed, update your frontend to point to the external API:

```javascript
const apiUrl = 'https://trainer.skatryk.co.ke/api.php';

const response = await fetch(apiUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'login', email: 'admin@skatryk.co.ke', password: 'Test1234' })
});

const result = await response.json();
console.log(result);
```

## Support

For issues or questions, check:
1. Server logs for PHP errors
2. Database connection settings in `.env`
3. File permissions on upload directory
4. HTTPS certificate validity
