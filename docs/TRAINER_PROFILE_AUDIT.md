# Trainer Profile Database Audit Report

**Date:** Generated from code analysis  
**Status:** ⚠️ INCOMPLETE - Missing 6 critical tables  
**Recommendation:** Deploy `scripts/audit_missing_tables.sql` before production

---

## Executive Summary

The trainer profile system is partially implemented. The frontend (`src/lib/api-service.ts`) references **12 database tables**, but only **6 are currently defined** in the migration files. This audit identifies the **6 missing tables** required for full trainer profile functionality.

### Current Status
- ✅ **6 tables defined** (users, user_profiles, bookings, reviews, payment_methods, messages, etc.)
- ❌ **6 tables missing** (trainer_availability, transactions, payout_requests, reported_issues, user_wallets, promotion_requests)
- 🔴 **Critical Impact:** Trainer availability, wallet management, and payout features will fail

---

## Missing Tables Detail

### 1. **trainer_availability** ⚠️ CRITICAL

**Purpose:** Store trainer available time slots for booking management  
**Status:** Referenced in code but NOT defined

**API Functions Using This Table:**
- `getAvailability(trainerId)` - SELECT from trainer_availability
- `setAvailability(trainerId, slots)` - INSERT into trainer_availability
- `updateAvailability(trainerId, slots)` - UPDATE trainer_availability

**Location in Code:**
- `src/lib/api-service.ts:184-210` (lines 184-210)

**Required Schema:**
```sql
CREATE TABLE trainer_availability (
  id VARCHAR(36) PRIMARY KEY,
  trainer_id VARCHAR(36) NOT NULL UNIQUE,
  slots JSON NOT NULL,  -- Array of {day, startTime, endTime}
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (trainer_id) REFERENCES users(id)
);
```

---

### 2. **transactions** ⚠️ IMPORTANT

**Purpose:** Wallet transaction ledger (income, expenses, refunds, bonuses)  
**Status:** Referenced in code but NOT defined

**API Functions Using This Table:**
- `getTransactions(userId, type?)` - SELECT with type filter (income/expense)

**Location in Code:**
- `src/lib/api-service.ts:268-277` (lines 268-277)

**Used by:**
- Trainer wallet management
- Financial reporting
- Balance tracking

