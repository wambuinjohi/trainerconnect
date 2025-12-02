# Fee Calculation and Commission System Documentation

## Overview

This document explains how fees are calculated in the TrainerCoachConnect system and ensures that **transport fees are never included in commission calculations**.

## Fee Structure

### For Each Booking:

1. **Base Service Amount** (BSA)
   - Calculated as: `hourly_rate * number_of_sessions`
   - Discounts (e.g., referral) are applied to this amount
   - Examples:
     - 1 session @ Ksh 1,000/hr = Ksh 1,000 BSA
     - 5 sessions @ Ksh 1,000/hr = Ksh 5,000 BSA

2. **Transport Fee** (TF)
   - Calculated based on distance from trainer to client location
   - Uses trainer's `hourly_rate_by_radius` pricing tiers
   - Determined by: finding the first tier where `distance <= tier.radius`, use that tier's rate
   - If distance exceeds all tiers, uses the highest tier's rate
   - **IMPORTANT: Transport fees are NOT subject to platform commission**
   - Examples:
     - Tier 1: 0-5km = Ksh 100
     - Tier 2: 5-10km = Ksh 200
     - Tier 3: 10+km = Ksh 300
     - Client 7km away → Ksh 200 transport fee (matched to Tier 2)

3. **Subtotal** (ST)
   - Calculated as: `base_service_amount + transport_fee`
   - This is the amount the trainer earns before platform deductions

4. **Platform Fee** (PF)
   - Platform commission deducted from service amount only
   - Calculated as: `(base_service_amount * platform_fee_percentage) / 100`
   - Percentage: 10% (configurable in settings)
   - **Transport fees are NOT included in this calculation**
   - Example: If BSA = Ksh 1,000 and TF = Ksh 200, PF = (1,000 × 10%) = Ksh 100

5. **Trainer Net Amount** (TNA)
   - What the trainer receives after platform deduction
   - Calculated as: `base_service_amount + transport_fee - platform_fee`
   - Example: TNA = 1,000 + 200 - 100 = Ksh 1,100

6. **VAT (Tax)** (VAT)
   - Applied to the subtotal + platform fee
   - Calculated as: `(subtotal + platform_fee) * vat_percentage / 100`
   - Percentage: 16% (configurable in settings)
   - Example: VAT = (1,200 + 100) × 16% = Ksh 208

7. **Client Total** (CT)
   - What the client pays
   - Calculated as: `base_service_amount + transport_fee + platform_fee + vat`
   - Example: CT = 1,000 + 200 + 100 + 208 = Ksh 1,508

## Example Calculation

**Booking Details:**
- Hourly Rate: Ksh 1,000
- Sessions: 1
- Distance: 7km
- Transport Tier: Ksh 200 (for 5-10km)

**Fee Breakdown:**
```
Base Service Amount         Ksh 1,000.00
Transport Fee (distance)    Ksh   200.00
─────────────────────────────────────────
Subtotal                    Ksh 1,200.00

Platform Fee (10% of BSA)   Ksh   100.00  ← Only on service, NOT transport
─────────────────────────────────────────
Trainer Net Amount          Ksh 1,100.00  ← What trainer gets

VAT (16%)                   Ksh   208.00  ← On subtotal + platform fee
��────────────────────────────────────────
CLIENT TOTAL                Ksh 1,508.00  ← What client pays
```

## Storage in Database

### Bookings Table
Each booking record stores:
- `base_service_amount` - The service amount before any fees
- `transport_fee` - Distance-based fee
- `platform_fee` - Platform commission deducted
- `vat_amount` - Tax amount
- `trainer_net_amount` - What trainer receives (TNA)
- `client_surcharge` - Platform fee shown to client (same as platform_fee)
- `total_amount` - Total amount client pays (CT)

### Invoices Table
When a booking is confirmed and payment is received, an invoice is generated storing:
- All fee breakdowns (same as bookings)
- `invoice_number` - Unique invoice reference
- `status` - 'pending', 'paid', etc.
- `paid_at` - When payment was received

### Payments Table
Payment records store:
- `amount` - Total amount paid (matches `total_amount` from booking)
- `fee_breakdown` - Optional JSON with detailed breakdown

## Commission Exclusion Guarantee

