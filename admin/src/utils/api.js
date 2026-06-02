export const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? '/api' : 'http://127.0.0.1:8787/api')
const ENABLE_API_FALLBACK = import.meta.env.VITE_ENABLE_API_FALLBACK === 'true' || !import.meta.env.PROD
export const ADMIN_AUTH_STORAGE_KEY = 'tixiaozhu_admin_token'

const resolveFallback = (fallback) => {
  if (ENABLE_API_FALLBACK) return typeof fallback === 'function' ? fallback() : fallback
  return null
}

export const getAdminToken = () => localStorage.getItem(ADMIN_AUTH_STORAGE_KEY) || ''
export const setAdminToken = (token) => {
  if (token) localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, token)
}
export const clearAdminToken = () => {
  localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY)
}

const buildHeaders = (headers = {}) => {
  const token = getAdminToken()
  return token
    ? { ...headers, Authorization: `Bearer ${token}` }
    : headers
}

export const openAuthorizedResource = async (path) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: buildHeaders(),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const blob = await response.blob()
  const objectUrl = window.URL.createObjectURL(blob)
  window.open(objectUrl, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60 * 1000)
}

export const apiGet = async (path, fallback) => {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: buildHeaders(),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    return payload.data
  } catch (error) {
    console.warn(`API fallback for ${path}:`, error.message)
    return resolveFallback(fallback)
  }
}

export const apiPost = async (path, body, fallback) => {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    return payload.data
  } catch (error) {
    console.warn(`API fallback for ${path}:`, error.message)
    return resolveFallback(fallback)
  }
}

export const apiPatch = async (path, body, fallback) => {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    return payload.data
  } catch (error) {
    console.warn(`API fallback for ${path}:`, error.message)
    return resolveFallback(fallback)
  }
}
