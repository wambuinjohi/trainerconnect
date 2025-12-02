# Trainer Availability Audit Report

**Date**: 2025  
**Purpose**: Document how trainer availability is saved and displayed in both trainer and client interfaces

---

## Executive Summary

The trainer availability system is a comprehensive weekly scheduling feature that allows trainers to define their working hours and enables clients to view available time slots before booking. The system uses:

- **Storage**: JSON format in the `user_profiles` table, `availability` column
- **Trainer UI**: `AvailabilityEditor.tsx` modal component with per-day time slot configuration
- **Client UI**: `TrainerDetails.tsx` displays availability in a read-only format
- **API**: Custom `profile_get` and `profile_update` endpoints via `api.php`

---

## 1. Data Structure & Storage

### Database Schema

**Table**: `user_profiles`

```sql
CREATE TABLE `user_profiles` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `user_id` VARCHAR(36) NOT NULL UNIQUE,
  `user_type` VARCHAR(50) NOT NULL DEFAULT 'client',
  `availability` JSON,
  -- ... other columns
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_user_type (user_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

**Column**: `availability` (JSON type)

### Availability Data Format

The availability is stored as a JSON object with the following structure:

```json
{
  "monday": ["09:00-11:00", "14:00-16:00"],
  "tuesday": ["09:00-11:00", "14:00-16:00"],
  "wednesday": ["09:00-11:00", "14:00-16:00"],
  "thursday": ["09:00-11:00", "14:00-16:00"],
  "friday": ["09:00-11:00", "14:00-16:00"],
  "saturday": [],
  "sunday": []
}
```

**Format Specification**:
- Each day (lowercase: `monday`, `tuesday`, ..., `sunday`) maps to an array of time slots
- Each time slot is a string in format: `"HH:MM-HH:MM"` (24-hour format)
- Slots are sorted chronologically per day
- Empty array `[]` indicates the trainer is unavailable that day
- No overlapping time slots allowed (validated on the client side)

**Storage Method**: Arrays and objects are automatically JSON-encoded when stored via the API endpoint

---

## 2. Trainer Side: How Availability is Edited & Saved

### Component: `AvailabilityEditor.tsx`

**Location**: `src/components/trainer/AvailabilityEditor.tsx`  
**Type**: Modal dialog component  
**Access**: Opened from `TrainerDashboard.tsx` via "Edit Availability" button

### Key Features

1. **Weekly Schedule View**
   - Seven separate day sections (Monday through Sunday)
   - Each day has a toggle switch (`isAvailable`) to mark availability
   - Days without slots show "Marked as unavailable"

2. **Time Slot Management**
   - Each day can have multiple time slots
   - For each slot: Start time and end time (24-hour format)
   - Visual controls:
     - Add Slot button (creates new slot, inherits end time of previous slot + 1 hour)
     - Remove button for individual slots
     - Copy utilities to duplicate one day to multiple days

3. **Data Flow**

   ```
   AvailabilityEditor (Modal)
     ↓
   Load Profile → parseAvailability() → ScheduleState
     ↓
   User edits slots
     ↓
   buildPayload() → AvailabilityPayload
     ↓
   apiRequest('profile_update', {..., availability: payload})
     ��
   API Handler (api.php)
     ↓
   Database Update (JSON stored)
   ```

### Load Process

```typescript
// From AvailabilityEditor.tsx useEffect hook
useEffect(() => {
  if (!userId) return
  let active = true
  setLoading(true)

  apiRequest('profile_get', { user_id: userId }, { headers: withAuth() })
    .then((data: any) => {
      if (!active) return
      const parsed = parseAvailability(data?.availability)
      setSchedule(parsed)
      setInitialPayload(buildPayload(parsed))
    })
    .catch((error: any) => {
      console.warn('Failed to load availability', error)
      setSchedule(createEmptySchedule())
      setInitialPayload(buildPayload(createEmptySchedule()))
    })
    .finally(() => {
      if (active) setLoading(false)
    })

  return () => {
    active = false
  }
}, [userId])
```

### Parse Function: `parseAvailability()`

Handles multiple input formats:

```typescript
const parseAvailability = (raw: unknown): ScheduleState => {
  if (typeof raw === 'string') {
    try {
      return parseAvailability(JSON.parse(raw))
    } catch {
      return createEmptySchedule()
    }
  }

  const schedule = createEmptySchedule()
  if (!raw || typeof raw !== 'object') return schedule

  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    const dayKey = key.toLowerCase() as DayKey
    if (!schedule[dayKey]) return
    if (!Array.isArray(value)) {
      schedule[dayKey] = []
      return
    }

    const slots: Slot[] = []
    value.forEach((entry, index) => {
      if (typeof entry === 'string') {
        const [start, end] = entry.split('-')
        const normalizedStart = normalizeTime(start)
        const normalizedEnd = normalizeTime(end)
        if (normalizedStart && normalizedEnd) 
          slots.push({ id: createId(`${dayKey}-${index}`), start: normalizedStart, end: normalizedEnd })
      }
      if (entry && typeof entry === 'object') {
        const normalizedStart = normalizeTime((entry as any).start ?? (entry as any).from)
        const normalizedEnd = normalizeTime((entry as any).end ?? (entry as any).to)
        if (normalizedStart && normalizedEnd) 
          slots.push({ id: createId(`${dayKey}-${index}`), start: normalizedStart, end: normalizedEnd })
      }
    })

    slots.sort((a, b) => a.start.localeCompare(b.start))
    schedule[dayKey] = slots
  })

  return schedule
}
```

**Supported formats**:
- String format: `"09:00-11:00"`
- Object with `start`/`end` keys
- Object with `from`/`to` keys (for backwards compatibility)
- String representation of JSON (auto-parses)

### Build Payload Function: `buildPayload()`

Converts internal schedule state to storage format:

```typescript
const buildPayload = (schedule: ScheduleState): AvailabilityPayload => {
  const payload: Partial<AvailabilityPayload> = {}
  DAYS.forEach(day => {
    const slots = schedule[day.key]
      .filter(slot => isValidTime(slot.start) && isValidTime(slot.end) && slot.start < slot.end)
      .sort((a, b) => a.start.localeCompare(b.start))
      .map(slot => `${slot.start}-${slot.end}`)
    payload[day.key] = slots
  })
  return payload as AvailabilityPayload
}
```

**Processing**:
- Filters out invalid time slots
- Removes overlapping slots
- Sorts by start time
- Converts to `"HH:MM-HH:MM"` format

### Validation: `validateSchedule()`

Before saving, the component validates:

```typescript
const validateSchedule = (schedule: ScheduleState): string | null => {
  for (const day of DAYS) {
    const slots = schedule[day.key]
    if (!Array.isArray(slots)) continue
    
    const normalized = slots
      .map(slot => ({ start: slot.start, end: slot.end }))
      .filter(slot => slot.start || slot.end)
      .sort((a, b) => a.start.localeCompare(b.start))

    for (let i = 0; i < normalized.length; i += 1) {
      const slot = normalized[i]
      
      // Check valid times
      if (!isValidTime(slot.start) || !isValidTime(slot.end)) {
        return `Enter valid times for ${day.label}.`
      }
      
      // Check end after start
      if (slot.start >= slot.end) {
        return `The end time must be after the start time on ${day.label}.`
      }
      
      // Check for overlaps
      if (i > 0) {
        const previous = normalized[i - 1]
        if (previous.end > slot.start) {
          return `Time slots overlap on ${day.label}.`
        }
      }
    }
  }
  return null
}
```

**Validation Rules**:
1. Times must be in valid HH:MM format (00:00-23:59)
2. End time must be after start time
3. No overlapping slots within the same day
4. At least one valid slot required per day (if day is marked available)

### Save Process

```typescript
const handleSave = async () => {
  if (!userId) return
  
  // Validate first
  const message = validateSchedule(schedule)
  if (message) {
    setShowValidationError(true)
    toast({ title: 'Check availability', description: message, variant: 'destructive' })
    return
  }

  setSaving(true)
  try {
    const payload = buildPayload(schedule)
    
    // Send to API
    await apiRequest(
      'profile_update',
      { 
        user_id: userId, 
        user_type: 'trainer', 
        availability: payload 
      },
      { headers: withAuth() }
    )

    setInitialPayload(payload)
    setShowValidationError(false)
    toast({ title: 'Availability saved', description: 'Your timetable is updated for clients.' })
    onClose?.()
  } catch (error) {
    const description = (error as any)?.message || 'Failed to save availability. Please try again.'
    toast({ title: 'Error saving availability', description, variant: 'destructive' })
  } finally {
    setSaving(false)
  }
}
```

### UI Controls Summary

| Control | Action | Behavior |
|---------|--------|----------|
| Day toggle switch | Mark available/unavailable | Sets slots to `[]` when off |
| Add time slot | Create new slot | New slot starts after last slot's end time |
| Time inputs | Edit start/end times | Real-time update to component state |
| Remove button | Delete slot | Removes slot from day's array |
| Copy Monday to weekdays | Bulk copy | Duplicates all of Monday's slots to Tue-Fri |
| Copy Saturday to Sunday | Bulk copy | Duplicates Saturday's slots to Sunday |
| Clear all | Reset all days | Sets all days to empty arrays |

### Time Input Helper: `normalizeTime()`

Handles flexible time input:

```typescript
const normalizeTime = (value: unknown): string => {
  const stringValue = typeof value === 'string' ? value : (value == null ? '' : String(value))
  const trimmed = stringValue.trim()
  if (trimmed === '') return ''

  const match = trimmed.match(/^(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) return ''

  const hours = Number(match[1])
  const minutes = Number(match[2] ?? '0')

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return ''
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return ''

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
```

**Accepts**:
- `"09"` → `"09:00"`
- `"9:30"` → `"09:30"`
- `"930"` → `"09:30"`
- `"09:30"` → `"09:30"`

---

## 3. Trainer Side: Dashboard Display

### Component: `TrainerDashboard.tsx`

**Location**: `src/components/trainer/TrainerDashboard.tsx`

### Display in Profile Section

```typescript
// Lines 375-380
{profileData.availability && profileData.availability.length > 0 && (
  <div>
    <p className="text-xs text-muted-foreground">Availability</p>
    <p className="text-sm text-foreground">
      {typeof profileData.availability === 'object' 
        ? Object.keys(profileData.availability).join(', ') 
        : 'Check schedule'}
    </p>
  </div>
)}
```

**Display Logic**:
- Shows availability section only if data exists
- Displays day names as a comma-separated list (e.g., "monday, tuesday, wednesday")
- Falls back to "Check schedule" for string data
- **Note**: This shows available DAYS, not time slots

### Loading Profile Data

```typescript
useEffect(() => {
  const loadTrainerProfile = async () => {
    if (!user?.id) return
    try {
      const profile = await apiService.getTrainerProfile(user.id)
      if (profile?.data && profile.data.length > 0) {
        const profileData = profile.data[0]
        setProfileData({
          name: profileData.full_name || user.email,
          bio: profileData.bio || 'Professional Trainer',
          profile_image: profileData.profile_image || null,
          hourly_rate: profileData.hourly_rate || 0,
          // Parse availability if it's a string
          availability: profileData.availability 
            ? (typeof profileData.availability === 'string' 
              ? JSON.parse(profileData.availability) 
              : profileData.availability) 
            : [],
          pricing_packages: profileData.pricing_packages 
            ? (typeof profileData.pricing_packages === 'string' 
              ? JSON.parse(profileData.pricing_packages) 
              : profileData.pricing_packages) 
            : []
        })
      }
    } catch (err) {
      console.warn('Failed to load trainer profile', err)
    }
  }
  loadTrainerProfile()
}, [user?.id])
```

### Edit Availability Button

```typescript
// Line 386
<Button 
  variant="outline" 
  className="w-full" 
  onClick={() => setEditingAvailability(true)}
>
  Edit Availability
</Button>
```

**Trigger**: Sets `editingAvailability` state to `true`  
**Result**: Opens `<AvailabilityEditor />` modal

---

## 4. Client Side: How Availability is Displayed

### Component: `TrainerDetails.tsx`

**Location**: `src/components/client/TrainerDetails.tsx`  
**Purpose**: Shows trainer details when client clicks on a trainer in search results

### Display Section

```typescript
// Lines 100-112
{profile?.availability && (
  <div>
    <h4 className="font-semibold mb-2">Availability</h4>
    <div className="grid grid-cols-1 gap-1 text-sm">
      {Object.entries(profile.availability as any).map(([day, slots]: any) => (
        <div key={day} className="flex justify-between">
          <span className="text-muted-foreground capitalize">{day}</span>
          <span className="text-foreground">
            {Array.isArray(slots) && slots.length 
              ? slots.join(', ') 
              : '—'}
          </span>
        </div>
      ))}
    </div>
  </div>
)}
```

### Display Output

**Format**: Shows each day with its time slots

```
Availability
monday         09:00-11:00, 14:00-16:00
tuesday        09:00-11:00, 14:00-16:00
wednesday      09:00-11:00, 14:00-16:00
thursday       09:00-11:00, 14:00-16:00
friday         09:00-11:00, 14:00-16:00
saturday       —
sunday         —
```

**Rendering Logic**:
- Iterates through each day in the availability object
- Capitalizes day names automatically
- Shows time slots as comma-separated list
- Shows "—" for unavailable days

### Loading Profile Data

```typescript
// Lines 18-29
useEffect(() => {
  const fetchProfile = async () => {
    try {
      const data = await apiRequest(
        'profile_get', 
        { user_id: trainer.id }, 
        { headers: withAuth() }
      )
      if (data) setProfile(data)
    } catch (err) {
      // ignore
    }
  }
  fetchProfile()
}, [trainer.id])
```

**Data Source**: Fetches full trainer profile including availability  
**Used in**: When client views trainer details modal

---

## 5. API Endpoints

### Endpoint: `profile_get`

**File**: `api.php` (lines 1610-1629)  
**Method**: POST  
**Authentication**: Required (via `Authorization` header)

**Request**:
```json
{
  "action": "profile_get",
  "user_id": "trainer-uuid"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Profile fetched successfully.",
  "data": {
    "id": "profile-uuid",
    "user_id": "trainer-uuid",
    "user_type": "trainer",
    "full_name": "John Doe",
    "availability": {
      "monday": ["09:00-11:00", "14:00-16:00"],
      "tuesday": ["09:00-11:00", "14:00-16:00"],
      ...
    },
    ...
  }
}
```

**Implementation**:
```php
case 'profile_get':
    if (!isset($input['user_id'])) {
        respond("error", "Missing user_id.", null, 400);
    }

    $userId = $conn->real_escape_string($input['user_id']);
    $sql = "SELECT * FROM user_profiles WHERE user_id = '$userId' LIMIT 1";
    $result = $conn->query($sql);

    if (!$result) {
        respond("error", "Query failed: " . $conn->error, null, 500);
    }

    if ($result->num_rows === 0) {
        respond("success", "Profile not found.", ["data" => null]);
    }

    $profile = $result->fetch_assoc();
    respond("success", "Profile fetched successfully.", ["data" => $profile]);
    break;
```

### Endpoint: `profile_update`

**File**: `api.php` (lines 1632-1680)  
**Method**: POST  
**Authentication**: Required (via `Authorization` header)

**Request**:
```json
{
  "action": "profile_update",
  "user_id": "trainer-uuid",
  "user_type": "trainer",
  "availability": {
    "monday": ["09:00-11:00", "14:00-16:00"],
    "tuesday": ["09:00-11:00", "14:00-16:00"],
    ...
  }
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Profile updated successfully.",
  "data": {
    "affected_rows": 1
  }
}
```

**Implementation** (simplified):
```php
case 'profile_update':
    if (!isset($input['user_id'])) {
        respond("error", "Missing user_id.", null, 400);
    }

    $userId = $conn->real_escape_string($input['user_id']);
    $updates = [];
    $params = [];
    $types = "";

    foreach ($input as $key => $value) {
        if ($key === 'user_id' || $key === 'action') continue;
        if ($value === null) continue;

        $safeKey = $conn->real_escape_string($key);
        if (is_array($value) || is_object($value)) {
            $updates[] = "`$safeKey` = ?";
            $params[] = json_encode($value);  // Converts to JSON string
            $types .= "s";
        } else {
            $updates[] = "`$safeKey` = ?";
            $params[] = $value;
            $types .= is_numeric($value) && strpos($value, '.') === false ? "i" : "s";
        }
    }

    $params[] = $userId;
    $types .= "s";

    $sql = "UPDATE user_profiles SET " . implode(", ", $updates) . " WHERE user_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);

    if ($stmt->execute()) {
        $stmt->close();
        logEvent('profile_updated', ['user_id' => $userId]);
        respond("success", "Profile updated successfully.", ["affected_rows" => $conn->affected_rows]);
    } else {
        $stmt->close();
        respond("error", "Failed to update profile: " . $conn->error, null, 500);
    }
    break;
```

**Key Processing**:
1. Accepts dynamic fields via loop
2. If field is array/object, JSON-encodes it automatically
3. Uses prepared statements to prevent SQL injection
4. Logs the update event

---

## 6. Data Flow Diagram

```
TRAINER SIDE:
──────────────────────────────────────────────────────────────────

TrainerDashboard
  ↓ (loads profile on mount)
  ├─ apiService.getTrainerProfile(user_id)
  │  ↓
  │  ├─ api.php: profile_get
  │  │  ↓
  │  │  └─ SELECT * FROM user_profiles WHERE user_id = ?
  │  ↓
  │  └─ Sets profileData.availability
  ↓
  "Edit Availability" button
  ↓
  AvailabilityEditor (Modal)
  ├─ Load existing availability
  │  ├─ apiRequest('profile_get', {user_id})
  │  └─ parseAvailability(data.availability)
  ├─ User edits schedule (add/remove/modify slots)
  ├─ Validate schedule (validateSchedule)
  │  ├─ Check valid times
  │  ├─ Check no overlaps
  │  └─ Check end > start
  ├─ Save availability
  │  ├─ buildPayload(schedule) → {monday: [...], tuesday: [...]}
  │  └─ apiRequest('profile_update', {user_id, availability: payload})
  │     ↓
  │     api.php: profile_update
  │       ├─ json_encode(availability) → JSON string
  │       └─ UPDATE user_profiles SET availability = ? WHERE user_id = ?
  │          ↓
  │          Database stores JSON: {"monday": ["09:00-11:00"], ...}
  └─ Close modal & show success toast

──────────────────────────────────────────────────────────────────

CLIENT SIDE:
──────────────────────────────────────────────────────────────────

ClientDashboard
  ↓ (search/view trainers)
  ├─ Click trainer
  ↓
  TrainerDetails Modal
  ├─ Load trainer profile
  │  ├─ apiRequest('profile_get', {user_id: trainer.id})
  │  └─ setProfile(data)
  ├─ Display availability section
  │  └─ Map through availability object
  │     ├─ Show day name (capitalized)
  │     └─ Show time slots (comma-separated)
  │        OR "—" if empty
  └─ Client can book through BookingForm

──────────────────────────────────────────────────────────────────
```

---

## 7. State Management

### React Components Using Availability

| Component | State Variable | Purpose |
|-----------|---|---|
| AvailabilityEditor | `schedule` | Stores schedule with all slots |
| AvailabilityEditor | `initialPayload` | Tracks original state for change detection |
| AvailabilityEditor | `showValidationError` | Shows validation error message |
| AvailabilityEditor | `loading` | Shows loading spinner while fetching |
| AvailabilityEditor | `saving` | Shows loading spinner while saving |
| TrainerDashboard | `profileData.availability` | Displays availability summary |
| TrainerDashboard | `editingAvailability` | Controls AvailabilityEditor modal visibility |
| TrainerDetails | `profile.availability` | Client view of trainer's availability |

### TypeScript Types

```typescript
type DayKey = 
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

type Slot = { 
  id: string
  start: string
  end: string 
}

type ScheduleState = Record<DayKey, Slot[]>

type AvailabilityPayload = Record<DayKey, string[]>
```

---

## 8. API Service Layer

### File: `src/lib/api-service.ts`

**Wrapper Functions**:

```typescript
export async function getUserProfile(userId: string) {
  return apiRequest('select', {
    table: 'user_profiles',
    where: `user_id = '${userId}'`,
  })
}

export async function getTrainerProfile(userId: string) {
  return apiRequest('select', {
    table: 'user_profiles',
    where: `user_id = '${userId}'`,
  })
}

export async function updateUserProfile(userId: string, data: Record<string, any>) {
  const escapedUserId = userId.replace(/'/g, "''")
  const escapedWhere = `user_id = '${escapedUserId}'`
  return apiRequest('update', {
    table: 'user_profiles',
    data,
    where: escapedWhere,
  })
}
```

**Note**: Uses `select`/`update` generic endpoints, not `profile_get`/`profile_update`

### File: `src/lib/api.ts`

Main API request handler:

```typescript
export async function apiRequest(action: string, params: any, options: any = {}) {
  // Constructs request with authentication headers
  // POSTs to /api.php with JSON body
  // Returns parsed response
}
```

---

## 9. Issues & Observations

### ✅ Working Correctly

1. **Data Persistence**: Availability data is properly stored as JSON and retrieved correctly
2. **Validation**: Comprehensive validation prevents overlapping slots and invalid times
3. **Flexibility**: Parser handles multiple input formats for backwards compatibility
4. **User Experience**: 
   - Copy utilities for bulk operations
   - Clear visual feedback with validation errors
   - Toast notifications for success/failure
5. **Security**: Uses parameterized queries to prevent SQL injection

### ⚠️ Potential Areas of Concern

1. **Trainer Dashboard Display (Line 378)**
   ```typescript
   {typeof profileData.availability === 'object' 
     ? Object.keys(profileData.availability).join(', ') 
     : 'Check schedule'}
   ```
   - Shows only day names, not time slots
   - Doesn't display actual availability times
   - Could be confusing if trainer wants to review their schedule

2. **Availability Display Inconsistency**
   - **Trainer view**: Shows day names only
   - **Client view**: Shows full time slots per day
   - Trainer cannot review their actual availability from dashboard without opening the editor

3. **Timezone Handling**
   - No timezone information stored or displayed
   - Assumes all times are in same timezone (likely local to trainer's region)
   - No validation or warning if trainer and client are in different timezones

4. **Real-time Availability Update**
   - When trainer saves availability, clients don't see changes in real-time
   - Clients must refresh their view to see latest availability
   - No WebSocket or real-time sync implemented

5. **Booking Conflict Detection**
   - `BookingForm.tsx` doesn't validate against availability
   - Client can book times outside trainer's availability window
   - No server-side validation to prevent overbooking

6. **Backwards Compatibility**
   - Parser handles string format `"09:00-11:00"`
   - Parser handles object format `{start, end}` or `{from, to}`
   - But build function always outputs string format
   - Mixing old object data with new string data could cause issues

7. **Change Detection**
   - Uses JSON.stringify comparison (`hasChanges`)
   - If user makes change then reverts, still shows as changed
   - Could be fixed with deep equality check

---

## 10. Testing Recommendations

### Unit Tests Needed

1. **parseAvailability() function**
   - Test string format parsing: `"09:00-11:00"`
   - Test object format parsing: `{start: "09:00", end: "11:00"}`
   - Test edge cases: empty input, null, undefined, malformed JSON
   - Test timezone string inputs

2. **buildPayload() function**
   - Test filtering of invalid slots
   - Test sorting of slots
   - Test deduplication of overlapping slots

3. **validateSchedule() function**
   - Test overlap detection
   - Test invalid time detection
   - Test time comparison (end > start)
   - Test false positives for adjacent slots

4. **normalizeTime() function**
   - Test all accepted formats
   - Test boundary values (00:00, 23:59)
   - Test invalid inputs

### Integration Tests Needed

1. **Full trainer workflow**
   - Load profile → Edit → Save → Verify in database → Load again
   - Test update with no changes
   - Test adding/removing/modifying slots

2. **Client view**
   - Load trainer profile → Check availability display format
   - Test with empty availability
   - Test with complex schedule

3. **API endpoints**
   - Test `profile_get` returns correct JSON structure
   - Test `profile_update` persists changes
   - Test concurrent updates don't corrupt data
   - Test authorization checks

### Manual Testing Checklist

- [ ] Trainer can add/remove time slots
- [ ] Trainer can copy day to multiple days
- [ ] Trainer sees validation error for overlapping times
- [ ] Trainer sees validation error for invalid time format
- [ ] Trainer sees validation error for end time before start time
- [ ] Saved availability appears in client view
- [ ] Client sees "—" for unavailable days
- [ ] Client sees correct time slots for available days
- [ ] Change detection works (Save button disabled when no changes)
- [ ] Mobile layout works correctly
- [ ] Availability persists after logout/login

---

## 11. Recommendations for Improvement

### High Priority

1. **Booking Conflict Validation**
   - Add server-side validation in booking endpoint
   - Check if requested time falls within trainer's availability
   - Prevent overbooking of same time slot

2. **Trainer Availability Review**
   - Update dashboard to show actual time slots, not just day names
   - Add "View Schedule" quick action that shows week summary
   - Include time zone display

3. **Real-time Sync**
   - Add WebSocket support for availability changes
   - Notify clients when availability changes
   - Cache invalidation on availability update

### Medium Priority

1. **Timezone Support**
   - Store timezone in user profile
   - Display availability in client's local timezone
   - Add timezone selector in availability editor

2. **Better Change Detection**
   - Use deep equality comparison instead of JSON.stringify
   - Track which specific slots changed
   - Show preview of changes before saving

3. **Booking Slot Availability**
   - Show available time slots in BookingForm
   - Disable unavailable times
   - Add calendar view with color-coded availability

### Low Priority

1. **Export/Import Schedule**
   - Allow trainers to export their schedule
   - Support importing from calendar apps (Google Calendar, Outlook)
   - ICS file format support

2. **Recurring Availability**
   - Current system supports manual entry
   - Could add templates for common patterns
   - E.g., "9-5 weekdays" or "weekend warrior"

3. **Availability Analytics**
   - Show trainer how availability impacts bookings
   - Recommend optimal availability times
   - Track when most bookings occur

---

## 12. Summary Table

| Aspect | Details |
|--------|---------|
| **Storage** | JSON in `user_profiles.availability` column |
| **Format** | `{"day": ["HH:MM-HH:MM", ...], ...}` |
| **Trainer Edit** | AvailabilityEditor modal with validation |
| **Trainer View** | Dashboard shows day names only |
| **Client View** | TrainerDetails shows day + time slots |
| **API Get** | `profile_get` endpoint returns full profile |
| **API Save** | `profile_update` endpoint with JSON encoding |
| **Validation** | Client-side: overlap, time format, ranges |
| **Missing** | Server-side validation, timezone, real-time sync |
| **Issues** | Booking conflicts not prevented, trainer review limited |

---

## 13. Related Files

### Key Files
- `src/components/trainer/AvailabilityEditor.tsx` - Trainer editor (460 lines)
- `src/components/trainer/TrainerDashboard.tsx` - Trainer dashboard display
- `src/components/client/TrainerDetails.tsx` - Client view of availability
- `api.php` - Backend API endpoints (profile_get, profile_update)
- `scripts/migrate_user_profiles.php` - Database schema

### Support Files
- `src/lib/api-service.ts` - API service wrapper functions
- `src/lib/api.ts` - Core API request handler
- `src/contexts/AuthContext.tsx` - Authentication context

---

**End of Audit Report**
