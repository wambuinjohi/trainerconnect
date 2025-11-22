# Transport Fee Computation Audit - Findings Report

## Executive Summary

The transport fee implementation has good structural design with proper server-side calculations and database schema. However, there are **critical runtime issues** that prevent the trainer earnings system from working correctly. The transport fee calculation logic itself is sound, but the integration between bookings, payments, and trainer earnings is broken.

---

## Critical Issues Found

### 🔴 ISSUE 1: Missing `trainer_id` in Payments Table

**Location:** `api.php` lines 1899, `c2b_callback.php` line 178-193

**Problem:**
```php
// api.php line 1899
$sql = "SELECT * FROM payments WHERE trainer_id = '$trainerId' ORDER BY created_at DESC";
```

The `payments_get` action queries for `trainer_id` in the payments table, but the database schema (database/client_portal_schema.sql lines 92-116) does NOT have a `trainer_id` column. The payments table only has:
- `id`, `user_id`, `booking_id`, `amount`, `status`, `method`, `transaction_reference`, `created_at`, `updated_at`

**Impact:**
- ✗ Trainer earnings cannot be retrieved
- ✗ Trainer sees Ksh 0.00 balance in TrainerPayoutRequest.tsx (line 115-120)
- ✗ Trainer cannot request payouts based on correct balance
- ✗ AdminPayoutManager cannot verify trainer earnings

**Current Flow (Broken):**
```
1. Payment recorded in c2b_callback.php → payments table (only amount, no trainer info)
2. TrainerPayoutRequest calls payments_get(trainer_id)
3. Query: SELECT * FROM payments WHERE trainer_id = 'xxx'
4. Returns 0 rows (column doesn't exist)
5. Balance shown as Ksh 0.00
```

---

### 🔴 ISSUE 2: Payment Processing Ignores `trainer_net_amount`

**Location:** `c2b_callback.php` lines 178-193

**Problem:**
When a payment is successfully recorded, the system stores:
```php
INSERT INTO payments (
    id, booking_id, amount, status, method, transaction_reference, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
```

But it should be storing:
- The `trainer_net_amount` (not the full client payment amount)
- Link to the trainer via the booking
- Or a breakdown of base_service, transport_fee, platform_fee, vat

The amount inserted equals the FULL amount the client paid (base_service + transport + platform_fee + vat), not what the trainer earns.

**Example Scenario:**
```
Booking created:
  - base_service_amount: Ksh 1,000
  - transport_fee: Ksh 200
  - platform_fee: Ksh 100 (10% of service only)
  - vat_amount: Ksh 176
  - trainer_net_amount: Ksh 1,100 (= 1,000 + 200 - 100)
  - total_amount (client pays): Ksh 1,476

When payment received:
  - Stored in payments table as: amount = 1,476 (WRONG! Should be 1,100)
  - No trainer_id to link earnings
```

**Impact:**
- ✗ Trainer sees inflated balance (includes platform fees, VAT, not their actual earnings)
- ✗ When trainer requests payout of Ksh 1,476, they're actually taking platform fees they shouldn't
- ✗ Audit queries cannot match trainer earnings to trainer_net_amount
- ✗ Finance reporting is incorrect

---

### 🔴 ISSUE 3: Payout Request Calculation Applies Double Commission

**Location:** `api.php` lines 2766-2843

**Problem:**
```php
// api.php line 2785-2786
$commission = ($requestedAmount * $commissionPercentage) / 100;
$netAmount = $requestedAmount - $commission;
```

The payout approval applies a SECOND commission deduction on top of the already-deducted platform fee.

**Example Scenario:**
```
Booking:
  - base_service: Ksh 1,000
  - transport: Ksh 200
  - platform_fee: Ksh 100 (already deducted, trainer gets 1,100)
  - trainer_net_amount: Ksh 1,100

Trainer requests payout: Ksh 1,100
Admin approves with commission_percentage = 5%:
  - commission = 1,100 × 5% = Ksh 55
  - netAmount = 1,100 - 55 = Ksh 1,045
  
Problem: Transport fee (Ksh 200) is included in this commission!
  According to documentation, transport fees should NOT be subject to any commission
```

