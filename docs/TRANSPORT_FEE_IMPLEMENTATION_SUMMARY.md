# Transport Fee Implementation Summary

## Overview
Implemented a complete transport fee calculation system that ensures **commissions do NOT apply to transport fees**. The system calculates distance-based transport fees at booking time and stores a complete fee breakdown for auditing.

## What Was Implemented

### 1. Database Schema Updates ✅
**File:** `scripts/sql/002-add-fee-breakdown-columns.sql`

**New Columns in `bookings` table:**
- `base_service_amount` - Service cost before fees
- `transport_fee` - Distance-based delivery fee
- `platform_fee` - Platform commission (10% of service only)
- `vat_amount` - Tax amount
- `trainer_net_amount` - What trainer receives
- `client_surcharge` - Platform fee visible to client
- `client_location_lat` / `client_location_lng` / `client_location_label` - Client location
- `updated_at` - Last update timestamp

**New Columns in `payments` table:**
- `fee_breakdown` - JSON store of fee details
- `updated_at` - Last update timestamp

**New `invoices` Table:**
- Complete invoice records with all fee breakdowns
- Invoice numbering and tracking
- Payment status tracking

### 2. Server-Side Fee Calculation ✅
**File:** `api.php`

**Helper Functions (lines 111-182):**
- `calculateDistance()` - Haversine formula for lat/lng to km conversion
  - Validates coordinates are within valid ranges (-90 to 90 lat, -180 to 180 lng)
  - Returns null for invalid/out-of-range coordinates
  - Sanity check: rejects distances > 20,000km (impossible on Earth)

- `calculateTransportFee()` - Matches distance to pricing tiers
  - Uses trainer's `hourly_rate_by_radius` configuration
  - Finds first tier where distance ≤ tier radius
  - Uses highest tier if distance exceeds all tiers

**New Action: `booking_create` (lines 2398-2615)**
- Replaces the generic `booking_insert` for proper fee handling
- Accepts: client_id, trainer_id, session_date, session_time, base_service_amount, client location
- Fetches trainer profile with location and pricing tiers
- Validates trainer availability
- **Calculates transport fee based on client-trainer distance**
- **Calculates platform fee ONLY on base service amount** (key requirement)
- Calculates VAT on (base_service + platform_fee)
- Calculates trainer net = base_service + transport_fee - platform_fee
- Stores all values in booking record
- Returns complete fee breakdown to client

**New Action: `invoice_generate` (lines 2840-2920)**
- Creates invoice records from bookings
- Generates unique invoice numbers
- Stores all fee details for auditing

### 3. Client-Side Changes ✅
**File:** `src/components/client/BookingForm.tsx`

**Updated Submission Logic:**
- Now sends `base_service_amount` instead of `total_amount`
- Sends client location data (lat/lng/label)
- Uses new `booking_create` action via `apiRequest()`
- Receives and displays complete fee breakdown from server
- Updated pricing display to show fee calculation note

**Key Change:**
- All fee calculations now happen server-side, ensuring accuracy and security
- Client no longer calculates fees locally (server is source of truth)

### 4. Commission Exclusion Guarantee ✅

**Implementation Details:**

In `booking_create` action:
```php
// Platform fee calculated ONLY on base service, NOT transport
$platformFee = round(($baseServiceAmount * $platformFeePct) / 100, 2);

// Trainer gets service + transport - only service commission deducted
$trainerNetAmount = round($baseServiceAmount + $transportFee - $platformFee, 2);
```

**For Payouts:**
- Trainer payout requests use `trainer_net_amount` (which already excludes commission)
- Since `trainer_net_amount = base_service + transport_fee - platform_fee`:
  - Platform commission is only applied to service (not transport)
  - Transport fees are included in trainer payout without commission deduction
  - Payout approval doesn't apply additional commission

### 5. Documentation ✅
**File:** `docs/FEE_CALCULATION_DOCUMENTATION.md`
- Complete fee structure explanation
- Example calculations with numbers
- Database storage details
- Commission exclusion guarantee
- SQL audit queries to verify calculations
- Configuration reference

