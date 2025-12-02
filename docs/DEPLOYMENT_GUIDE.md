# MySQL Deployment Guide - Trainer Profile Tables

## Overview

This guide walks through deploying the 6 missing trainer profile database tables to your MySQL database.

**File:** `scripts/deploy_trainer_profile_tables.sql`

---

## Prerequisites

- MySQL 5.7 or later (5.7.18+)
- Database admin credentials
- Read/write access to your application database
- Backup of your database (recommended for production)

---

## Deployment Methods

### Method 1: MySQL Command Line (Recommended)

```bash
# Local database
mysql -u username -p database_name < scripts/deploy_trainer_profile_tables.sql

# Remote database
mysql -h your-host.com -u username -p database_name < scripts/deploy_trainer_profile_tables.sql

# With password in command (less secure)
mysql -h localhost -u root -pYourPassword database_name < scripts/deploy_trainer_profile_tables.sql
```

### Method 2: MySQL Workbench

1. Open MySQL Workbench
2. Connect to your database
3. File → Open SQL Script
4. Select `scripts/deploy_trainer_profile_tables.sql`
5. Execute (Ctrl+Shift+Enter or ⌘+Shift+Enter)

### Method 3: PHPMyAdmin

1. Log in to PHPMyAdmin
2. Select your database
3. Go to "Import" tab
4. Choose `scripts/deploy_trainer_profile_tables.sql`
5. Click "Go"

### Method 4: Via Application (PHP/Node Script)

```php
<?php
$connection = new mysqli('localhost', 'username', 'password', 'database');
$sql = file_get_contents('scripts/deploy_trainer_profile_tables.sql');
$statements = explode(';', $sql);

foreach ($statements as $statement) {
    $statement = trim($statement);
    if (!empty($statement)) {
        if (!$connection->query($statement)) {
            echo "Error: " . $connection->error . "\n";
        }
    }
}
echo "Migration complete!";
?>
```

---

## What the Script Does

### ✅ Step 1: Handles Existing Tables
- If `issues` table exists → renames to `reported_issues_old` (preserves data)
- If `promotions` table exists → renames to `promotions_old` (preserves data)

### ✅ Step 2: Creates 6 New Tables
1. **trainer_availability** - Trainer time slots
2. **transactions** - Wallet transaction ledger
3. **payout_requests** - Trainer payout requests
4. **reported_issues** - Support tickets & complaints
5. **user_wallets** - User wallet accounts
6. **promotion_requests** - Trainer promotions

### ✅ Step 3: Migrates Existing Data
- Automatically copies data from `reported_issues_old` → `reported_issues`
- Automatically copies data from `promotions_old` → `promotion_requests`
- Initializes `user_wallets` for all existing users

### ✅ Step 4: Creates Indexes
- Foreign keys for referential integrity
- Indexes on frequently queried columns (trainer_id, user_id, status, created_at)
- Unique constraints where needed

---

## Expected Output

When the script completes successfully, you'll see:

```
+------------------------+
| TABLE_NAME             |
+------------------------+
| payout_requests        |
| promotion_requests     |
| reported_issues        |
| trainer_availability   |
| transactions           |
| user_wallets           |
+------------------------+
```

And optionally, if old tables existed and were migrated:

```
+-----------------------+
| TABLE_NAME            |
+-----------------------+
| promotion_requests_old |
| reported_issues_old    |
+-----------------------+
```

---

## Verification Steps

### 1. Check Tables Were Created

```sql
SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME IN (
  'trainer_availability',
  'transactions', 
  'payout_requests',
  'reported_issues',
  'user_wallets',
  'promotion_requests'
)
ORDER BY TABLE_NAME;
```

### 2. Check Data Migration (if applicable)

```sql
-- Check reported_issues migration
SELECT COUNT(*) as reported_issues_count FROM reported_issues;
SELECT COUNT(*) as old_issues_count FROM reported_issues_old;

-- Check promotion_requests migration  
SELECT COUNT(*) as promotion_requests_count FROM promotion_requests;
SELECT COUNT(*) as old_promotions_count FROM promotions_old;
```

### 3. Check User Wallets Initialized

```sql
SELECT COUNT(*) as wallet_count FROM user_wallets;
SELECT COUNT(*) as user_count FROM users;
-- Should be equal or close (user_wallets count = user count)
```

### 4. Check Foreign Keys

```sql
SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME 
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME IN (
  'trainer_availability',
  'transactions',
  'payout_requests', 
  'reported_issues',
  'user_wallets',
  'promotion_requests'
)
AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, CONSTRAINT_NAME;
```

---

## Cleanup (After Verification)

Once you've verified the migration was successful, you can remove the old tables:

```sql
DROP TABLE IF EXISTS `reported_issues_old`;
DROP TABLE IF EXISTS `promotions_old`;
```

Or uncomment the cleanup section at the bottom of `deploy_trainer_profile_tables.sql`:

```sql
-- DROP TABLE IF EXISTS `reported_issues_old`;
-- DROP TABLE IF EXISTS `promotions_old`;
```

---

## Troubleshooting

### Error: "Table already exists"

**Cause:** The script uses `CREATE TABLE IF NOT EXISTS`, so this shouldn't happen.

**Solution:** If it does, check that foreign key references exist:
```sql
-- Verify users table exists
SELECT COUNT(*) FROM users LIMIT 1;

-- Verify payment_methods table exists
SELECT COUNT(*) FROM payment_methods LIMIT 1;
```