**Impact:**
- ✗ Transport fees are incorrectly charged with payout commission
- ✗ Violates the documented guarantee: "transport fees are never subject to commission"
- ✗ Trainer receives less than they should

---

### 🟡 ISSUE 4: Database Schema Migration Not Applied

**Location:** `scripts/sql/002-add-fee-breakdown-columns.sql`

**Problem:**
The database migration file to add the new fee columns exists, but there's no clear indication it has been applied to the database. The columns needed for proper auditing are:
- `base_service_amount`
- `transport_fee`
- `platform_fee`
- `vat_amount`
- `trainer_net_amount`
- `client_surcharge`
- `client_location_lat` / `client_location_lng` / `client_location_label`

**Impact:**
- ⚠ If migration not applied: bookings created with `booking_create` action will fail
- ⚠ Cannot audit fee calculations
- ⚠ Cannot verify transport fee exclusion from commission

**Verify with:**
```sql
DESCRIBE bookings;
```
Should show all columns from the migration file.

---

### 🟡 ISSUE 5: Transport Fee Calculation Has Silent Failures

**Location:** `api.php` lines 2473-2480

**Problem:**
```php
$transportFee = 0;
if ($clientLocationLat !== null && $clientLocationLng !== null && $trainerLat !== 0 && $trainerLng !== 0) {
    $distanceKm = calculateDistance($trainerLat, $trainerLng, $clientLocationLat, $clientLocationLng);
    if ($distanceKm !== null && is_array($hourlyRateByRadius) && !empty($hourlyRateByRadius)) {
        $transportFee = calculateTransportFee($distanceKm, $hourlyRateByRadius);
    }
}
```

The code silently returns Ksh 0 transport fee if:
1. Client location not provided (nullable in form)
2. Trainer location is [0, 0] (default unset value)
3. Trainer hasn't configured distance pricing tiers
4. Distance calculation returns null (invalid coordinates)

**Impact:**
- ⚠ Trainer traveling long distances may not be compensated
- ⚠ No warning to client that transport fee wasn't calculated
- ⚠ Frontend BookingForm doesn't display transport fee calculation status

---

### 🟡 ISSUE 6: VAT Calculation Excludes Transport Fee

**Location:** `api.php` line 2491

**Problem:**
```php
$vatAmount = round((($baseServiceAmount + $platformFee) * $vatPct) / 100, 2);
```

VAT is calculated on base_service + platform_fee, but NOT on transport_fee.

**Question:** Is this intentional?
- If transport is a separate service (trainer travel), VAT might not apply
- If transport is part of service delivery, VAT should apply
- Current documentation doesn't clarify this

**Current Formula:**
```
VAT = (base_service + platform_fee) × 16%
NOT: (base_service + transport_fee + platform_fee) × 16%
```

**Impact:**
- ⚠ Client may be charged incorrect tax
- ⚠ VAT compliance uncertain (Kenya tax authority interpretation)

---

## Correct Fee Calculation Verification

### ✅ What IS Working Correctly

1. **Distance Calculation** (Haversine formula)
   - Properly validates coordinates (-90 to 90 lat, -180 to 180 lng)
   - Returns null for invalid data
   - Sanity check: rejects distances > 20,000km
   - Formula is mathematically correct

2. **Transport Fee Matching**
   - Correctly finds first tier where distance ≤ tier radius
   - Falls back to highest tier if distance exceeds all tiers
   - Properly sorts tiers by radius

3. **Platform Commission Calculation**
   - ✅ Correctly applies to base_service_amount ONLY
   - ✅ Does NOT include transport_fee in commission
   - Formula: `platform_fee = (base_service_amount × 10%)`
   - Properly stored as separate column

