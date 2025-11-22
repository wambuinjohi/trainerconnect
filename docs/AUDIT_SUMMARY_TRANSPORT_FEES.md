# Transport Fee Audit - Executive Summary

## Status: 🔴 CRITICAL ISSUES FOUND

The transport fee calculation system has **good design but broken integration**. The mathematical formula is correct, but the payment and earnings flow is broken, preventing trainers from receiving compensation.

---

## Quick Summary

| Component | Status | Issue |
|-----------|--------|-------|
| **Distance Calculation** | ✅ Working | Haversine formula is correct |
| **Transport Fee Matching** | ✅ Working | Distance tier lookup works properly |
| **Platform Commission Exclusion** | ✅ Working | Transport NOT included in 10% platform fee |
| **Trainer Net Amount Calculation** | ✅ Working | Formula: service + transport - platform_fee |
| **Payment Recording** | ❌ BROKEN | Doesn't store trainer_id or trainer_net_amount |
| **Trainer Earnings Retrieval** | ❌ BROKEN | Query searches non-existent trainer_id column |
| **Payout Processing** | ⚠️ PARTIALLY BROKEN | Applies commission to transport fees (should not) |
| **Client Billing** | ✅ Working | Total amount calculated correctly |

---

## Critical Issues

### Issue 1: Trainer Earnings Not Recorded in Payments Table

**Problem:** When a client pays for a booking, the payment is recorded but NOT linked to the trainer, and NOT with the trainer's net earnings amount.

**Current Behavior:**
- Payment table stores: `id`, `booking_id`, `amount` (client paid), but NO `trainer_id`
- Trainer's earnings balance calculated as: **Ksh 0.00** (always)
- Trainer cannot request payout because earnings show as zero

**Example:**
```
Booking:
  - Client pays: Ksh 1,476 (total_amount)
  - Trainer earns: Ksh 1,100 (trainer_net_amount)
  
Current Storage:
  - payments.amount = 1,476 ❌ (wrong number)
  - payments.trainer_id = NULL ❌ (no link to trainer)
  
Trainer Balance Query:
  - SELECT * FROM payments WHERE trainer_id = 'xyz'
  - Returns: 0 rows ❌
  - Shows as: Ksh 0.00
```

**Impact:** Trainers cannot claim their earnings.

---

### Issue 2: Double Commission on Transport Fees During Payout

**Problem:** Platform commission (10%) is correctly excluded from booking calculation, but then re-applied during payout approval.

**Current Behavior:**
- At booking: Transport fee correctly excluded from platform commission ✅
- At payout: Commission re-applied to full trainer_net_amount ❌

**Example:**
```
Booking (Correct):
  - base_service: Ksh 1,000
  - transport: Ksh 200
  - platform_fee: Ksh 100 (10% of 1,000 only, NOT transport) ✅
  - trainer_net: Ksh 1,100

Payout Approval (Wrong):
  - Trainer requests: Ksh 1,100
  - Admin approves with 5% fee
  - Commission: Ksh 55 (5% of 1,100, includes transport!) ❌
  - Final: Ksh 1,045
  
Problem: Transport portion (Ksh 200) was charged 5% fee
  Should have been: Ksh 1,100 (transport should not be charged)
```

**Impact:** Trainer loses additional percentage from transport earnings.

---

### Issue 3: Trainer Location Validation Missing

**Problem:** If trainer doesn't configure location or distance pricing, transport fee silently defaults to Ksh 0.

**Current Behavior:**
- No warning to client that transport fee wasn't calculated
- Trainer who travels long distances may not be compensated
- No visibility into whether calculation succeeded

**Impact:** Silent loss of transport compensation.

---

## What's Working Well

✅ **Booking Calculation:** Distance → tier matching → transport fee → correct trainer_net calculation
✅ **Client Billing:** Correct total shown to client
✅ **Fee Breakdown Storage:** All fee components stored in booking record
✅ **Invoice Generation:** Can generate invoice from booking with all details
✅ **Haversine Formula:** Accurate distance calculation

---

## Data Flow - Current (Broken)

