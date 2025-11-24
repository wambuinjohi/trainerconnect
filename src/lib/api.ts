const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'https://trainer.skatryk.co.ke/api.php'
const FALLBACK_API_URL = '/api.php'

// Note: Using the unified /api.php at root level
// This consolidates both the root api.php and public/api.php into a single endpoint
// Fallback to /api.php is automatically used if primary endpoint fails

let lastSuccessfulApiUrl: string | null = null

export function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('api_url') || DEFAULT_API_URL
  }
  return DEFAULT_API_URL
}

export function setApiUrl(url: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('api_url', url)
    lastSuccessfulApiUrl = null // Reset on manual change
  }
}

export function getLastSuccessfulApiUrl(): string | null {
  return lastSuccessfulApiUrl
}

export const API_URL = DEFAULT_API_URL

export type ApiResponse<T = any> = {
  status: 'success' | 'error'
  message: string
  data?: T
  [key: string]: any
}

export async function apiRequest<T = any>(action: string, payload: Record<string, any> = {}, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...withAuth(),
    ...(init.headers as Record<string, string> || {})
  }

  // Try primary API URL first
  let apiUrl = getApiUrl()

  // If we have a previously successful URL in this session, prefer it
  if (lastSuccessfulApiUrl) {
    apiUrl = lastSuccessfulApiUrl
  }

  try {
    const response = await apiRequest_Internal<T>(apiUrl, action, payload, headers, init)
    lastSuccessfulApiUrl = apiUrl
    return response
  } catch (primaryError) {
    // If primary URL fails and we haven't already tried the fallback
    if (apiUrl !== FALLBACK_API_URL) {
      console.warn(`Primary API endpoint failed (${apiUrl}), trying fallback (${FALLBACK_API_URL})`)
      try {
        const response = await apiRequest_Internal<T>(FALLBACK_API_URL, action, payload, headers, init)
        lastSuccessfulApiUrl = FALLBACK_API_URL
        console.log(`Fallback API endpoint successful (${FALLBACK_API_URL})`)
        return response
      } catch (fallbackError) {
        // Both failed, throw the original error
        throw primaryError
      }
    }
    throw primaryError
  }
}

async function apiRequest_Internal<T = any>(
  apiUrl: string,
  action: string,
  payload: Record<string, any>,
  headers: Record<string, string>,
  init: RequestInit
): Promise<T> {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload }),
    ...init,
  })

  let json: ApiResponse<T> | null = null
  try {
    // Clone the response to safely read the body without consuming the original
    const clonedRes = res.clone()
    const text = await clonedRes.text()
    if (!text) {
      throw new Error('Empty response body')
    }
    json = JSON.parse(text)
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Failed to parse API response:', errorMsg, 'Status:', res.status, 'StatusText:', res.statusText)
    throw new Error(`Invalid API response from ${apiUrl}: ${errorMsg}`)
  }

  if (!json) throw new Error('Empty API response')
  if (json.status === 'error') throw new Error(json.message || `API error: ${res.status}`)
  if (!res.ok && json.status !== 'success') throw new Error(json.message || `API error: ${res.status}`)
  return (json.data as T) ?? (json as unknown as T)
}

export function withAuth(token?: string): Record<string, string> {
  const t = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') || '' : '')
  return t ? { Authorization: `Bearer ${t}` } : {}
}
