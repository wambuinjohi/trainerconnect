# Multipart Media Upload Feature

## Overview

This document describes the multipart media upload feature implemented for `trainer.skatryk.co.ke/uploads`. Trainers can upload photos, videos, certifications, and other media files to showcase their expertise.

## Architecture

### Backend Components

#### 1. Upload Handler (`/public/api_upload.php`)
- **Endpoint**: `https://trainer.skatryk.co.ke/api_upload.php`
- **Method**: POST
- **Content-Type**: multipart/form-data

**Features:**
- Handles single and multiple file uploads
- Validates file size (max 50MB per file)
- Validates file extensions against whitelist
- Validates MIME types
- Generates unique filenames to prevent conflicts
- Stores files in `/public/uploads/` directory
- Returns JSON response with upload status

**Allowed File Types:**
- Images: jpg, jpeg, png, gif
- Documents: pdf, doc, docx, xls, xlsx
- Videos: mp4, avi, mov, webm
- Archives: zip, rar

**Response Format:**
```json
{
  "status": "success",
  "message": "Upload completed",
  "data": {
    "uploaded": [
      {
        "originalName": "photo.jpg",
        "fileName": "file_123abc_1234567890.jpg",
        "url": "/uploads/file_123abc_1234567890.jpg",
        "size": 2048576,
        "mimeType": "image/jpeg",
        "uploadedAt": "2025-01-20 10:30:45"
      }
    ],
    "errors": [],
    "count": 1
  }
}
```

### Frontend Components

#### 1. useFileUpload Hook (`src/hooks/use-file-upload.ts`)
Custom React hook for managing file uploads with validation and error handling.

**Usage:**
```typescript
const { upload, uploadFromInput, isLoading, error, uploadedFiles, clear } = useFileUpload({
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf'],
  onSuccess: (files) => console.log('Uploaded:', files),
  onError: (error) => console.error('Error:', error)
});

// Upload from file array
const handleFiles = async (files: File[]) => {
  await upload(files);
};

// Upload from input element
const handleInputChange = (input: HTMLInputElement) => {
  await uploadFromInput(input);
};

// Clear uploaded files
clear();
```

**Properties:**
- `upload(files: File[])` - Upload files from File array
- `uploadFromInput(input: HTMLInputElement | FileList)` - Upload from input element or FileList
- `isLoading` - Loading state
- `error` - Current error message
- `uploadedFiles` - Array of successfully uploaded files
- `clear()` - Clear the uploaded files list

#### 2. FileUpload Component (`src/components/ui/file-upload.tsx`)
Reusable drag-and-drop file upload UI component.

**Usage:**
```tsx
<FileUpload
  accept="image/jpeg,image/png"
  allowedExtensions={['jpg', 'jpeg', 'png']}
  multiple={true}
  onFilesSelected={(files) => console.log('Selected:', files)}
  disabled={false}
>
  <div>
    <p className="text-sm font-medium">Custom upload text</p>
  </div>
</FileUpload>
```

#### 3. UploadPreview Component (`src/components/ui/file-upload.tsx`)
Displays list of uploaded files with remove option.

**Usage:**
```tsx
<UploadPreview
  files={uploadedFiles}
  onRemove={(index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  }}
/>
```

#### 4. MediaUploadSection Component (`src/components/trainer/MediaUploadSection.tsx`)
Complete media upload section with upload area, preview, and guidelines.

**Usage:**
```tsx
<MediaUploadSection
  title="Upload Your Media"
  description="Add photos, videos, and certifications"
  uploadType="all" // 'photos' | 'videos' | 'certifications' | 'all'
  onFilesUploaded={(files) => console.log('Uploaded:', files)}
/>
```

### Integration Examples

#### Example 1: Basic File Upload Component
```tsx
import { FileUpload, UploadPreview } from '@/components/ui/file-upload';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useState } from 'react';

export function SimpleUpload() {
  const [files, setFiles] = useState([]);
  const { upload, uploadedFiles, isLoading } = useFileUpload({
    onSuccess: (uploaded) => setFiles(uploaded)
  });

  return (
    <div>
      <FileUpload 
        onFilesSelected={(files) => upload(files)}
      />
      <UploadPreview files={uploadedFiles} />
    </div>
  );
}
```

#### Example 2: Trainer Profile with Media
```tsx
import { TrainerProfileWithMedia } from '@/components/trainer/TrainerProfileEditor';

// Use in TrainerDashboard
{editingProfile && (
  <TrainerProfileWithMedia onClose={() => setEditingProfile(false)} />
)}
```