### Error: "Cannot add or update child row"

**Cause:** Foreign key constraint violation during data migration.

**Solution:** Check that referenced tables have the required data:
```sql
-- Check if trainer_id values exist in users table
SELECT DISTINCT trainer_id FROM reported_issues_old 
WHERE trainer_id NOT IN (SELECT id FROM users);
```

### Error: "Constraint error during migration"

**Cause:** Data in old tables violates new constraints.

**Solution:** Manually review and clean old data before running:
```sql
-- Find records with invalid references
SELECT * FROM reported_issues_old 
WHERE user_id NOT IN (SELECT id FROM users);

-- Delete or fix these records
DELETE FROM reported_issues_old 
WHERE user_id NOT IN (SELECT id FROM users);
```

### Script Hangs or Times Out

**Cause:** Large data sets, slow connection, or locked tables.

**Solution:**
```bash
# Increase timeout
mysql -u username -p database_name --connect-timeout=60 < scripts/deploy_trainer_profile_tables.sql

# Or run with max execution time
mysql --max_allowed_packet=16M -u username -p database_name < scripts/deploy_trainer_profile_tables.sql
```

---

## Rollback Instructions

If you need to rollback:

```sql
-- Drop all new tables
DROP TABLE IF EXISTS `trainer_availability`;
DROP TABLE IF EXISTS `transactions`;
DROP TABLE IF EXISTS `payout_requests`;
DROP TABLE IF EXISTS `reported_issues`;
DROP TABLE IF EXISTS `user_wallets`;
DROP TABLE IF EXISTS `promotion_requests`;

-- Restore old tables if they still exist
-- (Only if you didn't run DROP TABLE statements)
ALTER TABLE `reported_issues_old` RENAME TO `issues`;
ALTER TABLE `promotions_old` RENAME TO `promotions`;
```

---

## Production Considerations

### Backup Before Deployment

```bash
# Create backup
mysqldump -u username -p database_name > backup_before_trainer_tables.sql

# Or for all databases
mysqldump -u username -p --all-databases > full_backup.sql
```

### Run During Maintenance Window

- Deploy during low-traffic periods
- Avoid peak business hours
- Plan for 5-15 minutes of execution time
- Have a rollback plan ready

### Monitor After Deployment

After running the script:

1. Check application logs for any errors
2. Test trainer profile functionality
3. Verify availability scheduling works
4. Test payout requests
5. Check wallet balance displays
6. Ensure issue reporting works

---

## Post-Deployment Setup

### 1. Initialize Trainer Wallets (Optional)

If you want to set initial balances for trainers:

```sql
UPDATE user_wallets w
JOIN users u ON w.user_id = u.id
JOIN user_profiles up ON u.id = up.user_id
SET w.balance = COALESCE(u.balance, 0),
    w.pending_balance = 0,
    w.total_earned = 0,
    w.currency = COALESCE(u.currency, 'KES')
WHERE up.user_type = 'trainer';
```

### 2. Create Admin Views (Optional)

Helpful views for admin dashboard:

```sql
-- Pending payouts
CREATE OR REPLACE VIEW pending_payouts AS
SELECT 
  pr.id,
  u.email,
  up.full_name,
  pr.amount,
  pr.status,
  pr.requested_at
FROM payout_requests pr
JOIN users u ON pr.trainer_id = u.id
JOIN user_profiles up ON u.id = up.user_id
WHERE pr.status = 'pending'
ORDER BY pr.requested_at;

-- Active trainer promotions
CREATE OR REPLACE VIEW active_promotions AS
SELECT 
  prm.id,
  u.email,
  up.full_name,
  prm.promotion_type,
  prm.started_at,
  prm.expires_at,
  prm.status
FROM promotion_requests prm
JOIN users u ON prm.trainer_id = u.id
JOIN user_profiles up ON u.id = up.user_id
WHERE prm.status = 'active'
AND prm.expires_at > NOW();

-- Open support issues
CREATE OR REPLACE VIEW open_issues AS
SELECT 
  ri.id,
  u.email,
  ri.complaint_type,
  ri.status,
  ri.priority,
  ri.created_at
FROM reported_issues ri
JOIN users u ON ri.user_id = u.id
WHERE ri.status IN ('open', 'in_progress')
ORDER BY ri.priority DESC, ri.created_at;
```

---

## Next Steps

1. ✅ **Run the migration script** using one of the methods above
2. ✅ **Verify success** using the verification steps
3. ✅ **Test application** - trainer profile features should now work
4. ✅ **Monitor logs** - watch for any API errors
5. ✅ **Update API handlers** - if any custom code needs updates
6. ✅ **Cleanup old tables** - once verified, drop old table versions

---

## Support

If you encounter issues:

1. Check the **Troubleshooting** section above
2. Review application logs for API errors
3. Verify database connectivity and permissions
4. Ensure MySQL version meets requirements (5.7+)
5. Check that all prerequisite tables exist (users, payment_methods, etc.)

---

## Summary

| Component | Status | Files |
|-----------|--------|-------|
| Migration Script | ✅ Ready | `scripts/deploy_trainer_profile_tables.sql` |
| Audit Report | ✅ Ready | `docs/TRAINER_PROFILE_AUDIT.md` |
| This Guide | ✅ Ready | `docs/DEPLOYMENT_GUIDE.md` |
| Tables (6) | ✅ Ready for Deployment | trainer_availability, transactions, payout_requests, reported_issues, user_wallets, promotion_requests |

**Status:** Ready to deploy! 🚀
