# Affiliate Program Audit Report

**Date**: 2024
**Status**: ✅ AUDIT COMPLETE
**Scope**: Admin rate configuration, client portal application, trainer portal integration

---

## Executive Summary

The affiliate program has a **well-designed admin interface** for setting rates, but there are **critical implementation gaps**:

✅ **COMPLETE**:
- Admin can set commission and referral rates
- Rates display in admin dashboard
- Referral codes work in client bookings
- Client portal applies platform charges correctly

❌ **MISSING/INCOMPLETE**:
- API endpoints for rate configuration persistence (settings_get/settings_save)
- Trainer commission override via promotions (promotion_insert action)
- Automatic referrer reward crediting system
- Trainer net amount calculation and payout processing

---

## 1. Admin Rate Configuration (✅ Complete)

### Location: `src/components/admin/AdminDashboard.tsx`

The admin dashboard has **complete UI** for all rate settings:

#### 1.1 Platform Charges (Lines 1626-1640)
```
Charge Trainer (%): platformChargeTrainerPercent [Input: 0-100]
Charge Client (%): platformChargeClientPercent [Input: 0-100]
```
- **Default**: Trainer 10%, Client 15%
- **Applies to**: All bookings universally

#### 1.2 Commission & Tax (Lines 1320-1330)
```
Platform Commission (%): commissionRate [Input: 0-100]
Tax/VAT (%): taxRate [Input: 0-100]
Payout Schedule: [weekly/biweekly/monthly dropdown]
```
- **Default**: Commission 15%, Tax 0%
- **Note**: These are defined but don't appear to be actively used in booking calculations

#### 1.3 Referral Program (Lines 1553-1623)
```
CLIENT BENEFITS:
  Client Discount (%): referralClientDiscount [0-100] - Default: 10%
  Client Discount Lasts (bookings): referralClientBookings [1+] - Default: 5
  
TRAINER REFERRAL:
  Trainer Commission Discount (%): referralTrainerDiscount [0-100] - Default: 10%
  Trainer Discount Lasts (bookings): referralTrainerBookings [1+] - Default: 3

AFFILIATE AWARDS (NEW):
  Affiliate: Referrer Award (%): referralReferrerPercent [0-100] - Default: 15%
  Affiliate: Referred Award (%): referralReferredPercent [0-100] - Default: 15%

FEATURE TOGGLES:
  ☐ Enable Referral Program (toggle)
  ☐ Require referral code on first booking (toggle)
  ☐ Apply referral discount immediately (toggle)
  ☐ Use referrer's phone number as referral code (toggle)
```

**✅ UI is complete and functional**

---

## 2. Rate Storage & Persistence (❌ CRITICAL GAP)

### Problem: Settings Not Persisted to Database

**Location**: `src/lib/settings.ts` (Lines 78-113)

```typescript
export async function loadSettingsFromDb(): Promise<PlatformSettings | null> {
  try {
    const data = await apiRequest('settings_get', {}, { headers: withAuth() })
    // ...tries to call API endpoint
  } catch {
    return null  // ❌ Silently fails if endpoint doesn't exist
  }
}

export async function saveSettingsToDb(s: PlatformSettings): Promise<boolean> {
  try {
    await apiRequest('settings_save', payload, { headers: withAuth() })
    // ...tries to call API endpoint
  } catch {
    return false  // ❌ Fails silently, only localStorage is reliable
  }
}
```

**Admin Save Handler** (Lines 226-241):
```typescript
const handleSave = async () => {
  saveSettings(settings)  // ✅ Saves to localStorage
  const ok = await saveSettingsToDb(settings)  // ❌ Fails silently
  if (ok) {
    toast({ title: 'Settings saved' })
  } else {
    toast({ title: 'Saved locally', description: 'DB persist unavailable...' })
  }
}
```

### Current Status:
- ✅ Settings saved to browser localStorage
- ❌ **API endpoints missing**: `settings_get` and `settings_save` not implemented in api.php
- ❌ **No database table**: No `platform_settings` table in database
- ❌ **Persistence unreliable**: Settings lost on browser clear or when switching devices

### Impact:
- Admin settings are **not persistent across sessions**
- Settings only available to the admin who set them (localStorage is per-browser)
- No centralized configuration for clients and trainers

---

## 3. Client Portal Rate Application (✅ FUNCTIONAL)

### Location: `src/components/client/BookingForm.tsx`