4. **Trainer Net Amount Calculation**
   - ✅ Formula is correct: `trainer_net = base_service + transport_fee - platform_fee`
   - ✅ Properly stored in `trainer_net_amount` column
   - ✅ Client total is correct: `client_total = base_service + transport + platform_fee + vat`

---

## Data Flow Analysis

### Current (Broken) Flow

```
1. Client creates booking via BookingForm
   ↓
2. booking_create calculates:
   - distance (OK)
   - transport_fee (OK)
   - platform_fee (OK)
   - trainer_net_amount (OK) ✓
   ↓
3. Booking stored with all fee breakdowns ✓
   ↓
4. Client pays Ksh X (total_amount via M-Pesa)
   ↓
5. c2b_callback.php records payment:
   - INSERT INTO payments (amount = Ksh X) ✗
   - Does NOT link to trainer
   - Does NOT store trainer_net_amount
   ↓
6. TrainerPayoutRequest tries to get earnings:
   - Calls payments_get(trainer_id)
   - Query fails: payments table has no trainer_id column ✗
   - Shows balance = Ksh 0.00
   ↓
7. Trainer CANNOT request payout ✗
```

### Correct Flow (Should Be)

```
1. Client creates booking ✓
2. booking_create calculates trainer_net_amount ✓
3. Booking stored ✓
4. Client payment received ✓
5. Payment recorded with:
   - trainer_id (from booking)
   - trainer_net_amount (what trainer earned)
   - booking_id (link to booking)
6. TrainerPayoutRequest queries:
   - SELECT SUM(trainer_net_amount) FROM payments WHERE trainer_id = X
   - Shows correct balance
7. Trainer can request payout of trainer_net_amount ✓
8. Admin approves payout:
   - Takes trainer_net_amount from payments
   - Does NOT apply additional commission to transport portion ✓
   - B2C payment sent to trainer ✓
```

---

## SQL Audit Queries

### Query 1: Verify Transport Fee Exclusion from Platform Commission

```sql
SELECT 
    id as booking_id,
    base_service_amount,
    transport_fee,
    platform_fee,
    (base_service_amount * 0.10) as expected_platform_fee,
    ABS(platform_fee - (base_service_amount * 0.10)) as difference,
    trainer_net_amount,
    (base_service_amount + transport_fee - platform_fee) as expected_trainer_net
FROM bookings
WHERE ABS(platform_fee - (base_service_amount * 0.10)) > 0.01
   OR ABS(trainer_net_amount - (base_service_amount + transport_fee - platform_fee)) > 0.01;
```

**Expected Result:** 0 rows (all calculations correct)

### Query 2: Verify Client Totals

```sql
SELECT 
    id as booking_id,
    base_service_amount,
    transport_fee,
    platform_fee,
    vat_amount,
    total_amount,
    (base_service_amount + transport_fee + platform_fee + vat_amount) as calculated_total,
    ABS(total_amount - (base_service_amount + transport_fee + platform_fee + vat_amount)) as difference
FROM bookings
WHERE ABS(total_amount - (base_service_amount + transport_fee + platform_fee + vat_amount)) > 0.01;
```

**Expected Result:** 0 rows (all totals match)

### Query 3: Check for Missing Trainer ID in Payments

```sql
SELECT p.id, p.booking_id, p.amount, b.trainer_id, b.trainer_net_amount
FROM payments p
LEFT JOIN bookings b ON p.booking_id = b.id
WHERE b.id IS NULL
   OR p.booking_id IS NULL;
```

**Current Result:** Multiple rows (payments not linked to trainer)
**Expected Result:** 0 rows (all payments properly linked)

### Query 4: Identify Lost Transport Fee Revenue

