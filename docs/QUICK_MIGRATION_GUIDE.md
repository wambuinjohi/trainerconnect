# Quick Migration Guide

## Overview
This guide provides quick steps to set up all missing client portal tables and API functions.

## What Was Added

**8 New Database Tables:**
- `bookings` - Training session bookings
- `payments` - Payment transactions
- `payment_methods` - User payment methods
- `messages` - Chat messages
- `notifications` - In-app notifications
- `reviews` - Trainer reviews
- `referrals` - Referral codes
- `categories` - Service categories

**5 New/Enhanced API Functions:**
- `booking_insert` - Create bookings
- `messages_mark_read` - Mark messages as read
- `referral_update` - Update referral status
- `payment_method_insert` - Add payment methods
- `profiles_get_by_type` - Get profiles by type (admin, trainer, client)

**User Profile Enhancements:**
- Added location tracking fields to `user_profiles`

---

## Migration Steps

### Option A: Run Master Migration (Recommended)
Execute a single command to create all tables:

```bash
php scripts/migrate_all_client_portal_tables.php
```

This will:
- ✅ Create all 8 tables
- ✅ Show detailed progress
- ✅ Display any errors clearly

### Option B: Run Individual Migrations
If you prefer to run migrations one by one:

```bash
# Core tables
php scripts/migrate_bookings_table.php
php scripts/migrate_payments_table.php
php scripts/migrate_payment_methods_table.php

# Communication
php scripts/migrate_messages_table.php
php scripts/migrate_notifications_table.php

# Engagement
php scripts/migrate_reviews_table.php
php scripts/migrate_referrals_table.php
php scripts/migrate_categories_table.php

# User profile enhancements
php scripts/migrate_user_profiles_add_columns.php
```

### Option C: Using the Admin Setup Page
If you have the admin setup page at `/setup`, you can use it to trigger migrations via the UI.

---

## Verification

### Test the New API Functions

**1. Test Message Mark as Read:**
```bash
curl -X POST http://localhost:3000/api.php \
  -H "Content-Type: application/json" \
  -d '{
    "action": "messages_mark_read",
    "trainer_id": "trainer_uuid",
    "client_id": "client_uuid",
    "read_by_client": 1
  }'
```

**2. Test Get Profiles by Type:**
```bash
curl -X POST http://localhost:3000/api.php \
  -H "Content-Type: application/json" \
  -d '{
    "action": "profiles_get_by_type",
    "user_type": "admin"
  }'
```

**3. Test Create Booking:**
```bash
curl -X POST http://localhost:3000/api.php \
  -H "Content-Type: application/json" \
  -d '{
    "action": "booking_insert",
    "client_id": "user_123",
    "trainer_id": "user_456",
    "session_date": "2024-12-25",
    "session_time": "10:00:00",
    "total_amount": 1000.00
  }'
```

---

## Database Schema Summary

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| bookings | Session bookings | client_id, trainer_id, session_date, status, total_amount |
| payments | Payment records | user_id, booking_id, amount, method, status |
| payment_methods | User payment options | user_id, method, details |
| messages | Chat messages | sender_id, recipient_id, content, read_by_trainer, read_by_client |
| notifications | In-app alerts | user_id, title, body, type, read |
| reviews | Trainer ratings | trainer_id, client_id, rating, comment |
| referrals | Referral codes | code, referrer_id, referee_id, discount_used |
| categories | Service types | name, icon, description |

---

## API Functions Reference

### bookings
- `booking_insert` - Create booking
- `select` table bookings - Get bookings
- `update` table bookings - Update booking status

### payments
- `payment_insert` - Record payment
- `select` table payments - Get payment history

### payment_methods
- `payment_method_insert` - Add payment method
- `payment_methods_get` - List user's payment methods
- `delete` table payment_methods - Remove method

### messages
- `messages_get` - Fetch messages (supports trainer_id/client_id or user_id)
- `message_insert` - Send message
- `messages_mark_read` - Mark as read

### notifications
- `notifications_get` - Fetch notifications
- `notifications_insert` - Create notifications

### reviews
- `review_insert` - Submit review
- `select` table reviews - Get reviews

### referrals
- `referral_get` - Get referral by code
- `referral_update` - Mark referral as used

### categories
- `get_categories` - List all categories
- `add_category` - Create category
- `update_category` - Edit category
- `delete_category` - Remove category

### profiles
- `profiles_get_by_type` - Get profiles by user type (admin/trainer/client)
- `profile_get` - Get single profile
- `profile_update` - Update profile

---

## Common Issues & Solutions

### Issue: "Table already exists"
**Solution**: This is normal. The migrations use `CREATE TABLE IF NOT EXISTS`, so they're safe to run multiple times.

### Issue: "Access denied for user"
**Solution**: Ensure the database user in `connection.php` has CREATE/ALTER TABLE privileges.

### Issue: "Foreign key constraint fails"
**Solution**: Ensure the `users` table exists before running migrations. Run migrations in this order:
1. users and user_profiles (if not already done)
2. categories
3. bookings
4. payments
5. Other tables

### Issue: API returns "Unknown action"
**Solution**: 
1. Verify `api.php` has been updated with the new functions
2. Check the action name spelling (case-sensitive)
3. Ensure the request format is correct

---

## Testing the Client Portal

After migrations, test these features:

1. **Booking Flow**
   - Create booking with `booking_insert`
   - Record payment with `payment_insert`
   - View in ClientDashboard

2. **Messaging**
   - Send message with `message_insert`
   - Mark as read with `messages_mark_read`
   - View in Chat component

3. **Reviews**
   - Submit review with `review_insert`
   - View trainer ratings

4. **Referrals**
   - Fetch referral with `referral_get`
   - Use code in booking
   - Update with `referral_update`

---

## Rollback (If Needed)

To remove the new tables:

```sql
DROP TABLE IF EXISTS `bookings`;
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `payment_methods`;
DROP TABLE IF EXISTS `messages`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `reviews`;
DROP TABLE IF EXISTS `referrals`;
DROP TABLE IF EXISTS `categories`;
```

Then remove location columns from `user_profiles`:
```sql
ALTER TABLE `user_profiles` 
  DROP COLUMN IF EXISTS `location`,
  DROP COLUMN IF EXISTS `location_label`,
  DROP COLUMN IF EXISTS `location_lat`,
  DROP COLUMN IF EXISTS `location_lng`;
```

---

## Support

For detailed information about each table and function, see:
- **Full Audit Report**: `docs/CLIENT_PORTAL_AUDIT.md`
- **API Documentation**: `docs/API_DEPLOYMENT.md`
- **Setup Instructions**: `SETUP_INSTRUCTIONS.md`

---

## Summary

✅ All missing client portal tables created
✅ All missing API functions implemented
✅ User profile enhancements added
✅ Full backward compatibility maintained

Your client portal is now fully functional with complete database and API support!
