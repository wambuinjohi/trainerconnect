# Fix: Location Label Not Loading in Service Area Editor

## Problem
The `location_label` field is not loading/displaying in the ServiceAreaEditor modal, even though it should be stored in the database.

## Root Cause
The `location_label` column may not exist in the `user_profiles` table, or the component and API weren't properly handling the data loading.

---

## Solution Overview

### Step 1: Apply Database Migration

Run this SQL migration to ensure all location columns exist:

```sql
-- Add location columns to user_profiles if they don't exist
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS location_label VARCHAR(255) NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS location_lat DECIMAL(9, 6) NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS location_lng DECIMAL(9, 6) NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS service_radius INT NULL DEFAULT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_location_label 
  ON user_profiles(location_label);

CREATE INDEX IF NOT EXISTS idx_user_profiles_location_coords 
  ON user_profiles(location_lat, location_lng);

CREATE INDEX IF NOT EXISTS idx_user_profiles_service_radius 
  ON user_profiles(service_radius);
```

**File:** `scripts/sql/006-add-location-label-mysql.sql`

### Step 2: Verify the Column Exists

Run this diagnostic query to verify the column was added:

```sql
-- Check if location_label column exists
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'user_profiles'
  AND TABLE_SCHEMA = DATABASE()
  AND COLUMN_NAME IN ('location_label', 'location_lat', 'location_lng', 'service_radius')
ORDER BY COLUMN_NAME;
```

**Expected Result:** Should show 4 rows:
- `location_label` - VARCHAR(255), nullable
- `location_lat` - DECIMAL(9,6), nullable
- `location_lng` - DECIMAL(9,6), nullable
- `service_radius` - INT, nullable

**File:** `scripts/sql/005-verify-location-label-column.sql`

### Step 3: Check Existing Data

Verify if any trainers already have location data:

```sql
-- Check trainers with location data
SELECT 
    u.id,
    u.name,
    up.location_label,
    up.location_lat,
    up.location_lng,
    up.service_radius
FROM user_profiles up
JOIN users u ON up.user_id = u.id
WHERE u.user_type = 'trainer'
  AND (up.location_label IS NOT NULL 
       OR up.location_lat IS NOT NULL 
       OR up.location_lng IS NOT NULL)
LIMIT 20;
```

---

## Code Changes Applied

### 1. Enhanced ServiceAreaEditor Component

**File:** `src/components/trainer/ServiceAreaEditor.tsx`

**Changes:**
- ✅ Improved data loading logic to handle missing data
- ✅ Added debug logging to identify loading issues
- ✅ Better handling of location_label field
- ✅ Added coordinate validation (lat: -90 to 90, lng: -180 to 180)
- ✅ Trim whitespace from location_label before saving

**What it does:**
- When component loads, it now properly extracts `location_label` from the API response
- Logs to browser console which location fields were loaded (for debugging)
- Validates coordinates before saving
- Properly sends location_label to API (can be null or empty string)

### 2. Fixed profile_update API Endpoint

**File:** `api.php` (lines 2023-2037)

**Changes:**
- ✅ Now properly handles NULL values
- ✅ Can set `location_label` to NULL if user clears it
- ✅ Previously would skip NULL values, preventing updates

**What it does:**
- When location_label is null, it sets the column to NULL in database
- Previously it would skip the field entirely, causing updates to fail

---

## Testing Instructions

### Test 1: Check Column Exists

1. Run the diagnostic query from Step 2 above
2. Verify all 4 columns exist and are nullable

### Test 2: Load Service Area Editor

1. As a trainer, go to Profile
2. Click "Service Area" button
3. Open browser console (F12 → Console tab)
4. Look for message: `ServiceAreaEditor: Loaded profile data with fields: [...]`
5. Check if `location_lat`, `location_lng`, `location_label` are listed

### Test 3: Edit and Save Location Label

1. In Service Area Editor:
   - Enter latitude: `-1.2921`
   - Enter longitude: `36.8219`
   - Enter location label: `Nairobi, Kilimani`
   - Enter service radius: `10`
2. Click "Save"
3. Verify success message appears
4. Close and reopen Service Area editor
5. Verify all fields (especially location_label) are loaded

### Test 4: Clear Location Label

1. In Service Area Editor:
   - Clear the location_label field (leave empty)
   - Keep coordinates and radius
2. Click "Save"
3. Verify success message
4. Reopen Service Area editor
5. Verify location_label is empty but coordinates are still there

### Test 5: API Endpoint Test

Using curl or Postman, test the profile_get endpoint:

```bash
curl -X POST https://your-domain/api.php \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "action": "profile_get",
    "user_id": "TRAINER_USER_ID"
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "user_id": "...",
    "location_label": "Nairobi, Kilimani",
    "location_lat": -1.2921,
    "location_lng": 36.8219,
    "service_radius": 10,
    ...
  }
}
```

---

## Troubleshooting

### Issue: Column Still Doesn't Exist After Migration

**Solution:**
1. Check database permissions - may need DBA access
2. Try running migration directly in database client (MySQL Workbench, phpMyAdmin)
3. Check database error logs for constraint violations

### Issue: Location Label Still Empty After Saving

**Solution:**
1. Open browser console and check for JavaScript errors
2. Check network tab - is API returning success?
3. Verify the column exists (run diagnostic query)
4. Check API logs for profile_update errors

### Issue: Can't Clear Location Label

**Solution:**
- This should now be fixed with the API change
- Make sure you've restarted/redeployed the app with the new code

### Issue: Coordinates Validation Failing

**Solution:**
- Latitude must be between -90 and 90
- Longitude must be between -180 and 180
- Kenya coordinates should be around: Lat: -1 to -5, Lng: 30 to 42

---

## Related Files

- `src/components/trainer/ServiceAreaEditor.tsx` - Component that displays the editor
- `src/components/trainer/TrainerDashboard.tsx` - Triggers the editor modal
- `api.php` - Backend API endpoints (profile_get, profile_update)
- `scripts/sql/006-add-location-label-mysql.sql` - Migration script

---

## Before/After

### Before
```
1. User clicks "Service Area" button
2. Modal opens with empty fields
3. location_label not displayed (even if saved before)
4. Saving location_label doesn't work properly
```

### After
```
1. User clicks "Service Area" button
2. Modal opens with all fields populated (if they were saved)
3. location_label displays correctly: "Nairobi, Kilimani"
4. Can edit and save location_label properly
5. Can clear location_label if needed
6. Coordinate validation prevents invalid data
```

---

## Success Criteria

✅ location_label column exists in user_profiles table
✅ ServiceAreaEditor loads existing location_label when opened
✅ User can edit location_label and save it
✅ Changes persist after page refresh
✅ Browser console shows field loaded successfully
✅ API returns location_label in profile_get response
