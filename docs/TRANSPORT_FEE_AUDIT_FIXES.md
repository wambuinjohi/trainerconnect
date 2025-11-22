# Transport Fee Audit - Implementation Fixes

## Overview

This document provides the exact code changes needed to fix the broken transport fee computation and integration issues identified in the audit.

---

## Fix 1: Update Payments Table Schema

### Database Migration

**File:** `scripts/sql/003-fix-payments-trainer-tracking.sql` (NEW)

```sql
BEGIN;

-- Add trainer tracking and earnings to payments table
ALTER TABLE IF EXISTS payments
  ADD COLUMN IF NOT EXISTS trainer_id VARCHAR(36),
  ADD COLUMN IF NOT EXISTS trainer_net_amount DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_service_amount DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_fee DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(15, 2) DEFAULT 0;

-- Add foreign key constraint
ALTER TABLE IF EXISTS payments
  ADD CONSTRAINT fk_payments_trainer_id 
    FOREIGN KEY (trainer_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_trainer_id ON payments(trainer_id);
CREATE INDEX IF NOT EXISTS idx_payments_trainer_status ON payments(trainer_id, status);

COMMIT;
```

---

## Fix 2: Update C2B Callback to Record Trainer Earnings

### File: `c2b_callback.php`

**Location:** Lines 171-204 (payment recording section)

**Current Code (BROKEN):**
```php
if ($status === 'success' && $amount && $session['id']) {
    // Record in payments table
    $paymentId = 'payment_' . uniqid();
    $now = date('Y-m-d H:i:s');
    
    $paymentStmt = $conn->prepare("
        INSERT INTO payments (
            id, booking_id, amount, status, method, transaction_reference, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    
    if ($paymentStmt) {
        $method = 'stk';
        $paymentStatus = 'completed';
        $paymentStmt->bind_param(
            "sssssss",
            $paymentId,
            $session['booking_id'],
            $amount,
            $paymentStatus,
            $method,
            $mpesaReceiptNumber,
            $now,
            $now
        );
        $paymentStmt->execute();
        $paymentStmt->close();
        
        logC2BEvent('payment_recorded', [
            'payment_id' => $paymentId,
            'booking_id' => $session['booking_id'],
            'amount' => $amount
        ]);
    }
}
```

**Fixed Code:**
```php
if ($status === 'success' && $amount && $session['id']) {
    // Fetch booking details to get trainer info and fee breakdown
    $bookingId = $session['booking_id'];
    $bookingStmt = $conn->prepare("
        SELECT trainer_id, base_service_amount, transport_fee, platform_fee, vat_amount, trainer_net_amount
        FROM bookings
        WHERE id = ?
        LIMIT 1
    ");
    
    if ($bookingStmt) {
        $bookingStmt->bind_param("s", $bookingId);
        $bookingStmt->execute();
        $bookingResult = $bookingStmt->get_result();
        
        if ($bookingResult && $bookingResult->num_rows > 0) {
            $booking = $bookingResult->fetch_assoc();
            $trainerId = $booking['trainer_id'];
            $baseServiceAmount = floatval($booking['base_service_amount'] ?? 0);
            $transportFee = floatval($booking['transport_fee'] ?? 0);
            $platformFee = floatval($booking['platform_fee'] ?? 0);
            $vatAmount = floatval($booking['vat_amount'] ?? 0);
            $trainerNetAmount = floatval($booking['trainer_net_amount'] ?? 0);
            
            // Record in payments table with trainer and fee breakdown
            $paymentId = 'payment_' . uniqid();
            $now = date('Y-m-d H:i:s');
            
            $paymentStmt = $conn->prepare("
                INSERT INTO payments (
                    id, user_id, booking_id, trainer_id, amount, 
                    base_service_amount, transport_fee, platform_fee, vat_amount, trainer_net_amount,
                    status, method, transaction_reference, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            if ($paymentStmt) {
                $method = 'stk';
                $paymentStatus = 'completed';
                $clientId = $session['client_id']; // Assuming this is stored in stk_push_sessions
                
                // Use trainer_net_amount as the payment amount for trainer tracking
                // Client paid 'amount', but trainer net is tracked separately
                $paymentStmt->bind_param(
                    "ssssddddddsssss",
                    $paymentId,           // id
                    $clientId,             // user_id (client who paid)
                    $bookingId,            // booking_id
                    $trainerId,            // trainer_id
                    $amount,               // amount (what client paid)
                    $baseServiceAmount,    // base_service_amount
                    $transportFee,         // transport_fee
                    $platformFee,          // platform_fee
                    $vatAmount,            // vat_amount
                    $trainerNetAmount,     // trainer_net_amount (what trainer earns)
                    $paymentStatus,        // status
                    $method,               // method
                    $mpesaReceiptNumber,   // transaction_reference
                    $now,                  // created_at
                    $now                   // updated_at
                );
                $paymentStmt->execute();
                $paymentStmt->close();
                
                logC2BEvent('payment_recorded', [
                    'payment_id' => $paymentId,
                    'booking_id' => $bookingId,
                    'client_id' => $clientId,
                    'trainer_id' => $trainerId,
                    'amount' => $amount,
                    'trainer_net_amount' => $trainerNetAmount,
                    'transport_fee' => $transportFee
                ]);
            }
        }
        $bookingStmt->close();
    }
}
```

