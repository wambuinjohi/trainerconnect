import { getApiUrl as getApiUrlFromConfig, getApiBaseUrl } from './api-config'

// Note: Using the unified /api.php at root level
// This consolidates both the root api.php and public/api.php into a single endpoint
// Fallback to /api.php is automatically used if primary endpoint fails
// Supports both local Apache servers and remote Capacitor deployments

const FALLBACK_API_URLS = [
  'https://trainer.skatryk.co.ke/api.php',
  '/api.php',
]

let lastSuccessfulApiUrl: string | null = null

export function getApiUrl(): string {
  const url = getApiUrlFromConfig()
  return url
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

export const API_URL = getApiUrl()

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
    // Try fallback URLs if primary fails
    for (const fallbackUrl of FALLBACK_API_URLS) {
      if (apiUrl === fallbackUrl) continue // Skip if we already tried this

      console.warn(`Primary API endpoint failed (${apiUrl}), trying fallback (${fallbackUrl})`)
      try {
        const response = await apiRequest_Internal<T>(fallbackUrl, action, payload, headers, init)
        lastSuccessfulApiUrl = fallbackUrl
        console.log(`Fallback API endpoint successful (${fallbackUrl})`)
        return response
      } catch (fallbackError) {
        console.warn(`Fallback ${fallbackUrl} also failed`)
        continue
      }
    }

    // All endpoints failed, throw the original error
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
