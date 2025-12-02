# Quick Reference: Deploy Trainer Profile Tables

## TL;DR - Run This Command

```bash
# Local MySQL database
mysql -u username -p database_name < scripts/deploy_trainer_profile_tables.sql

# Then verify
mysql -u username -p database_name -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('trainer_availability','transactions','payout_requests','reported_issues','user_wallets','promotion_requests');"
```

---

## What Gets Deployed

| Table | Purpose | API Functions |
|-------|---------|---------------|
| **trainer_availability** | Trainer time slots | getAvailability, setAvailability, updateAvailability |
| **transactions** | Wallet ledger | getTransactions |
| **payout_requests** | Trainer withdrawals | getPayoutRequests, requestPayout |
| **reported_issues** | Support tickets | reportIssue, getIssues, updateIssueStatus |
| **user_wallets** | User balance accounts | getWalletBalance, updateWalletBalance |
| **promotion_requests** | Trainer promotions | createPromotionRequest, getPromotionRequests |

---

## Deployment Checklist

- [ ] Have MySQL admin credentials ready
- [ ] Know your database name
- [ ] Have backup of database (recommended)
- [ ] File path: `scripts/deploy_trainer_profile_tables.sql`
- [ ] Run deployment command
- [ ] Run verification query (see below)
- [ ] Test trainer profile features in app
- [ ] Check application logs for errors
- [ ] Optionally clean up old tables

---

## Verify Deployment

```sql
-- Run this after deployment
SELECT TABLE_NAME, TABLE_ROWS 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME IN ('trainer_availability','transactions','payout_requests','reported_issues','user_wallets','promotion_requests') 
ORDER BY TABLE_NAME;
```

**Expected Output:** 6 rows showing the new tables

---

## What the Script Handles Automatically

✅ Renames existing `issues` → `reported_issues_old` (data preserved)  
✅ Renames existing `promotions` → `promotions_old` (data preserved)  
✅ Creates 6 new tables with proper schemas  
✅ Migrates data from old tables to new ones  
✅ Initializes `user_wallets` for all existing users  
✅ Sets up foreign keys and indexes  

---

## Troubleshooting Fast

| Problem | Solution |
|---------|----------|
| "Table already exists" | Script is idempotent - rerun safely |
| Timeout | Increase: `mysql --connect-timeout=120 ...` |
| Permission denied | Check MySQL credentials and user privileges |
| Foreign key error | Verify `users` and `payment_methods` tables exist |
| Script hangs | Check for table locks: `SHOW OPEN TABLES WHERE In_use > 0;` |

---

## Cleanup (Optional)

After verifying success, remove old backup tables:

```sql
DROP TABLE IF EXISTS `reported_issues_old`;
DROP TABLE IF EXISTS `promotions_old`;
```

---

## Key Files

- **Script:** `scripts/deploy_trainer_profile_tables.sql` (448 lines, fully documented)
- **Full Guide:** `docs/DEPLOYMENT_GUIDE.md` (418 lines, detailed instructions)
- **Audit Report:** `docs/TRAINER_PROFILE_AUDIT.md` (405 lines, findings & analysis)

---

## Connection Examples

### MySQL CLI
```bash
mysql -h localhost -u root -p myapp_db < scripts/deploy_trainer_profile_tables.sql
```

### Remote Server (SSH)
```bash
mysql -h db.example.com -u admin -p myapp_db < scripts/deploy_trainer_profile_tables.sql
```

### Docker MySQL
```bash
docker exec mysql_container mysql -u root -p myapp_db < scripts/deploy_trainer_profile_tables.sql
```

### PHPMyAdmin
1. Import tab
2. Choose file
3. Click Go

---

## Features Enabled After Deployment

✅ Trainer availability scheduling  
✅ Trainer payout requests  
✅ User wallet management  
✅ Transaction history  
✅ Support ticket system  
✅ Trainer profile promotions  

---

## Need Help?

1. See **DEPLOYMENT_GUIDE.md** for detailed instructions
2. See **TRAINER_PROFILE_AUDIT.md** for technical details
3. Check application logs after deployment
4. Verify all prerequisites exist: `users`, `payment_methods`, `user_profiles`

---

**Status:** ✅ Ready to deploy
