# Setup Instructions

## Database Migration & Seeding

To set up the application with the users table and test accounts, follow these steps:

### 1. Run the Migrations

First, create the `users` table:

```bash
php scripts/migrate_users_table.php
```

Then create the `user_profiles` table to store user type and profile information:

```bash
php scripts/migrate_user_profiles.php
```

The `users` table will have the following columns:
- id (VARCHAR 36, PRIMARY KEY)
- email (VARCHAR 255, UNIQUE)
- phone (VARCHAR 20)
- password_hash (VARCHAR 255) - Uses PHP's password_hash()
- first_name (VARCHAR 100)
- last_name (VARCHAR 100)
- date_of_birth (DATE)
- status (VARCHAR 50, DEFAULT: 'active')
- balance (DECIMAL 15,2, DEFAULT: 0)
- bonus_balance (DECIMAL 15,2, DEFAULT: 0)
- currency (VARCHAR 3, DEFAULT: 'KES')
- country (VARCHAR 100)
- email_verified (BOOLEAN, DEFAULT: FALSE)
- phone_verified (BOOLEAN, DEFAULT: FALSE)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- last_login (TIMESTAMP)
- kyc_status (VARCHAR 50, DEFAULT: 'pending')

### 2. Seed Test Users

You can seed test users in three ways:

#### Option A: Using the Admin Setup Page (UI - Recommended)
Navigate to `http://localhost:5173/setup` in your browser to access the Admin Setup page, which provides a visual interface to:
1. Run the database migration
2. Seed all test users

#### Option B: Using the API Endpoint
Call the seed endpoint directly via HTTP:

```bash
curl -X POST https://trainer.skatryk.co.ke/api.php \
  -H "Content-Type: application/json" \
  -d '{"action":"seed_all_users"}'
```

Response example:
```json
{
  "status": "success",
  "message": "Seeding complete: 3 created, 0 already exist.",
  "data": {
    "seeded": 3,
    "skipped": 0
  }
}
```

#### Option B: Using PHP Script
Run the seeding script directly:

```bash
php scripts/seed_test_users.php
```

This creates the following test users, all with password `Test1234`:

| Email | Type | Password |
|-------|------|----------|
| admin@skatryk.co.ke | admin | Test1234 |
| trainer@skatryk.co.ke | trainer | Test1234 |
| client@skatryk.co.ke | client | Test1234 |

## API Endpoints

### Login

**Request:**
```json
{
  "action": "login",
  "email": "admin@skatryk.co.ke",
  "password": "Test1234"
}
```

**Response (Success):**
```json
{
  "status": "success",
  "message": "Login successful.",
  "data": {
    "user": {
      "id": "user_xyz",
      "email": "admin@skatryk.co.ke",
      "first_name": "Admin",
      "last_name": "User"
    },
    "session": {
      "access_token": "base64_encoded_token"
    }
  }
}
```

### Signup

**Request:**
```json
{
  "action": "signup",
  "email": "newuser@example.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+254712345678",
  "country": "Kenya"
}
```

**Response (Success):**
```json
{
  "status": "success",
  "message": "Signup successful.",
  "data": {
    "user": {
      "id": "user_abc",
      "email": "newuser@example.com",
      "first_name": "John",
      "last_name": "Doe"
    },
    "session": {
      "access_token": "base64_encoded_token"
    }
  }
}
```

## Testing Login

Once migration and seeding are complete, you can test the login endpoint using curl:

```bash
curl -X POST http://localhost:3000/api.php \
  -H "Content-Type: application/json" \
  -d '{
    "action": "login",
    "email": "admin@skatryk.co.ke",
    "password": "Test1234"
  }'
```

Or test through the React app's login form.