**Note:** The stk_push_sessions table needs to have `client_id` stored. Verify the table structure and add if needed:
```sql
-- Check if client_id exists in stk_push_sessions
ALTER TABLE stk_push_sessions ADD COLUMN IF NOT EXISTS client_id VARCHAR(36);
```

---

## Fix 3: Fix payments_get Action

### File: `api.php`

**Location:** Lines 1892-1912

**Current Code (BROKEN):**
```php
case 'payments_get':
    if (!isset($input['trainer_id'])) {
        respond("error", "Missing trainer_id.", null, 400);
    }

    $trainerId = $conn->real_escape_string($input['trainer_id']);

    $sql = "SELECT * FROM payments WHERE trainer_id = '$trainerId' ORDER BY created_at DESC";
    $result = $conn->query($sql);

    if (!$result) {
        respond("error", "Query failed: " . $conn->error, null, 500);
    }

    $payments = [];
    while ($row = $result->fetch_assoc()) {
        $payments[] = $row;
    }

    respond("success", "Payments fetched successfully.", ["data" => $payments]);
    break;
```

**Fixed Code:**
```php
case 'payments_get':
    if (!isset($input['trainer_id'])) {
        respond("error", "Missing trainer_id.", null, 400);
    }

    $trainerId = $conn->real_escape_string($input['trainer_id']);

    // Get all completed payments for this trainer with fee breakdown
    $sql = "
        SELECT 
            id, booking_id, amount, trainer_net_amount,
            base_service_amount, transport_fee, platform_fee, vat_amount,
            status, method, transaction_reference, created_at, updated_at
        FROM payments 
        WHERE trainer_id = '$trainerId' 
          AND status = 'completed'
        ORDER BY created_at DESC
    ";
    $result = $conn->query($sql);

    if (!$result) {
        respond("error", "Query failed: " . $conn->error, null, 500);
    }

    $payments = [];
    while ($row = $result->fetch_assoc()) {
        $payments[] = $row;
    }

    // Calculate total trainer earnings from completed payments
    $sumSql = "
        SELECT 
            SUM(trainer_net_amount) as total_earnings,
            COUNT(*) as payment_count,
            SUM(transport_fee) as total_transport_earned
        FROM payments 
        WHERE trainer_id = '$trainerId' 
          AND status = 'completed'
    ";
    $sumResult = $conn->query($sumSql);
    $summary = [];
    if ($sumResult && $sumResult->num_rows > 0) {
        $summary = $sumResult->fetch_assoc();
    }

    respond("success", "Payments fetched successfully.", [
        "data" => $payments,
        "summary" => [
            "total_earnings" => floatval($summary['total_earnings'] ?? 0),
            "payment_count" => intval($summary['payment_count'] ?? 0),
            "total_transport_earned" => floatval($summary['total_transport_earned'] ?? 0)
        ]
    ]);
    break;
```