## Fee Calculation Flow

### Step 1: Booking Submission
```
Client submits:
- session_date, session_time, sessions (hours)
- base_service_amount (hourly_rate × sessions)
- client location (lat/lng)
```

### Step 2: Server-Side Processing (booking_create)
```
Fetch trainer profile:
- location_lat, location_lng
- hourly_rate_by_radius tiers

Calculate:
1. distance = Haversine(trainer_location, client_location)
2. transport_fee = match distance to tier rates
3. platform_fee = (base_service_amount × 10%) ← NOT including transport
4. vat_amount = ((base_service + platform_fee) × 16%)
5. trainer_net = base_service + transport_fee - platform_fee
6. total_for_client = base_service + transport_fee + platform_fee + vat
```

### Step 3: Storage
```
booking record stores:
- base_service_amount
- transport_fee
- platform_fee
- vat_amount
- trainer_net_amount
- client_surcharge
- total_amount
```

### Step 4: Payment & Invoice
```
Payment recorded with total_amount
Invoice generated with all fee breakdown details
Trainer receives trainer_net_amount in payout (no further deductions from transport)
```

## Files Modified

1. **api.php** - 250+ lines added
   - Helper functions for distance and transport fee calculation
   - New `booking_create` action with complete fee handling
   - New `invoice_generate` action for receipt generation
   - Comments explaining commission exclusion

2. **src/components/client/BookingForm.tsx** - 50+ lines modified
   - Updated to use `booking_create` instead of generic `insert`
   - Modified fee calculation and display
   - Server-side fee display

3. **Database Migration**
   - `scripts/sql/002-add-fee-breakdown-columns.sql` (new file)
   - Adds fee breakdown columns to bookings
   - Creates invoices table
   - Adds helpful indexes

## Testing Checklist

- [ ] Create booking with trainer in same city (distance ~ 0)
  - Verify: transport_fee = 0
  - Verify: platform_fee = (base_service × 10%)
  - Verify: trainer_net = base_service - platform_fee

- [ ] Create booking with trainer 50km away
  - Verify: distance calculated correctly
  - Verify: transport_fee matched to correct tier
  - Verify: platform_fee = (base_service × 10%) only
  - Verify: trainer_net = base_service + transport_fee - platform_fee

- [ ] Verify trainer payout
  - Request payout with multiple bookings
  - Verify: payout = sum of trainer_net_amount
  - Verify: no additional commission on transport fees

- [ ] Verify invoice generation
  - Confirm booking → generate invoice
  - Verify: all fee fields match booking record
  - Verify: invoice_number is unique

- [ ] SQL audit queries
  - Run queries from FEE_CALCULATION_DOCUMENTATION.md
  - Verify: no calculation discrepancies

## Key Security Features

1. **Server-Side Calculation** - All fees calculated on server, client cannot manipulate
2. **Coordinate Validation** - Rejects invalid lat/lng values
3. **Distance Sanity Checks** - Rejects impossible distances
4. **Commission Exclusion** - Transport fees mathematically excluded from platform commission
5. **Audit Trail** - All fees stored in database for verification
6. **Invoice Records** - Permanent record of every transaction breakdown

## Backward Compatibility

- Old `booking_insert` action still works (for existing code)
- New `booking_create` is recommended for all new bookings
- Migration guide: Update all booking creation to use `booking_create` action

## Future Enhancements

1. Admin dashboard to view fee analytics
2. Detailed trainer earnings reports (showing transport vs service)
3. Client expense reports (showing transport vs service costs)
4. Automatic invoice email/download
5. Transport fee customization by client (e.g., "I will travel to trainer" vs "Trainer travels to me")

## Configuration

Adjustable in platform settings:
- Platform commission percentage (currently 10%)
- VAT rate (currently 16%)
- Distance-based pricing tiers (per trainer)

Trainer-configurable:
- Service location (latitude/longitude)
- Distance pricing tiers via their profile