```
1. Client Books        ✅ Correct amount calculated
   ↓
2. Payment Received    ❌ Recorded WITHOUT trainer_id or trainer_net
   ↓
3. Trainer Checks Balance    ❌ Shows Ksh 0.00 (query returns no rows)
   ↓
4. Trainer Cannot Request Payout    ❌ Balance is zero
   ↓
5. Revenue Lost        ❌ Trainer never paid
```

---

## Data Flow - Should Be

```
1. Client Books        ✅ Correct amount calculated
   ↓
2. Payment Recorded    ✅ WITH trainer_id, trainer_net_amount, fee breakdown
   ↓
3. Trainer Checks Balance    ✅ Shows sum of trainer_net_amount (e.g., Ksh 5,500)
   ↓
4. Trainer Requests Payout    ✅ Requests Ksh 5,500
   ↓
5. Admin Approves    ✅ No additional commission on transport
   ↓
6. Trainer Paid    ✅ Receives Ksh 5,500 via B2C
```

---

## Recommended Fixes (Priority Order)

### URGENT (Do First)

1. **Add trainer_id to payments table** - So trainers can be linked to their earnings
2. **Update payment recording** - Store trainer_net_amount when payment is recorded
3. **Fix payments_get** - Query now works with trainer_id column
4. **Fix payout approval** - Don't apply commission to trainer_net_amount again

### IMPORTANT (Do Soon)

5. **Add trainer location validation** - Warn if trainer hasn't configured location
6. **Move percentages to settings** - Make 10% and 16% configurable without code change

### NICE TO HAVE (Later)

7. **Add transport fee breakdown to UI** - Show clients how much goes to transport vs service

---

## Financial Impact

**Estimated Loss Per Booking:**
```
Trainer earning Ksh 1,000/hour with transport:
- Service: Ksh 1,000
- Transport: Ksh 200
- Should earn: Ksh 1,100

Current system:
- Trainer earns: Ksh 0.00 (can't request payout)
- Loss: Ksh 1,100 per booking

Example: 10 bookings per trainer per month with transport
- Loss: Ksh 11,000 per trainer per month
- With 50 active trainers: Ksh 550,000/month lost
```

---

## Documentation Files

| File | Purpose |
|------|---------|
| `TRANSPORT_FEE_AUDIT_FINDINGS.md` | Detailed analysis of all 6 issues with examples |
| `TRANSPORT_FEE_AUDIT_FIXES.md` | Exact code changes needed to fix all issues |
| `AUDIT_SUMMARY_TRANSPORT_FEES.md` | This file - executive overview |

---

## Next Steps

1. **Read:** `TRANSPORT_FEE_AUDIT_FINDINGS.md` - Understand all issues
2. **Review:** `TRANSPORT_FEE_AUDIT_FIXES.md` - See exact code changes
3. **Implement:** Apply all fixes in order
4. **Test:** Run SQL verification queries provided in Fixes document
5. **Verify:** Create test booking, check trainer balance, request payout, verify amount

---

## Questions to Answer

1. **Should transport fees be subject to payout processing fees?** (Currently no, but clarify)
2. **Is VAT correctly NOT applied to transport?** (Confirm with tax advisor)
3. **Are the distance pricing tiers correct?** (Example: 0-5km = Ksh 100, etc.)
4. **Should trainer location validation show error to user?** (Currently silent)

---

## Contact Points

- **Backend Issues:** api.php, c2b_callback.php
- **Frontend Issues:** src/components/trainer/TrainerPayoutRequest.tsx
- **Database:** payments table schema
- **Config:** platform_settings table (percentages)

---

## Estimated Fix Time

- Database migration: 5 minutes
- Code updates (4 files): 1-2 hours
- Testing: 30 minutes
- **Total: ~2 hours**

---

## Conclusion

The transport fee **calculation** is well-implemented and mathematically correct. The issue is the **integration** with the payment and earnings system. Once the payments table is properly structured and payment recording is updated, the system will work as designed.

**Priority:** FIX IMMEDIATELY - This is blocking trainer revenue realization.