---

## Fix 4: Fix Payout Approval to Not Double-Commission Transport

### File: `api.php`

**Location:** Lines 2766-2843

**Problem:** Current code applies commission to the full requested amount, including transport fees, which violates the guarantee that transport fees are never subject to commission.

**Current Code (BROKEN):**
```php
case 'payout_request_approve':
    if (!isset($input['payout_request_id'])) {
        respond("error", "Missing payout_request_id.", null, 400);
    }

    $payoutRequestId = $conn->real_escape_string($input['payout_request_id']);
    $commissionPercentage = isset($input['commission_percentage']) ? floatval($input['commission_percentage']) : 0;

    $sql = "SELECT * FROM payout_requests WHERE id = '$payoutRequestId' LIMIT 1";
    $result = $conn->query($sql);

    if (!$result || $result->num_rows === 0) {
        respond("error", "Payout request not found.", null, 404);
    }

    $request = $result->fetch_assoc();
    $trainerId = $request['trainer_id'];
    $requestedAmount = floatval($request['amount']);

    // ISSUE: This applies commission to the full amount, including transport fees
    $commission = ($requestedAmount * $commissionPercentage) / 100;
    $netAmount = $requestedAmount - $commission;
    // ... rest of code
```

**Fixed Code:**
```php
case 'payout_request_approve':
    if (!isset($input['payout_request_id'])) {
        respond("error", "Missing payout_request_id.", null, 400);
    }

    $payoutRequestId = $conn->real_escape_string($input['payout_request_id']);
    $commissionPercentage = isset($input['commission_percentage']) ? floatval($input['commission_percentage']) : 0;

    $sql = "SELECT * FROM payout_requests WHERE id = '$payoutRequestId' LIMIT 1";
    $result = $conn->query($sql);

    if (!$result || $result->num_rows === 0) {
        respond("error", "Payout request not found.", null, 404);
    }

    $request = $result->fetch_assoc();
    $trainerId = $request['trainer_id'];
    $requestedAmount = floatval($request['amount']);

    // FIXED: Calculate commission only on the portion that's subject to commission
    // The trainer_net_amount already has platform_fee deducted
    // Transport fees are not subject to additional commission
    // Only apply commission if there's a payout processing fee (not platform commission)
    
    // Option A: No commission on payout (recommended, as trainer_net is already net)
    $commission = 0;
    $netAmount = $requestedAmount;
    
    // Option B: If payout fee is needed (e.g., for B2C processing), make it clear it's a separate fee
    // $payoutProcessingFee = ($requestedAmount * 1) / 100; // 1% B2C fee, not a commission
    // $commission = $payoutProcessingFee;
    // $netAmount = $requestedAmount - $payoutProcessingFee;

    $phoneQuery = $conn->query("SELECT phone FROM user_profiles WHERE user_id = '$trainerId'");
    if (!$phoneQuery || $phoneQuery->num_rows === 0) {
        respond("error", "Trainer phone not found.", null, 404);
    }

    $trainerData = $phoneQuery->fetch_assoc();
    $phoneNumber = $trainerData['phone'];

    $b2cId = 'b2c_' . uniqid();
    $referenceId = 'payout_' . uniqid();
    $now = date('Y-m-d H:i:s');

    $stmt = $conn->prepare("
        INSERT INTO b2c_payments (
            id, user_id, user_type, phone_number, amount, reference_id, status, initiated_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $userType = 'trainer';
    $status = 'pending';

    $stmt->bind_param("ssssdssss", $b2cId, $trainerId, $userType, $phoneNumber, $netAmount, $referenceId, $status, $now, $now);

    if ($stmt->execute()) {
        $stmt->close();

        $updateStmt = $conn->prepare("
            UPDATE payout_requests
            SET status = ?, b2c_payment_id = ?, commission = ?, net_amount = ?, updated_at = NOW()
            WHERE id = ?
        ");

        $approvedStatus = 'approved';
        $updateStmt->bind_param("ssdds", $approvedStatus, $b2cId, $commission, $netAmount, $payoutRequestId);
        $updateStmt->execute();
        $updateStmt->close();

        logEvent('payout_request_approved', [
            'payout_request_id' => $payoutRequestId,
            'trainer_id' => $trainerId,
            'b2c_payment_id' => $b2cId,
            'requested_amount' => $requestedAmount,
            'commission' => $commission,
            'net_amount' => $netAmount,
            'note' => 'Commission/fees deducted at booking time, transport fees not subject to additional commission'
        ]);

        respond("success", "Payout request approved. B2C payment created.", [
            "b2c_payment_id" => $b2cId,
            "reference_id" => $referenceId,
            "requested_amount" => $requestedAmount,
            "commission" => $commission,
            "net_amount" => $netAmount
        ]);
    } else {
        $stmt->close();
        respond("error", "Failed to approve payout: " . $conn->error, null, 500);
    }
    break;
```