```sql
SELECT 
    COUNT(*) as bookings_with_transport,
    SUM(transport_fee) as total_transport_collected,
    SUM(base_service_amount) as total_service_amount,
    SUM(platform_fee) as total_platform_fee,
    SUM(trainer_net_amount) as total_trainer_net
FROM bookings
WHERE transport_fee > 0;
```

This shows how much transport revenue is involved.

---

## Configuration Issues

### Hardcoded Values (Should Be Configurable)

1. **Platform Fee Percentage:** 10% (line 2486 in api.php)
   ```php
   $platformFeePct = 10;
   ```

2. **VAT Percentage:** 16% (line 2490 in api.php)
   ```php
   $vatPct = 16;
   ```

**Current Issue:** Changing these requires code modification. Should read from `platform_settings` table.

---

## Recommendations

### Immediate Fixes (Critical)

1. **Add `trainer_id` to payments table**
   ```sql
   ALTER TABLE payments 
   ADD COLUMN trainer_id VARCHAR(36),
   ADD COLUMN trainer_net_amount DECIMAL(15, 2),
   ADD FOREIGN KEY (trainer_id) REFERENCES users(id),
   ADD INDEX idx_trainer_id (trainer_id);
   ```

2. **Update c2b_callback.php to store trainer_net_amount**
   - When recording payment, fetch trainer_net_amount from booking
   - Store both trainer_id and trainer_net_amount in payments table
   - Link payment to trainer through booking

3. **Fix payments_get to calculate trainer earnings correctly**
   ```php
   // Instead of: SELECT * FROM payments WHERE trainer_id = '$trainerId'
   // Use: SELECT * FROM payments WHERE trainer_id = '$trainerId' 
   //      AND status = 'completed'
   //      AND amount > 0
   ```

4. **Fix payout approval to not double-commission transport**
   - Payout request should store which payments are included
   - Calculate commission ONLY on platform-fee-deductible portion
   - Or, only apply commission to future payouts, not past trainer_net_amount

### Short Term (Important)

5. **Add trainer location validation**
   - Warn if trainer has no location set
   - Show transport fee calculation status in booking confirmation

6. **Clarify VAT treatment of transport fee**
   - Determine with accounting/tax advisors
   - Update formula if needed
   - Document the decision

7. **Move platform fee and VAT percentages to settings**
   ```php
   $platformFeePct = loadSettings()['platformChargeClientPercent'] ?? 10;
   $vatPct = loadSettings()['taxRate'] ?? 16;
   ```

### Long Term (Enhancement)

8. **Create earnings reconciliation report**
   - Match bookings → payments → trainer_net_amount
   - Verify no discrepancies
   - Monthly trainer earnings statement

9. **Add transport fee breakdown to invoices**
   - Show client: base_service vs transport vs platform_fee vs VAT
   - Help clients understand pricing

10. **Implement payout rules engine**
    - Define when commissions apply (only platform fee portion)
    - Prevent accidental over-deduction from transport fees
    - Add safety checks

---

## Testing Checklist

- [ ] Run audit query #1: Verify platform fee calculation
- [ ] Run audit query #2: Verify client totals
- [ ] Run audit query #3: Check payments are linked to trainers
- [ ] Create booking with known distance and transport tier
  - Verify transport fee matches tier
  - Verify platform fee does NOT include transport
  - Verify trainer_net_amount is correct
- [ ] Check if database migration 002-add-fee-breakdown-columns.sql was applied
- [ ] Test trainer payout request:
  - Verify balance shown is correct (should use trainer_net_amount)
  - Verify payout calculates correctly
  - Verify admin approval doesn't double-charge transport

---

## Conclusion

**Status:** Transport fee calculation logic is well-designed and mathematically correct. However, the integration with the payment and earnings system is broken, preventing trainers from receiving proper compensation.

**Priority:** CRITICAL - Revenue is not flowing to trainers correctly.

**Owner:** Backend Engineer (api.php and c2b_callback.php)
**Timeline:** Should be fixed before next trainer payout cycle
