export const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? '/api' : 'http://127.0.0.1:8787/api')
const ENABLE_API_FALLBACK = import.meta.env.VITE_ENABLE_API_FALLBACK === 'true' || !import.meta.env.PROD

const resolveFallback = (fallback) => {
  if (ENABLE_API_FALLBACK) return typeof fallback === 'function' ? fallback() : fallback
  return null
}

const getStoredAuthToken = () => {
  try {
    const raw = window.localStorage.getItem('tixiaozhu-user')
    const payload = raw ? JSON.parse(raw) : null
    return payload?.state?.authToken || ''
  } catch {
    return ''
  }
}

export const authHeaders = (headers = {}) => {
  const token = getStoredAuthToken()
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers
}

export const openAuthorizedResource = async (path) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60 * 1000)
}

export const apiGet = async (path, fallback) => {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: authHeaders(),
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
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    })
    if (response.status === 401 || response.status === 403) return null
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
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    })
    if (response.status === 401 || response.status === 403) return null
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    return payload.data
  } catch (error) {
    console.warn(`API fallback for ${path}:`, error.message)
    return resolveFallback(fallback)
  }
}
