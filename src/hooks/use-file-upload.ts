import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { getApiBaseUrl } from '@/lib/api-config';

interface UploadedFile {
  originalName: string;
  fileName: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

interface UploadResponse {
  status: string;
  message: string;
  data?: {
    uploaded: UploadedFile[];
    errors: string[];
    count: number;
  };
}

interface UseFileUploadOptions {
  maxFileSize?: number; // in bytes, default 50MB
  allowedExtensions?: string[];
  onSuccess?: (files: UploadedFile[]) => void;
  onError?: (error: string) => void;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const {
    maxFileSize = 50 * 1024 * 1024, // 50MB
    allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'mp4', 'avi', 'mov', 'webm', 'zip', 'rar'],
    onSuccess,
    onError
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const validateFiles = useCallback((files: File[]): { valid: File[], errors: string[] } => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach((file) => {
      // Check file size
      if (file.size > maxFileSize) {
        errors.push(`${file.name}: File size exceeds ${maxFileSize / 1024 / 1024}MB limit`);
        return;
      }

      // Check file extension
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (!fileExt || !allowedExtensions.includes(fileExt)) {
        errors.push(`${file.name}: File type not allowed`);
        return;
      }

      validFiles.push(file);
    });

    return { valid: validFiles, errors };
  }, [maxFileSize, allowedExtensions]);

  const upload = useCallback(async (files: File[]) => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate files
      const { valid: validFiles, errors: validationErrors } = validateFiles(files);

      if (validationErrors.length > 0) {
        const errorMsg = validationErrors.join('; ');
        setError(errorMsg);
        onError?.(errorMsg);
        toast.error(errorMsg);
        setIsLoading(false);
        return;
      }

      if (validFiles.length === 0) {
        const msg = 'No valid files to upload';
        setError(msg);
        onError?.(msg);
        toast.error(msg);
        setIsLoading(false);
        return;
      }

      // Create FormData
      const formData = new FormData();
      validFiles.forEach((file) => {
        formData.append('files[]', file);
      });

      // Upload files
      const apiBaseUrl = getApiBaseUrl();
      const apiUrl = apiBaseUrl.endsWith('/api.php') ? apiBaseUrl : (apiBaseUrl.endsWith('/') ? apiBaseUrl + 'api.php' : apiBaseUrl + '/api.php');
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const data: UploadResponse = await response.json();

      if (data.status === 'error') {
        const errorMsg = data.message;
        setError(errorMsg);
        onError?.(errorMsg);
        toast.error(errorMsg);
      } else {
        // Use the URLs returned by the API (they should be full URLs now)
        const uploaded = (data.data?.uploaded || []);

        // Fallback: if URLs are relative, prepend the upload base URL
        const normalizedUploaded = uploaded.map((file: UploadedFile) => ({
          ...file,
          url: file.url.startsWith('http')
            ? file.url
            : `https://trainercoachconnect.com/uploads/${file.url.split('/').pop()}`
        }));

        setUploadedFiles(prev => [...prev, ...normalizedUploaded]);
        onSuccess?.(normalizedUploaded);
        
        const successMsg = data.data?.count === 1 
          ? '1 file uploaded successfully'
          : `${data.data?.count} files uploaded successfully`;
        toast.success(successMsg);

        // Show any warnings for partial failures
        if (data.data?.errors && data.data.errors.length > 0) {
          toast.warning(`${data.data.errors.length} file(s) failed to upload`);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMsg);
      onError?.(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [validateFiles, onSuccess, onError]);

  const uploadFromInput = useCallback(async (input: HTMLInputElement | FileList) => {
    const files = input instanceof HTMLInputElement ? input.files : input;
    if (!files || files.length === 0) {
      toast.error('No files selected');
      return;
    }

    const fileArray = Array.from(files);
    await upload(fileArray);
  }, [upload]);

  const clear = useCallback(() => {
    setUploadedFiles([]);
    setError(null);
  }, []);

  return {
    upload,
    uploadFromInput,
    isLoading,
    error,
    uploadedFiles,
    clear
  };
}
