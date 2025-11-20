const DEFAULT_API_URL = 'https://trainer.skatryk.co.ke/api.php'

// Note: Using the unified /api.php at root level
// This consolidates both the root api.php and public/api.php into a single endpoint

export function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('api_url') || DEFAULT_API_URL
  }
  return DEFAULT_API_URL
}

export function setApiUrl(url: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('api_url', url)
  }
}

export const API_URL = DEFAULT_API_URL

export type ApiResponse<T = any> = {
  status: 'success' | 'error'
  message: string
  data?: T
  [key: string]: any
}

export async function apiRequest<T = any>(action: string, payload: Record<string, any> = {}, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> || {}) }
  const apiUrl = getApiUrl()
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload }),
    credentials: 'include',
    ...init,
  })
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null
  if (!json) throw new Error('Invalid API response')
  if (json.status === 'error' || !res.ok) throw new Error(json.message || `API error: ${res.status}`)
  return (json.data as T) ?? (json as unknown as T)
}

export function withAuth(token?: string): Record<string, string> {
  const t = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') || '' : '')
  return t ? { Authorization: `Bearer ${t}` } : {}
}