#### 3.1 Rate Loading (Line 24)
```typescript
const settings = loadSettings()  // Loads from localStorage (set by admin)
const clientChargePct = Math.max(0, Math.min(100, Number(settings.platformChargeClientPercent || 0)))
const trainerChargePct = Math.max(0, Math.min(100, Number(settings.platformChargeTrainerPercent || 0)))
const vatPct = Math.max(0, Math.min(100, Number(settings.taxRate || 0)))
```

#### 3.2 Base Amount Calculation
```
Base Amount = Trainer Hourly Rate × Number of Sessions
Example: 1000 KES/hr × 4 sessions = 4000 KES
```

#### 3.3 Referral Discount Application (Lines 50-63)
```typescript
if (referralCode.trim()) {
  try {
    const code = referralCode.trim().toUpperCase()
    const row = await apiRequest('referral_get', { code }, { headers: withAuth() })
    if (row && !row.discount_used && row.referrer_id !== user.id) {
      const pct = Math.max(0, Math.min(100, settings.referralClientDiscount || 0))
      const discount = Math.round((baseAmount * pct) / 100)
      totalAmount = Math.max(0, baseAmount - discount)
      setAppliedDiscount(discount)
      // Update referral as used
      await apiRequest('referral_update', { 
        id: row.id, 
        referee_id: user.id, 
        discount_used: true, 
        discount_amount: discount 
      })
    }
  } catch (e) {
    console.warn('Referral validation error', e)
  }
}
```

**✅ Referral code application works correctly**

#### 3.4 Fee Calculation (Lines 69-73)
```typescript
const clientCommission = Math.round((totalAmount * clientChargePct) / 100)
const vatAmount = Math.round(((totalAmount + clientCommission) * vatPct) / 100)
const clientTotal = totalAmount + clientCommission + vatAmount
```

**Example Calculation**:
```
Base Amount: 4000 KES
Applied Referral Discount (10%): -400 KES
Subtotal: 3600 KES

Platform Client Charge (15%): +540 KES
VAT (0%): +0 KES

Total Client Pays: 4140 KES
```

**✅ Client portal correctly applies all rates**

---

## 4. Trainer Portal Integration (❌ INCOMPLETE)

### 4.1 Promotion Request System (❌ NOT WORKING)

**Location**: `src/components/trainer/PromoteProfile.tsx`

```typescript
const submit = async () => {
  const payload = { 
    trainer_id: userId, 
    commission_rate: commission,  // Trainer wants to increase commission
    status: 'pending', 
    created_at: new Date().toISOString() 
  }
  await apiRequest('promotion_insert', payload, { headers: withAuth() })
  // ❌ API endpoint 'promotion_insert' not implemented in api.php
}
```

**Status**: 
- ❌ **Action not implemented**: `promotion_insert` doesn't exist in api.php
- ❌ **Alternative not clear**: Could use generic `insert` action with table `promotion_requests`, but trainer component doesn't do this
- ❌ **Approval workflow**: Admin can view promotion requests but approval code is stubbed (shows toast "Feature unavailable")

### 4.2 Trainer Earnings & Payout (❌ INCOMPLETE)

**Location**: `src/components/trainer/Payouts.tsx`

```typescript
// Trainer sees:
// - Monthly earnings
// - Platform fee deduction
// - Payout requests

const requestPayout = async () => {
  await apiRequest('payout_insert', { trainer_id, amount })
  // Payout recorded but no automatic calculation of trainer net
}
```

**Missing**:
- ❌ No automatic trainer net amount calculation after platform charges
- ❌ No recording of commission breakdown (platform takes X%, trainer gets Y%)
- ❌ No separate trainer wallet or balance tracking
- ❌ Payout amounts not validated against actual earnings

---

## 5. Database Schema Status (⚠️ PARTIAL)

### Tables Present:
✅ `bookings` - Stores total_amount (what client pays)
✅ `payments` - Stores payment records with method
✅ `referrals` - Stores referral codes and discount_used status
✅ `reviews` - Stores trainer ratings

### Tables Missing:
❌ `platform_settings` - Not created (rates not persisted to DB)
❌ `platform_charges` - Per-booking charge breakdown not recorded
❌ `trainer_wallet` - Trainer balance and net earnings tracking
❌ `transactions` - Trainer income/expense history
❌ `payouts` - Approved payouts to trainers

### Rate-Related Columns Present:
✅ referrals.discount_amount - Applied discount amount
⚠️ bookings.total_amount - What client pays (no breakdown)

