# Soft Delete & Pagination Implementation for Admin Issues and Disputes

## Overview
This document outlines the implementation of soft delete functionality and pagination for admin issues and disputes management.

## Changes Made

### 1. Database Migration
**File**: `scripts/migrate_soft_delete_for_issues.php`

A new migration script has been created to add soft delete support to the `reported_issues` table:
- Adds `deleted_at` TIMESTAMP column (nullable)
- Creates index on `deleted_at` for query performance
- Can be run with: `php scripts/migrate_soft_delete_for_issues.php`

**When to run**:
```bash
php scripts/migrate_soft_delete_for_issues.php
```

### 2. API Backend Changes
**File**: `api.php` (lines 435-500)

**SELECT Handler Updates**:
- Automatically filters out soft-deleted records from `reported_issues` table
- Adds support for OFFSET pagination parameter
- When selecting from `reported_issues`, queries now include `AND deleted_at IS NULL`
- Supports pagination via `limit` and `offset` parameters

**Soft Delete Behavior**:
- Records are never permanently deleted
- Soft-deleted records are excluded from all SELECT queries
- Can be restored if needed in the future

### 3. API Service Functions
**File**: `src/lib/api-service.ts`

#### New Functions Added:

**`getIssuesWithPagination(options)`**
- Supports pagination with `page` and `pageSize` parameters
- Supports filtering by status, userId, trainerId
- Supports text search via `searchQuery` parameter
- Returns paginated results with total count
- Parameters:
  - `page`: 1-based page number (default: 1)
  - `pageSize`: Items per page, max 100 (default: 20)
  - `status`: Filter by status (optional)
  - `userId`: Filter by user ID (optional)
  - `trainerId`: Filter by trainer ID (optional)
  - `searchQuery`: Search in description/complaint_type/title (optional)

**`softDeleteIssue(issueId)`**
- Sets the `deleted_at` timestamp to current time
- Soft deletes an issue without removing data

**`restoreIssue(issueId)`**
- Sets `deleted_at` to NULL
- Restores a previously soft-deleted issue

### 4. Admin Dashboard UI Updates
**File**: `src/components/admin/AdminDashboard.tsx`

#### State Variables Added:
```typescript
const [issuePage, setIssuePage] = useState(1)
const [issuePageSize, setIssuePageSize] = useState(20)
const [issueTotalCount, setIssueTotalCount] = useState(0)
const [loadingIssues, setLoadingIssues] = useState(false)
```

#### Functions Added:
- `loadIssuesPage(page)`: Load a specific page of issues with current filters
- `softDeleteIssue(issueId)`: Soft delete an issue (with confirmation)
- `restoreIssue(issueId)`: Restore a soft-deleted issue

#### UI Changes:
- **Issues Section** (`renderIssues`):
  - Added soft delete button (trash icon) to each issue card
  - Added pagination controls at the bottom (Previous/Next buttons)
  - Shows current page and total count
  - Shows loading state during pagination

- **Disputes Section** (`renderDisputes`):
  - Added soft delete button to each dispute card
  - Uses the same soft delete functionality

#### Pagination Controls:
- Previous/Next buttons (disabled at boundaries)
- Shows "Page X of Y (total Z)"
- Auto-disables buttons during loading

## Feature Usage

### For Admins:

#### Deleting Issues/Disputes
1. Click the "Delete" button (trash icon) on any issue or dispute
2. Confirm the deletion dialog
3. Issue is soft-deleted and no longer visible
4. Data is preserved in database for audit trail

#### Viewing Issues with Pagination
1. Issues are displayed with pagination (default 20 per page)
2. Use Previous/Next buttons to navigate pages
3. Total count is displayed at the top

#### Restoring Issues (Future Feature)
- Can be implemented by adding an admin interface to view deleted items
- Use the `restoreIssue()` function to undelete

## API Endpoints

### SELECT Query with Soft Delete Filter
```json
{
  "action": "select",
  "table": "reported_issues",
  "where": "1=1",
  "order": "created_at DESC",
  "limit": 20,
  "offset": 0,
  "count": "exact"
}
```

The API automatically adds `AND deleted_at IS NULL` to the WHERE clause for the `reported_issues` table.

### Soft Delete
```json
{
  "action": "update",
  "table": "reported_issues",
  "data": { "deleted_at": "2024-01-15T10:30:00.000Z" },
  "where": "id = 'issue-123'"
}
```

### Restore
```json
{
  "action": "update",
  "table": "reported_issues",
  "data": { "deleted_at": null },
  "where": "id = 'issue-123'"
}
```

## Database Schema

### reported_issues Table
```sql
ALTER TABLE `reported_issues` 
ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Soft delete timestamp' AFTER `updated_at`;

CREATE INDEX `idx_deleted_at` ON `reported_issues` (`deleted_at`);
```

## Testing Checklist

- [ ] Run migration script: `php scripts/migrate_soft_delete_for_issues.php`
- [ ] Verify `deleted_at` column exists in database
- [ ] Login to admin dashboard
- [ ] Test pagination:
  - [ ] View issues page
  - [ ] Create enough test issues (>20) to see pagination
  - [ ] Click Next button and verify next page loads
  - [ ] Click Previous button and verify previous page loads
  - [ ] Verify page count displays correctly
- [ ] Test soft delete:
  - [ ] Click delete button on an issue
  - [ ] Confirm deletion dialog
  - [ ] Verify issue disappears from list
  - [ ] Check database: `SELECT * FROM reported_issues WHERE deleted_at IS NOT NULL`
  - [ ] Verify deleted issue is in database with deleted_at timestamp
- [ ] Test disputes:
  - [ ] Verify same soft delete functionality works for disputes
- [ ] Test filters:
  - [ ] Filter by status
  - [ ] Search by text
  - [ ] Pagination should work with filters

## Performance Considerations

1. **Index on deleted_at**: Created for efficient filtering of non-deleted records
2. **Page size limit**: Capped at 100 items per page to prevent memory issues
3. **Count query**: Uses EXACT count for accurate pagination
4. **Lazy loading**: Issues are loaded on-demand by page

## Future Enhancements

1. **Trash/Recycle Bin**: Create a view to show deleted items with restore functionality
2. **Bulk Operations**: Add ability to soft delete multiple items at once
3. **Permanent Delete**: Add admin feature to permanently delete old soft-deleted records after retention period
4. **Audit Log**: Track who deleted what and when
5. **Soft Delete for Disputes**: Apply same soft delete pattern to dispute management

## Troubleshooting

### Issues not loading
- Verify migration script was run
- Check database has `deleted_at` column
- Check browser console for API errors

### Pagination buttons disabled
- Page size defaults to 20 items
- If fewer than 20 items, pagination won't show
- Create more test issues to test pagination

### Soft delete not working
- Verify API endpoint is responding
- Check network tab in browser DevTools
- Ensure user has admin privileges

## Files Modified

1. `scripts/migrate_soft_delete_for_issues.php` - NEW
2. `api.php` - Updated SELECT handler
3. `src/lib/api-service.ts` - Added new functions
4. `src/components/admin/AdminDashboard.tsx` - Updated UI with pagination and soft delete

## Notes

- Soft deletes preserve data integrity and allow for audit trails
- All soft-deleted records remain in the database with timestamps
- Future versions can add a "trash" feature to restore deleted items
- The implementation follows existing patterns in the codebase
