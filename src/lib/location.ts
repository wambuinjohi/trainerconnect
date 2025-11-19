export type ApproxLocation = {
  label?: string | null;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  ip?: string | null;
  source?: 'geolocation' | 'ipapi' | 'unknown';
};

const clampCoord = (n: any) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  if (v > 90) return 90;
  if (v < -90) return -90;
  return v;
};

export async function getApproxLocation(timeoutMs = 4000): Promise<ApproxLocation | null> {
  try {
    if (typeof window === 'undefined') return null;

    const geoPromise = new Promise<ApproxLocation | null>((resolve) => {
      if (!('geolocation' in navigator)) return resolve(null);
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
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 }
      );
    });

    const geo = await geoPromise;
    if (geo && (geo.lat != null && geo.lng != null)) return geo;

    // Fallback to IP-based lookup (public endpoint)
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
    } catch {}

    return null;
  } catch {
    return null;
  }
}