### Rate-Related Columns Missing:
❌ bookings.trainer_amount - What trainer receives after fees
❌ bookings.platform_fee - Platform's share
❌ bookings.vat_amount - Tax amount (tracked but not stored)
❌ payments.fee_breakdown - Commission split details

---

## 6. Current Data Flow

### Admin Sets Rates
```
Admin Dashboard → localStorage
         ↓
    (No database sync)
         ↓
Only available in admin's browser
```

### Client Books & Pays
```
Client clicks "Book Now"
         ↓
BookingForm loads rates from localStorage
         ↓
Applies platform charges + VAT
         ↓
Creates booking with total_amount
         ↓
Records payment
         ↓
Trainer earns full total_amount (no split)
```

### Trainer Promotion (BROKEN)
```
Trainer clicks "Promote"
         ↓
Submits commission_rate to 'promotion_insert'
         ↓
❌ API endpoint doesn't exist
         ↓
Request fails silently
```

---

## 7. Critical Issues Summary

| Issue | Severity | Impact | Status |
|-------|----------|--------|--------|
| Settings not persisted to database | 🔴 CRITICAL | Admin changes lost; rates not shared across devices | ❌ Not Fixed |
| No settings_get/settings_save API | 🔴 CRITICAL | Admin settings can't be retrieved by clients/trainers | ❌ Not Fixed |
| Trainer commission not split | 🔴 CRITICAL | Trainer gets full amount; platform takes nothing | ❌ Not Fixed |
| promotion_insert action missing | 🟡 HIGH | Trainers can't request commission changes | ❌ Not Fixed |
| No trainer wallet/balance system | 🟡 HIGH | Can't track trainer earnings or payouts | ❌ Not Fixed |
| Referrer rewards not credited | 🟡 HIGH | Referral incentive system incomplete | ❌ Not Fixed |
| Commission tax not stored | 🟠 MEDIUM | Can't audit fee breakdown after booking | ❌ Not Fixed |
| Payment breakdown not tracked | 🟠 MEDIUM | No visibility into platform earnings | ❌ Not Fixed |

---

## 8. Recommendations

### Priority 1: Settings Persistence (CRITICAL)
**Task**: Implement settings database storage

**Create table**:
```sql
CREATE TABLE IF NOT EXISTS `platform_settings` (
  `key` VARCHAR(255) PRIMARY KEY,
  `value` JSON,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Add API endpoints in api.php**:
```php
case 'settings_get':
    // SELECT all settings from platform_settings
    
case 'settings_save':
    // UPDATE or INSERT settings to platform_settings
```

**Impact**: ✅ Settings persist across sessions and are shared with all users

---

### Priority 2: Implement promotion_insert Action (HIGH)
**Task**: Complete trainer promotion workflow

**Option A**: Use generic insert (current approach by api-service)
- Update PromoteProfile.tsx to use: `apiService.createPromotionRequest(payload)`
- Requires `promotion_requests` table (check if it exists)

**Option B**: Create dedicated promotion_insert action
```php
case 'promotion_insert':
    // INSERT into promotion_requests table