**Required Schema:**
```sql
CREATE TABLE transactions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(50),  -- 'income', 'expense', 'bonus', 'refund'
  amount DECIMAL(15, 2),
  balance_before DECIMAL(15, 2),
  balance_after DECIMAL(15, 2),
  reference VARCHAR(255),  -- booking_id, payout_id, etc.
  description TEXT,
  status VARCHAR(50) DEFAULT 'completed',
  created_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

### 3. **payout_requests** ⚠️ CRITICAL

**Purpose:** Track trainer withdrawal/payout requests  
**Status:** Referenced in code but NOT defined

**API Functions Using This Table:**
- `getPayoutRequests(trainerId)` - SELECT from payout_requests
- `requestPayout(trainerId, amount)` - INSERT into payout_requests

**Location in Code:**
- `src/lib/api-service.ts:280-298` (lines 280-298)

**Components Using This:**
- `src/components/trainer/Payouts.tsx` - Payout management UI

**Required Schema:**
```sql
CREATE TABLE payout_requests (
  id VARCHAR(36) PRIMARY KEY,
  trainer_id VARCHAR(36) NOT NULL,
  amount DECIMAL(15, 2),
  status VARCHAR(50) DEFAULT 'pending',  -- pending, processing, completed
  requested_at TIMESTAMP,
  processed_at TIMESTAMP,
  created_at TIMESTAMP,
  FOREIGN KEY (trainer_id) REFERENCES users(id)
);
```

---

### 4. **reported_issues** ⚠️ IMPORTANT

**Purpose:** User complaints and support tickets  
**Status:** **NAMING MISMATCH** - API expects `reported_issues`, migrations define `issues`

**API Functions Using This Table:**
- `reportIssue(data)` - INSERT into `reported_issues`
- `getIssues(filter?)` - SELECT from `reported_issues`
- `updateIssueStatus(issueId, status)` - UPDATE `reported_issues`

**Location in Code:**
- `src/lib/api-service.ts:331-359` (lines 331-359)

**Current Migration Defines:** `public.issues` (Postgres) ❌ Wrong name

**Components Using This:**
- `src/components/trainer/TrainerReportIssue.tsx`

**Action Required:**
- Either rename the existing `issues` table to `reported_issues`
- Or create `reported_issues` table and deprecate `issues`

**Required Schema:**
```sql
CREATE TABLE reported_issues (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  trainer_id VARCHAR(36),
  booking_reference VARCHAR(100),
  complaint_type VARCHAR(100),  -- booking_issue, payment_issue, trainer_conduct
  title VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'open',
  priority VARCHAR(50) DEFAULT 'normal',
  attachments JSON,
  resolution TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

### 5. **user_wallets** ⚠️ IMPORTANT

**Purpose:** Track user account balance and wallet state  
**Status:** Referenced in code but NOT defined

**API Functions Using This Table:**
- `getWalletBalance(userId)` - SELECT from user_wallets
- `updateWalletBalance(userId, amount)` - UPDATE user_wallets

**Location in Code:**
- `src/lib/api-service.ts:365-378` (lines 365-378)

**Used by:**
- Trainer earnings tracking
- Client credit management
- Balance display in dashboard

**Note:** Users table has `balance` and `bonus_balance`, but wallet operations expect a dedicated wallets table.

**Required Schema:**
```sql
CREATE TABLE user_wallets (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL UNIQUE,
  balance DECIMAL(15, 2) DEFAULT 0,
  pending_balance DECIMAL(15, 2) DEFAULT 0,  -- Awaiting payout
  total_earned DECIMAL(15, 2) DEFAULT 0,
  total_spent DECIMAL(15, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'KES',
  last_transaction_at TIMESTAMP,
  created_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

### 6. **promotion_requests** ⚠️ IMPORTANT

**Purpose:** Trainer profile promotion/boosting features  
**Status:** **NAMING MISMATCH** - API expects `promotion_requests`, migrations define `promotions`

**API Functions Using This Table:**
- `createPromotionRequest(data)` - INSERT into `promotion_requests`
- `getPromotionRequests(filter?)` - SELECT from `promotion_requests`

**Location in Code:**
- `src/lib/api-service.ts:384-404` (lines 384-404)

**Current Migration Defines:** `public.promotions` (Postgres) ❌ Wrong name

**Components Using This:**
- `src/components/trainer/PromoteProfile.tsx`

**Action Required:**
- Either rename the existing `promotions` table to `promotion_requests`
- Or create `promotion_requests` table and deprecate `promotions`

**Required Schema:**
```sql
CREATE TABLE promotion_requests (
  id VARCHAR(36) PRIMARY KEY,
  trainer_id VARCHAR(36) NOT NULL,
  promotion_type VARCHAR(100),  -- profile_boost, featured_listing
  status VARCHAR(50) DEFAULT 'pending',
  duration_days INT,
  commission_rate DECIMAL(5, 2),
  cost DECIMAL(15, 2),
  features JSON,
  approved_by VARCHAR(36),
  started_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP,
  FOREIGN KEY (trainer_id) REFERENCES users(id)
);
```

---

## Tables Already Defined ✅

### Existing (Properly Defined)
1. **users** - User accounts (users table in api.php)
2. **password_reset_tokens** - Password reset flow
3. **user_profiles** - User profile data (includes trainer fields)
4. **bookings** - Booking/session records
5. **reviews** - Client reviews of trainers
6. **payment_methods** - User payment instruments
7. **messages** - Chat/messaging between users
8. **categories** - Service categories
9. **notifications** - User notifications
10. **services** - Trainer services offered
11. **payments** - Payment transactions
12. **payouts** - Trainer payout records
13. **referrals** - Referral tracking
14. **platform_secrets** - Configuration storage

---

## Trainer Profile Data Structure

### Frontend Interface (TrainerProfileEditor.tsx:11-24)

```typescript
interface TrainerProfile {
  user_id?: string
  user_type?: string
  name?: string
  disciplines?: string[] | string  // JSON in DB
  certifications?: string[] | string  // JSON in DB
  hourly_rate?: number
  hourly_rate_by_radius?: Array<{ radius_km: number; rate: number }>  // JSON
  service_radius?: number
  availability?: any  // JSON - stored in trainer_availability
  payout_details?: any  // JSON
  profile_image?: string
  bio?: string
}
```

### Database Columns (user_profiles)

Trainer-specific columns added to user_profiles:
- `disciplines` (JSON) - Training disciplines
- `hourly_rate` (DECIMAL) - Base hourly rate
- `hourly_rate_by_radius` (JSON) - Tiered rates by distance
- `service_radius` (INT) - Service area radius in km
- `availability` (JSON) - Availability slots
- `payout_details` (JSON) - Payment details for trainers
- `rating` (DECIMAL) - Average rating
- `total_reviews` (INT) - Review count
- `is_approved` (BOOLEAN) - Admin approval status
- `location_lat`, `location_lng`, `location_label` - Service location

---

## Migration Path

### Step 1: Immediate Action (Required)
Run `scripts/audit_missing_tables.sql` to create all 6 missing tables:
```bash
# MySQL
mysql -u username -p database_name < scripts/audit_missing_tables.sql

# Postgres
psql -U username -d database_name -f scripts/audit_missing_tables.sql
```

### Step 2: Handle Naming Conflicts (Choose One Approach)

**Option A: Keep Existing, Add Aliases** (Low Risk)
- Keep `issues` table, add `reported_issues` as an alias
- Keep `promotions` table, add `promotion_requests` as an alias

**Option B: Rename Tables** (Medium Risk)
```sql
-- Rename issues to reported_issues
ALTER TABLE issues RENAME TO reported_issues;

-- Rename promotions to promotion_requests
ALTER TABLE promotions RENAME TO promotion_requests;
```

**Option C: Create New, Deprecate Old** (Higher Risk)
- Create `reported_issues` from `issues` data
- Create `promotion_requests` from `promotions` data
- Migrate code to use new tables

**Recommendation:** Use Option A (aliases) for immediate compatibility.

### Step 3: Initialize Wallet Records (Important)
After creating `user_wallets`, populate existing users:
```sql
-- MySQL
INSERT INTO user_wallets (id, user_id, balance, total_earned, currency)
SELECT CONCAT('wallet_', UUID()), id, COALESCE(balance, 0), 0, COALESCE(currency, 'KES')
FROM users
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);
```

---

## Validation Checklist

After deployment, verify:

- [ ] All 6 tables created successfully
- [ ] Foreign keys properly configured
- [ ] Indexes created for performance
- [ ] No constraint violations
- [ ] Trainer can set availability (trainer_availability)
- [ ] Payout requests work (payout_requests)
- [ ] Wallet balance loads correctly (user_wallets)
- [ ] Issues can be reported (reported_issues)
- [ ] Promotion requests process (promotion_requests)
- [ ] Transaction history records (transactions)

---

## Performance Recommendations

### Indexes (Already Included in Script)
All provided CREATE TABLE statements include appropriate indexes on:
- Foreign keys (trainer_id, user_id)
- Status columns (for filtering)
- Created/updated timestamps (for sorting)
- Unique constraints where needed

### Query Optimization
For high-traffic trainer availability queries, consider:
- Caching availability slots in Redis
- Partitioning large transactions table by date
- Denormalizing trainer_availability with trainer rating

---

## References

**Related Code Files:**
- `src/lib/api-service.ts` - API service layer (all table references)
- `src/components/trainer/TrainerProfileEditor.tsx` - Profile structure
- `src/components/trainer/Payouts.tsx` - Payout functionality
- `src/components/trainer/PromoteProfile.tsx` - Promotion requests
- `src/components/trainer/TrainerReportIssue.tsx` - Issue reporting
- `api.php` - Backend API handlers

**Migration Files:**
- `scripts/migrations.sql` - Postgres schema (partial)
- `scripts/migrate_user_profiles.php` - MySQL user_profiles
- `scripts/migrate_users_table.php` - MySQL users table
- `scripts/audit_missing_tables.sql` - **NEW - Missing tables**

---

## Summary

| Table | Status | Impact | Priority |
|-------|--------|--------|----------|
| trainer_availability | ❌ Missing | Availability feature broken | 🔴 CRITICAL |
| transactions | ❌ Missing | Wallet history unavailable | 🟡 HIGH |
| payout_requests | ❌ Missing | Payout feature broken | 🔴 CRITICAL |
| reported_issues | ❌ Misnamed | Issue reporting broken | 🟡 HIGH |
| user_wallets | ❌ Missing | Balance tracking broken | 🟡 HIGH |
| promotion_requests | ❌ Misnamed | Promotion feature broken | 🟡 MEDIUM |

**Action Required:** Deploy all 6 missing tables before trainer profile features go live.