---

## Fix 5: Update TrainerPayoutRequest to Show Transport Breakdown

### File: `src/components/trainer/TrainerPayoutRequest.tsx`

**Location:** Lines 26-48 (loading data)

**Current Code:**
```javascript
const loadData = async () => {
  try {
    setLoading(true)

    // Get trainer's payments/earnings
    const paymentsData = await apiRequest('payments_get', { trainer_id: user.id }, { headers: withAuth() })
    const totalEarnings = paymentsData?.data?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0
    setBalance(totalEarnings)
```

**Fixed Code:**
```javascript
const loadData = async () => {
  try {
    setLoading(true)

    // Get trainer's payments/earnings
    const paymentsData = await apiRequest('payments_get', { trainer_id: user.id }, { headers: withAuth() })
    
    // Use summary if available, fallback to sum of trainer_net_amount
    let totalEarnings = 0
    if (paymentsData?.summary?.total_earnings) {
      totalEarnings = Number(paymentsData.summary.total_earnings) || 0
    } else {
      totalEarnings = paymentsData?.data?.reduce((sum: number, p: any) => sum + (Number(p.trainer_net_amount) || 0), 0) || 0
    }
    setBalance(totalEarnings)
```

**Also Update Display (around line 115):**
```javascript
// Add transport breakdown info
{paymentsData?.summary?.total_transport_earned > 0 && (
  <p className="text-xs text-muted-foreground mt-2">
    Includes Ksh {Number(paymentsData.summary.total_transport_earned).toFixed(2)} from client travel fees
  </p>
)}
```

---

## Fix 6: Move Hardcoded Percentages to Settings

### File: `api.php`

**Location:** Lines 2486-2490 (in booking_create action)

**Current Code (HARDCODED):**
```php
$platformFeePct = 10;
$platformFee = round(($baseServiceAmount * $platformFeePct) / 100, 2);

$vatPct = 16;
$vatAmount = round((($baseServiceAmount + $platformFee) * $vatPct) / 100, 2);
```

**Fixed Code:**
```php
// Load settings for configurable percentages
$settingsSql = "SELECT platformChargeClientPercent, taxRate FROM platform_settings LIMIT 1";
$settingsResult = $conn->query($settingsSql);
$platformFeePct = 10;
$vatPct = 16;

if ($settingsResult && $settingsResult->num_rows > 0) {
    $settings = $settingsResult->fetch_assoc();
    $platformFeePct = floatval($settings['platformChargeClientPercent'] ?? 10);
    $vatPct = floatval($settings['taxRate'] ?? 16);
}

$platformFee = round(($baseServiceAmount * $platformFeePct) / 100, 2);
$vatAmount = round((($baseServiceAmount + $platformFee) * $vatPct) / 100, 2);
```

---

## Fix 7: Add Validation for Trainer Location

### File: `api.php`

**Location:** Lines 2421-2432 (after fetching trainer profile)