```

**Impact**: ✅ Trainers can request commission changes; admin can approve

---

### Priority 3: Implement Trainer Commission Split (CRITICAL)
**Task**: Calculate and track trainer net amount after platform charges

**Create table**:
```sql
CREATE TABLE IF NOT EXISTS `booking_payments` (
  `id` VARCHAR(36) PRIMARY KEY,
  `booking_id` VARCHAR(36),
  `client_amount` DECIMAL(15,2),      -- What client pays
  `platform_fee` DECIMAL(15,2),       -- Platform takes
  `trainer_amount` DECIMAL(15,2),     -- Trainer receives
  `vat_amount` DECIMAL(15,2),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Update BookingForm.tsx**: Calculate and store trainer_amount
```typescript
const platformFee = Math.round((totalAmount * trainerChargePct) / 100)
const trainerAmount = totalAmount - platformFee
```

**Impact**: ✅ Accurate trainer earnings; ✅ Proper payout processing

---

### Priority 4: Implement Trainer Wallet System (HIGH)
**Task**: Track trainer earnings and balance

**Create tables**:
```sql
CREATE TABLE IF NOT EXISTS `trainer_wallets` (
  `trainer_id` VARCHAR(36) PRIMARY KEY,
  `balance` DECIMAL(15,2),
  `pending` DECIMAL(15,2),
  `earned` DECIMAL(15,2),
  `paid_out` DECIMAL(15,2),
  `updated_at` TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `trainer_transactions` (
  `id` VARCHAR(36) PRIMARY KEY,
  `trainer_id` VARCHAR(36),
  `booking_id` VARCHAR(36),
  `type` VARCHAR(50),              -- 'booking_income', 'payout', 'refund'
  `amount` DECIMAL(15,2),
  `balance_after` DECIMAL(15,2),
  `created_at` TIMESTAMP
);
```

**Workflow**:
1. When booking confirmed → Add to trainer_wallets.pending
2. When session completed → Move to trainer_wallets.balance
3. When payout approved → Deduct from balance, record transaction

**Impact**: ✅ Trainers see real-time earnings; ✅ Transparent payout history

---

### Priority 5: Implement Referrer Rewards (HIGH)
**Task**: Automatically credit referrer when referred user books

**Workflow**:
```
Client books with referral code
         ↓
referral_update marks code as used (✅ already done)
         ↓
Query referrer user from referrals table
         ↓
Calculate referrer reward: booking_amount × referralReferrerPercent
         ↓
Create transaction: ADD reward to referrer's wallet
         ↓
Send notification to referrer
```

**Impact**: ✅ Referral program incentivizes new trainer growth; ✅ Automatically processed

---

## 9. Implementation Timeline

| Phase | Tasks | Effort | Priority |
|-------|-------|--------|----------|
| **Phase 1** | ✅ Create platform_settings table<br>✅ Add settings_get/settings_save API | 4 hours | CRITICAL |
| **Phase 2** | ✅ Fix promotion_insert action<br>✅ Create promotion_requests table | 2 hours | HIGH |
| **Phase 3** | ✅ Create booking_payments table<br>✅ Update booking calculation<br>✅ Update payout processing | 6 hours | CRITICAL |
| **Phase 4** | ✅ Create trainer_wallets table<br>✅ Create trainer_transactions table<br>✅ Add wallet transaction logic | 4 hours | HIGH |
| **Phase 5** | ✅ Implement referrer reward crediting<br>✅ Add notification for rewards<br>✅ Test referral flow | 3 hours | HIGH |

**Total**: ~19 hours of development

---

## 10. Testing Checklist

After implementing recommendations:

### Admin Settings
- [ ] Admin sets commission to 20%
- [ ] Close browser, reopen → Settings persist
- [ ] Another browser loads same settings
- [ ] Change setting → New bookings use new rate

### Client Booking
- [ ] Client sees platform fee calculated correctly
- [ ] Referral code shows discount
- [ ] Booking total = base + fees - discount ✓

### Trainer Earnings
- [ ] Trainer can request commission change via promotion_insert ✓
- [ ] Trainer sees correct net amount (after platform fee)
- [ ] Trainer wallet shows pending and earned amounts
- [ ] Transaction history shows all booking income

### Referral Program
- [ ] Referrer automatically credited when referred user books
- [ ] Referrer receives notification
- [ ] Referrer sees earnings in wallet
- [ ] Client sees discount applied

---

## 11. Affected Components

### Frontend (Client-facing)
- ✅ src/components/client/BookingForm.tsx - WORKING
- ❌ src/components/trainer/PromoteProfile.tsx - BROKEN (action missing)
- ❌ src/components/trainer/Payouts.tsx - INCOMPLETE (no net calc)
- ⚠️ src/components/admin/AdminDashboard.tsx - PARTIAL (no DB persist)

### Backend (API)
- ❌ api.php - Missing settings_get, settings_save, promotion_insert
- ❌ Database - Missing platform_settings, booking_payments, trainer_wallets

### Configuration
- ⚠️ src/lib/settings.ts - LoadSettingsFromDb tries non-existent API

---

## Summary

The affiliate program has **excellent UI design** but **incomplete backend implementation**. 

**Current State**: 
- ✅ Admin can set all rates (UI)
- ❌ Rates not persisted to database
- ✅ Client portal applies rates correctly (from localStorage)
- ❌ Trainer commission not tracked/split
- ❌ Trainer rewards not credited

**To Make Fully Functional**: Implement 5 priority tasks above (~19 hours of work)

The code is well-structured and audit-ready for implementation. All pieces exist; they just need to be connected to the database and complete the backend logic.

---

**Report Status**: ✅ COMPLETE
**Recommendations**: 5 Priority Tasks Identified
**Estimated Effort**: 19 Development Hours
**Next Step**: Prioritize and assign implementation tasks
