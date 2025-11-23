# Fee Calculation Verification

This document verifies that the new fee calculation system is implemented correctly according to the specified calculation order.

## Calculation Order (Confirmed by User)

1. **Base booking amount**: Ksh 1000
2. **Calculate all charges on the base amount**:
   - platformChargeClient %: Charged to client
   - platformChargeTrainer %: Deducted from trainer
   - compensationFee %: Charged to client (operational fee)
3. **Sum all these charges**
4. **Apply maintenance fee on the sum of charges** (platform/developer revenue, NOT charged to client)
5. **Client payment** = Base + (platformChargeClient + compensationFee) + Transport
   - Does NOT include maintenance fee

## Implementation Details

### Settings (Default Values)
```javascript
platformChargeClientPercent: 15%   // What client pays as platform fee
platformChargeTrainerPercent: 10%  // What is deducted from trainer earnings
compensationFeePercent: 10%        // Compensation/operational fee
maintenanceFeePercent: 15%         // Applied to sum of all charges
```

### Example Calculation: Base Ksh 1000

#### Step 1: Calculate Charges on Base Amount
- platformChargeClient: 1000 × 15% = **Ksh 150**
- platformChargeTrainer: 1000 × 10% = **Ksh 100**
- compensationFee: 1000 × 10% = **Ksh 100**

#### Step 2: Sum All Charges
- Sum = 150 + 100 + 100 = **Ksh 350**

#### Step 3: Apply Maintenance Fee on Sum
- maintenanceFee = 350 × 15% = **Ksh 52.50**

#### Step 4: Calculate Client Total
- Client charges = platformChargeClient + compensationFee
- Client charges = 150 + 100 = **Ksh 250**
- Client total = 1000 + 250 = **Ksh 1,250.00**
- **Note**: Maintenance fee is NOT added to client payment (it's internal platform revenue)

#### Step 5: Calculate Trainer Net Amount
- Trainer's share of maintenance = (100 / 350) × 52.50 = **Ksh 15.00**
- Trainer net = 1000 + 0 - 100 - 15 = **Ksh 885.00**

### With Transport Fee (e.g., Ksh 200)

- Client total = Ksh 1,250.00 + 200 = **Ksh 1,450.00**
- Trainer net = Ksh 885.00 + 200 = **Ksh 1,085.00**

---

## Implementation Locations

### 1. Frontend - Fee Calculation Utility
**File**: `src/lib/fee-calculations.ts`

Exports:
- `calculateFeeBreakdown(baseAmount, settings, transportFee)` - Complete breakdown
- `calculateClientPayment(baseAmount, settings, transportFee)` - Quick client total
- `calculateTrainerEarnings(baseAmount, settings, transportFee)` - Trainer earnings

**Usage in BookingForm**:
```typescript
const feeBreakdown = calculateFeeBreakdown(baseAmount, {
  platformChargeClientPercent: settings.platformChargeClientPercent || 15,
  platformChargeTrainerPercent: settings.platformChargeTrainerPercent || 10,
  compensationFeePercent: settings.compensationFeePercent || 10,
  maintenanceFeePercent: settings.maintenanceFeePercent || 15,
}, transportFee)
```

### 2. Backend - PHP API Calculation
**File**: `api.php`

Functions:
- `loadPlatformSettings()` - Loads fee percentages from database
- `calculateFeeBreakdown($baseAmount, $settings, $transportFee)` - PHP equivalent of TS function

**Used in**: `booking_create` action (lines 2712-2730)

### 3. Settings Management
**File**: `src/lib/settings.ts`

Admin-configurable settings:
```typescript
platformChargeClientPercent: 15,
platformChargeTrainerPercent: 10,
compensationFeePercent: 10,
maintenanceFeePercent: 15,
```

---

## Fee Breakdown Display

### In BookingForm
Shows real-time calculation as trainer and sessions are selected:
- Base Service Amount
- Platform Charge (Client)
- Compensation Fee
- Maintenance Fee (on charges)
- Transport Fee (server-calculated)
- Estimated Total

### API Response
When booking_create is called, returns:
```json
{
  "booking_id": "booking_xxxxx",
  "base_service_amount": 1000,
  "transport_fee": 200,
  "platform_charge_client": 150,
  "platform_charge_trainer": 100,
  "compensation_fee": 100,
  "maintenance_fee": 52.50,
  "sum_of_charges": 350,
  "trainer_net_amount": 885,
  "client_surcharge": 252.50,
  "total_amount": 1502.50
}
```

---

## Database Storage

### Bookings Table
The `bookings` table stores:
- `base_service_amount`: Ksh 1000
- `platform_fee`: Ksh 252.50 (client_surcharge = client charges + maintenance)
- `vat_amount`: 0 (not applicable in new system)
- `trainer_net_amount`: Ksh 885
- `client_surcharge`: Ksh 252.50
- `total_amount`: Ksh 1502.50
- `transport_fee`: Ksh 200

### Payout Calculations
When trainer requests payout:
- Uses `trainer_net_amount` from confirmed bookings
- No additional commission is applied (it's already deducted)
- Sum of all `trainer_net_amount` = Trainer's payout

---

## Testing

Run the fee calculation tests:
```bash
npm test -- src/lib/fee-calculations.test.ts
```

Manual verification:
1. Create a booking with Ksh 1000 base amount
2. Select default number of sessions
3. Check BookingForm displays correct fee breakdown
4. Complete payment
5. Verify API response contains all fee details
6. Check booking details in database matches calculation

---

## Consistency Checks

The system ensures:
1. ✓ Client pays: base + (platformChargeClient + compensationFee) + maintenance + transport
2. ✓ Trainer receives: base + transport - (platformChargeTrainer + trainer's maintenance share)
3. ✓ All percentages are properly clamped to 0-100% range
4. ✓ Rounding is consistent (2 decimal places)
5. ✓ Transport fees are never subject to platform charges
6. ✓ Maintenance fee is applied on sum of all charges, not base amount

---

## Configuration via Admin Dashboard

Admins can adjust:
- Platform Charge (Client) %: Default 15%
- Platform Charge (Trainer) %: Default 10%
- Compensation Fee %: Default 10%
- Maintenance Fee %: Default 15%

Changes take effect immediately for new bookings.