### Platform Commission
```
Platform Commission = (base_service_amount * 10%) / 100
NOT: (base_service_amount + transport_fee) * 10%
```

**Implementation:**
- In `booking_create` action: `$platformFee = round(($baseServiceAmount * $platformFeePct) / 100, 2);`
- Transport fees are explicitly excluded

### Trainer Payouts
When a trainer requests a payout:
1. Admin calculates trainer net from all completed bookings
2. Trainer Net = sum of all `trainer_net_amount` from bookings
3. Payout approval deducts any additional platform payout fees (if applicable)
4. Final amount transferred to trainer via B2C

**Flow:**
```
Booking 1: TNA = Ksh 1,100
Booking 2: TNA = Ksh 950
Booking 3: TNA = Ksh 1,250
──────────────────────────
Total Trainer Net = Ksh 3,300
[Trainer requests payout of Ksh 3,300]
Payout Commission (if any) = 0 (commissions don't apply to trainer net)
Final Payout Amount = Ksh 3,300
```

## Code References

### Server-Side Calculation
- **File:** `api.php`
- **Action:** `booking_create`
- **Lines:** 2398-2615
- **Key Functions:**
  - `calculateDistance()` - Haversine formula (lines 111-145)
  - `calculateTransportFee()` - Distance tier matching (lines 147-182)

### Client-Side Integration
- **File:** `src/components/client/BookingForm.tsx`
- **Lines:** 29-90 (booking submission with fee breakdown display)

### Database Schema
- **File:** `scripts/sql/002-add-fee-breakdown-columns.sql`
- **Tables:** `bookings`, `invoices`, `payments`

## Testing Transport Fee Exclusion

To verify transport fees are correctly excluded from commissions:

1. Create a booking with known distance and transport fee
2. Check the `bookings` table:
   - Verify `base_service_amount` is correct
   - Verify `transport_fee` is calculated from distance tiers
   - Verify `platform_fee = (base_service_amount * 10%)`  ← NOT including transport
   - Verify `trainer_net_amount = base_service_amount + transport_fee - platform_fee`

3. Request payout with the booking's `trainer_net_amount`
4. Verify no additional commission is deducted from transport portion

## Configuration

Settings are managed in the admin dashboard and stored in `platform_settings`:
- `platformChargeClientPercent` - Platform fee percentage (default: 10%)
- `taxRate` - VAT percentage (default: 16%)
- `referralClientDiscount` - Referral discount percentage

Each trainer can configure distance-based pricing in their profile:
- `location_lat`, `location_lng` - Trainer's service location
- `service_radius` - Maximum service radius in kilometers
- `hourly_rate_by_radius` - JSON array of tiered rates by distance
  ```json
  [
    { "radius_km": 5, "rate": 100 },
    { "radius_km": 10, "rate": 200 },
    { "radius_km": 20, "rate": 300 }
  ]
  ```

## Auditing and Reporting

To audit the system:

1. **Verify platform commissions:**
   ```sql
   SELECT booking_id, base_service_amount, platform_fee,
          (base_service_amount * 0.10) AS calculated_fee
   FROM bookings
   WHERE ABS(platform_fee - (base_service_amount * 0.10)) > 0.01
   -- Should return 0 rows (no discrepancies)
   ```

2. **Verify trainer net amounts:**
   ```sql
   SELECT booking_id, 
          (base_service_amount + transport_fee - platform_fee) AS calculated_tna,
          trainer_net_amount,
          ABS((base_service_amount + transport_fee - platform_fee) - trainer_net_amount) AS diff
   FROM bookings
   WHERE ABS((base_service_amount + transport_fee - platform_fee) - trainer_net_amount) > 0.01
   -- Should return 0 rows (all calculated correctly)
   ```

3. **Verify client totals:**
   ```sql
   SELECT booking_id,
          (base_service_amount + transport_fee + platform_fee + vat_amount) AS calculated_total,
          total_amount,
          ABS((base_service_amount + transport_fee + platform_fee + vat_amount) - total_amount) AS diff
   FROM bookings
   WHERE ABS((base_service_amount + transport_fee + platform_fee + vat_amount) - total_amount) > 0.01
   -- Should return 0 rows (all match)
   ```