#### Example 3: Media Upload for Specific Type
```tsx
<MediaUploadSection
  title="Upload Certifications"
  description="Upload your training certifications and licenses"
  uploadType="certifications"
  onFilesUploaded={(files) => {
    // Save certification files to database
    saveCertifications(files);
  }}
/>
```

## API Integration

### Adding Uploads to Trainer Profile

Store uploaded file URLs in the trainer profile database:

```php
// In your database schema
ALTER TABLE trainer_profiles ADD COLUMN media_files JSON;

// Example structure
{
  "photos": [
    {
      "fileName": "file_123abc_1234567890.jpg",
      "url": "/uploads/file_123abc_1234567890.jpg",
      "type": "profile_photo"
    }
  ],
  "videos": [...],
  "certifications": [...]
}
```

### PHP Example for Saving Uploads
```php
// Save upload reference
$uploadData = $_POST; // from useFileUpload hook
$trainerId = $conn->real_escape_string($_POST['trainer_id']);

$sql = "UPDATE trainers SET media_files = ? WHERE id = ?";
// Use prepared statement with JSON data
```

## Security Considerations

1. **File Validation**
   - Server-side MIME type validation
   - File extension whitelist
   - Maximum file size limit (50MB)

2. **File Storage**
   - Files stored outside web root (recommended in production)
   - Unique filename generation prevents conflicts
   - No executable files allowed

3. **Access Control**
   - Implement authentication check before upload
   - Verify user owns the profile being updated
   - Consider adding download restrictions

4. **CORS Configuration**
   - Currently allows all origins (suitable for MVP)
   - In production, restrict to specific domains
   - Use proper CORS headers

## Configuration

### Adjust Upload Limits
Edit `public/api_upload.php`:
```php
// Maximum file size (default: 50MB)
$maxFileSize = 50 * 1024 * 1024;

// Allowed file extensions
$allowedExtensions = ['jpg', 'jpeg', 'png', ...];

// Allowed MIME types
$allowedMimeTypes = ['image/jpeg', ...];
```

### Change Upload Directory
The upload directory can be changed by modifying:
```php
$uploadDir = __DIR__ . '/uploads/';
```

## File Cleanup and Maintenance

### Manual File Management
```bash
# List all uploaded files
ls -la public/uploads/

# Remove old files (example: older than 30 days)
find public/uploads/ -type f -mtime +30 -delete

# Check disk usage
du -sh public/uploads/
```

### Automated Cleanup (Optional)
Consider implementing a scheduled job to:
1. Remove files deleted from database after grace period
2. Clean up orphaned files
3. Archive old files

## Troubleshooting

### Common Issues

**1. Upload Returns 413 (Payload Too Large)**
- Check PHP `upload_max_filesize` setting
- Check `post_max_size` setting
- Increase limits in php.ini or .htaccess

**2. Permission Denied When Saving**
- Ensure `/public/uploads/` directory exists
- Chmod directory to 755: `chmod 755 public/uploads/`
- Verify web server process has write permissions

**3. CORS Errors**
- The upload handler includes CORS headers
- Ensure requests are from the correct domain
- Check browser console for specific CORS error

**4. Files Not Persisting**
- Verify `/public/uploads/` is not in .gitignore
- Ensure files aren't being cleaned up by deployment
- Check file permissions after upload

## Testing

### Manual Testing
```bash
# Test upload with curl
curl -X POST \
  -F "files[]=@photo.jpg" \
  https://trainer.skatryk.co.ke/api_upload.php

# Test with multiple files
curl -X POST \
  -F "files[]=@photo1.jpg" \
  -F "files[]=@photo2.jpg" \
  https://trainer.skatryk.co.ke/api_upload.php
```

### Frontend Testing
```tsx
// Test useFileUpload hook
import { useFileUpload } from '@/hooks/use-file-upload';

function TestUpload() {
  const { upload } = useFileUpload();

  const handleTest = async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    await upload([file]);
  };

  return <button onClick={handleTest}>Test Upload</button>;
}
```

## Future Enhancements

1. **Progress Tracking**
   - Add upload progress percentage
   - Show individual file progress

2. **Image Processing**
   - Automatic image resizing
   - Thumbnail generation
   - Image optimization

3. **Virus Scanning**
   - Integrate ClamAV for file scanning
   - Quarantine suspicious files

4. **Cloud Storage**
   - Move uploads to S3/CloudFront
   - CDN integration for faster delivery
   - Automatic backup

5. **Database Integration**
   - Auto-save upload references to database
   - Associate uploads with trainer profile
   - Track upload history

6. **Admin Panel**
   - View all uploaded files
   - Delete problematic uploads
   - Monitor storage usage

## Support

For issues or questions about the upload feature, please contact the development team or refer to the main project documentation.
