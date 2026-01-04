import { Geolocation } from '@capacitor/geolocation';

// Check if running in Capacitor (native app)
function isCapacitorApp(): boolean {
  try {
    return typeof (window as any).Capacitor !== 'undefined';
  } catch {
    return false;
  }
}

export type ApproxLocation = {
  label?: string | null;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  ip?: string | null;
  source?: 'capacitor-geolocation' | 'geolocation' | 'ipapi' | 'unknown';
};

const clampCoord = (n: any) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  if (v > 90) return 90;
  if (v < -90) return -90;
  return v;
};

async function requestLocationPermission(): Promise<boolean> {
  try {
    const permission = await Geolocation.requestPermissions();
    return permission.location === 'granted';
  } catch (err) {
    console.warn('Permission request failed:', err);
    return false;
  }
}

async function checkLocationPermission(): Promise<boolean> {
  try {
    const permission = await Geolocation.checkPermissions();
    return permission.location === 'granted';
  } catch (err) {
    console.warn('Permission check failed:', err);
    return false;
  }
}

async function getLocationViaCapacitor(timeoutMs = 4000): Promise<ApproxLocation | null> {
  try {
    // Check and request permissions
    let hasPermission = await checkLocationPermission();
    if (!hasPermission) {
      hasPermission = await requestLocationPermission();
    }

    if (!hasPermission) {
      console.warn('Location permission not granted');
      return null;
    }

    const coordinates = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 60000,
    });

    const lat = clampCoord(coordinates.coords.latitude);
    const lng = clampCoord(coordinates.coords.longitude);

    if (lat != null && lng != null) {
      return {
        lat,
        lng,
        label: 'My location',
        source: 'capacitor-geolocation',
      };
    }
  } catch (err) {
    console.error('Capacitor geolocation error:', err);
    // Fall through to browser geolocation
  }

  return null;
}

function getLocationViaBrowser(timeoutMs = 4000): Promise<ApproxLocation | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      return resolve(null);
    }

    const t = window.setTimeout(() => resolve(null), timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(t);
        const lat = clampCoord(pos.coords.latitude);
        const lng = clampCoord(pos.coords.longitude);
        resolve({ lat, lng, label: 'My location', source: 'geolocation' });
      },
      () => {
        window.clearTimeout(t);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}

async function getLocationViaIPAPI(timeoutMs = 4000): Promise<ApproxLocation | null> {
  try {
    const ctrl = new AbortController();
    const abortT = window.setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch('https://ipapi.co/json/', { signal: ctrl.signal });
    window.clearTimeout(abortT);

    if (!res.ok) throw new Error('ipapi failed');

    const j = await res.json();
    const city = (j.city as string) || null;
    const region = (j.region as string) || null;
    const country = (j.country_name as string) || null;
    const ip = (j.ip as string) || null;
    const lat = j.latitude != null ? clampCoord(j.latitude) : null;
    const lng = j.longitude != null ? clampCoord(j.longitude) : null;
    const parts = [city, region, country].filter(Boolean) as string[];
    const label = parts.join(', ') || null;

    return { city, region, country, ip, lat, lng, label, source: 'ipapi' };
  } catch {
    return null;
  }
}

export async function getApproxLocation(timeoutMs = 4000): Promise<ApproxLocation | null> {
  try {
    if (typeof window === 'undefined') return null;

    // Try Capacitor geolocation first (native, more accurate)
    const capacitorLoc = await getLocationViaCapacitor(timeoutMs);
    if (capacitorLoc && capacitorLoc.lat != null && capacitorLoc.lng != null) {
      return capacitorLoc;
    }

    // Fall back to browser geolocation
    const browserLoc = await getLocationViaBrowser(timeoutMs);
    if (browserLoc && browserLoc.lat != null && browserLoc.lng != null) {
      return browserLoc;
    }

    // Final fallback to IP-based lookup
    return await getLocationViaIPAPI(timeoutMs);
  } catch {
    return null;
  }
}
