/**
 * Image utility functions for handling image loading
 * Especially important for Android APK where relative paths don't work
 */

/**
 * Converts a relative image URL to absolute URL if needed
 * Also handles null/undefined cases gracefully
 */
export function getImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) {
    return null;
  }

  // If already absolute URL, return as-is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // If relative path starting with /, make it absolute
  if (imageUrl.startsWith('/')) {
    const baseUrl = getApiBaseUrl();
    return baseUrl + imageUrl;
  }

  // If just a filename, assume it's in /uploads/
  if (!imageUrl.includes('/')) {
    const baseUrl = getApiBaseUrl();
    return `${baseUrl}/uploads/${imageUrl}`;
  }

  // If it looks like a relative path, make it absolute
  const baseUrl = getApiBaseUrl();
  return baseUrl + (imageUrl.startsWith('/') ? '' : '/') + imageUrl;
}

/**
 * Gets the API base URL from localStorage or environment
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const apiUrl = localStorage.getItem('api_url') || import.meta.env.VITE_API_URL || 'https://trainer.skatryk.co.ke';
    // Remove trailing /api.php if present
    return apiUrl.replace(/\/api\.php$/, '');
  }
  return 'https://trainer.skatryk.co.ke';
}

/**
 * Image component props with fallback support
 */
export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string | null | undefined;
  fallbackSrc?: string;
  onImageError?: (error: Event) => void;
}

/**
 * Handles image errors with fallback image
 */
export function handleImageError(
  e: React.SyntheticEvent<HTMLImageElement>,
  fallbackSrc?: string
) {
  const img = e.currentTarget;
  if (fallbackSrc && img.src !== fallbackSrc) {
    img.src = fallbackSrc;
  } else {
    // If fallback also fails, hide the image
    img.style.display = 'none';
  }
}