**Add After Line 2432:**
```php
// Validate trainer has location configured
if ($trainerLat === 0 || $trainerLng === 0) {
    logEvent('booking_created_no_trainer_location', [
        'trainer_id' => $trainerId,
        'note' => 'Trainer location not configured, transport fee not calculated'
    ]);
}

// Validate trainer has distance pricing configured
if (empty($hourlyRateByRadius)) {
    logEvent('booking_created_no_distance_pricing', [
        'trainer_id' => $trainerId,
        'note' => 'Trainer distance pricing not configured, transport fee defaulted to 0'
    ]);
}
```

---

## Testing SQL Queries

### Verify Fix 1: Check payments table has new columns

```sql
DESCRIBE payments;
```

Should show: `trainer_id`, `trainer_net_amount`, `base_service_amount`, `transport_fee`, `platform_fee`, `vat_amount`

### Verify Fix 2: Check payments are linked to trainers with correct amounts

```sql
SELECT 
    p.id,
    p.trainer_id,
    p.amount as client_paid,
    p.trainer_net_amount as trainer_earned,
    p.transport_fee,
    p.base_service_amount,
    b.id as booking_id,
    b.trainer_id as booking_trainer
FROM payments p
LEFT JOIN bookings b ON p.booking_id = b.id
ORDER BY p.created_at DESC
LIMIT 20;
```

### Verify Fix 3: Trainer earnings are correct

```sql
SELECT 
    p.trainer_id,
    COUNT(*) as payment_count,
    SUM(p.amount) as total_client_paid,
    SUM(p.trainer_net_amount) as total_trainer_earned,
    SUM(p.transport_fee) as total_transport,
    SUM(p.platform_fee) as total_platform_fees
FROM payments p
WHERE p.status = 'completed'
GROUP BY p.trainer_id
ORDER BY p.trainer_id;
```

### Verify Fix 4: Transport fees are not double-charged

```sql
SELECT 
    pr.id as payout_request_id,
    pr.trainer_id,
    pr.amount as requested_amount,
    pr.commission,
    pr.net_amount,
    SUM(p.transport_fee) as transport_in_payout
FROM payout_requests pr
LEFT JOIN payments p ON p.trainer_id = pr.trainer_id 
  AND p.created_at <= pr.requested_at
WHERE pr.status = 'approved'
GROUP BY pr.id;
```

Expected result: `commission = 0` (or minimal B2C processing fee only)

---

## Implementation Checklist

- [ ] Apply database migration `003-fix-payments-trainer-tracking.sql`
- [ ] Verify stk_push_sessions has client_id column
- [ ] Update c2b_callback.php with fixed payment recording
- [ ] Update api.php payments_get action
- [ ] Update api.php booking_create to load percentages from settings
- [ ] Update api.php payout_request_approve action
- [ ] Update TrainerPayoutRequest.tsx to use trainer_net_amount
- [ ] Add validation logging in booking_create
- [ ] Run SQL verification queries
- [ ] Test end-to-end: Create booking → Payment → Trainer balance → Payout request → Payout approval
- [ ] Verify transport fee breakdown in invoice
- [ ] Test with multiple trainers and multiple bookings

---

## Rollback Plan

If issues occur:

1. **Revert database migration:**
   ```sql
   ALTER TABLE payments DROP COLUMN trainer_id;
   ALTER TABLE payments DROP COLUMN trainer_net_amount;
   ALTER TABLE payments DROP COLUMN base_service_amount;
   ALTER TABLE payments DROP COLUMN transport_fee;
   ALTER TABLE payments DROP COLUMN platform_fee;
   ALTER TABLE payments DROP COLUMN vat_amount;
   ```

2. **Revert c2b_callback.php:** Restore original payment insertion code
3. **Revert api.php:** Restore original payments_get and payout_request_approve
4. **Revert React component:** Restore original TrainerPayoutRequest

---

## Success Criteria

✅ Trainer can see correct earnings balance (trainer_net_amount from all completed payments)
✅ Transport fees are included in trainer earnings without additional commission
✅ Payout request shows correct balance calculation
✅ Payout approval does not apply commission to transport fees
✅ Invoice shows proper fee breakdown (base_service vs transport vs platform_fee vs VAT)
✅ SQL audit queries return expected results (zero mismatches)
