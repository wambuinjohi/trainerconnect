const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'https://trainer.skatryk.co.ke/api.php'

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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...withAuth(),
    ...(init.headers as Record<string, string> || {})
  }
  const apiUrl = getApiUrl()
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload }),
    ...init,
  })

  let json: ApiResponse<T> | null = null
  try {
    const text = await res.text()
    json = text ? JSON.parse(text) : null
  } catch (e) {
    console.error('Failed to parse API response:', e, res.status, res.statusText)
    throw new Error(`Invalid API response from ${apiUrl}: ${res.statusText}`)
  }

  if (!json) throw new Error('Empty API response')
  if (json.status === 'error' || !res.ok) throw new Error(json.message || `API error: ${res.status}`)
  return (json.data as T) ?? (json as unknown as T)
}

export function withAuth(token?: string): Record<string, string> {
  const t = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') || '' : '')
  return t ? { Authorization: `Bearer ${t}` } : {}
}
