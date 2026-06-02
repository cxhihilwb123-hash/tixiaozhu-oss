import pg from 'pg'
import { buildCommercialLaunchReadinessReport } from '../src/commercial-launch-readiness.js'
import { loadStore, STORE_DATABASE_URL } from '../src/store-persistence.js'

const checks = []
const pingExternals = process.env.PREFLIGHT_PING_EXTERNALS === 'true'
const requestTimeoutMs = Number(process.env.PREFLIGHT_TIMEOUT_MS || 5000)

const hasValue = (value) => String(value || '').trim().length > 0
const placeholderPattern = /(replace[-_ ]?with|example\.com|your[-_ ]?|changeme|placeholder|dummy|fake)/i
const sensitiveEnvNames = [
  'DATABASE_URL',
  'TIXIAOZHU_DATABASE_URL',
  'ADMIN_PASSWORD',
  'ADMIN_PASSWORD_HASH',
  'ADMIN_SESSION_SECRET',
  'STUDENT_SESSION_SECRET',
  'AI_API_BASE',
  'AI_API_KEY',
  'AI_MODEL',
  'OCR_API_URL',
  'BLOB_READ_WRITE_TOKEN',
  'OBJECT_STORAGE_BUCKET',
  'OBJECT_STORAGE_ENDPOINT',
  'OBJECT_STORAGE_ACCESS_KEY',
  'OBJECT_STORAGE_SECRET_KEY',
  'S3_BUCKET',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'COS_BUCKET',
  'COS_ENDPOINT',
  'COS_SECRET_ID',
  'COS_SECRET_KEY',
  'SENTRY_DSN',
  'LOG_DRAIN_URL',
  'OBSERVABILITY_ENDPOINT',
]

const check = async (name, fn) => {
  try {
    const detail = await fn()
    checks.push({ name, ok: true, ...(detail ? { detail } : {}) })
  } catch (error) {
    checks.push({ name, ok: false, error: error.message })
  }
}

const requireEnv = (name) => {
  if (!hasValue(process.env[name])) throw new Error(`${name} is required`)
  return process.env[name]
}

const assertNotPlaceholder = (name, value) => {
  if (placeholderPattern.test(String(value || ''))) {
    throw new Error(`${name} still looks like a placeholder value`)
  }
}

const requireRealEnv = (name) => {
  const value = requireEnv(name)
  assertNotPlaceholder(name, value)
  return value
}

const validateUrl = (name, value) => {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid URL`)
  }
  assertNotPlaceholder(name, value)
  return url
}

const pingUrl = async (name, value, headers = {}) => {
  const url = validateUrl(name, value)
  if (!pingExternals) return { url: url.origin, pinged: false }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs)
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers,
      signal: controller.signal,
    })
    if (response.status >= 500) {
      throw new Error(`${name} returned HTTP ${response.status}`)
    }
    return { url: url.origin, pinged: true, status: response.status }
  } finally {
    clearTimeout(timer)
  }
}

await check('production configuration contains no placeholders', async () => {
  const placeholderNames = sensitiveEnvNames
    .filter(name => hasValue(process.env[name]) && placeholderPattern.test(String(process.env[name])))
  if (placeholderNames.length > 0) {
    throw new Error(`replace placeholder env values before launch: ${placeholderNames.join(', ')}`)
  }
  return { inspected: sensitiveEnvNames.filter(name => hasValue(process.env[name])).length }
})

await check('commercial launch readiness gate', async () => {
  const store = await loadStore()
  const report = buildCommercialLaunchReadinessReport(store, process.env)
  if (report.readiness !== 'launch_ready') {
    throw new Error(`commercial launch readiness is ${report.readiness} with ${report.issueCount} issue(s)`)
  }
  return {
    readiness: report.readiness,
    issueCount: report.issueCount,
    deferredCount: report.deferredCount,
  }
})

await check('postgres connection and store table', async () => {
  if (!STORE_DATABASE_URL) throw new Error('DATABASE_URL / TIXIAOZHU_DATABASE_URL is required')
  assertNotPlaceholder('DATABASE_URL / TIXIAOZHU_DATABASE_URL', STORE_DATABASE_URL)
  const pool = new pg.Pool({
    connectionString: STORE_DATABASE_URL,
    max: 1,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: requestTimeoutMs,
  })
  try {
    const result = await pool.query('SELECT NOW() as now')
    return { connected: true, now: result.rows[0]?.now }
  } finally {
    await pool.end()
  }
})

await check('public origins are explicit', async () => {
  const frontend = validateUrl('FRONTEND_URL', requireRealEnv('FRONTEND_URL'))
  const admin = validateUrl('ADMIN_URL', requireRealEnv('ADMIN_URL'))
  const cors = requireEnv('CORS_ALLOW_ORIGIN')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
  if (!cors.includes(frontend.origin) || !cors.includes(admin.origin)) {
    throw new Error('CORS_ALLOW_ORIGIN must include both FRONTEND_URL and ADMIN_URL origins')
  }
  return { frontend: frontend.origin, admin: admin.origin }
})

await check('admin and student secrets are production grade', async () => {
  const adminSecret = requireRealEnv('ADMIN_SESSION_SECRET')
  const studentSecret = requireRealEnv('STUDENT_SESSION_SECRET')
  const adminPasswordHash = requireRealEnv('ADMIN_PASSWORD_HASH')
  if (adminSecret.length < 48) throw new Error('ADMIN_SESSION_SECRET should be at least 48 characters')
  if (studentSecret.length < 48) throw new Error('STUDENT_SESSION_SECRET should be at least 48 characters')
  if (adminSecret === studentSecret) throw new Error('ADMIN_SESSION_SECRET and STUDENT_SESSION_SECRET must be different')
  if (!adminPasswordHash.startsWith('$2')) throw new Error('ADMIN_PASSWORD_HASH must be a bcrypt hash')
  if (hasValue(process.env.ADMIN_PASSWORD)) throw new Error('ADMIN_PASSWORD must not be used in production; use ADMIN_PASSWORD_HASH')
  if (process.env.REQUIRE_STUDENT_AUTH !== 'true') throw new Error('REQUIRE_STUDENT_AUTH must be true')
  return { requireStudentAuth: true }
})

await check('payment is safely deferred', async () => {
  if (process.env.PAYMENT_LAUNCH_STRATEGY !== 'deferred') {
    throw new Error('PAYMENT_LAUNCH_STRATEGY must be deferred for this release')
  }
  return { strategy: 'deferred' }
})

await check('AI service configuration', async () => {
  requireRealEnv('AI_API_KEY')
  requireRealEnv('AI_MODEL')
  return pingUrl('AI_API_BASE', requireRealEnv('AI_API_BASE'), {
    Authorization: `Bearer ${process.env.AI_API_KEY}`,
  })
})

await check('OCR launch strategy', async () => {
  const explicitStrategy = String(process.env.OCR_LAUNCH_STRATEGY || process.env.RECOGNITION_LAUNCH_STRATEGY || '').trim()
  const strategy = explicitStrategy || (hasValue(process.env.OCR_API_URL) ? 'production' : 'deferred')
  if (!['production', 'deferred'].includes(strategy)) {
    throw new Error('OCR_LAUNCH_STRATEGY must be production or deferred')
  }
  if (strategy === 'deferred') {
    return { strategy, configured: hasValue(process.env.OCR_API_URL), launchScope: 'manual_input_only' }
  }
  return { strategy, ...(await pingUrl('OCR_API_URL', requireRealEnv('OCR_API_URL'))) }
})

await check('object storage configuration', async () => {
  if (hasValue(process.env.BLOB_READ_WRITE_TOKEN)) {
    assertNotPlaceholder('BLOB_READ_WRITE_TOKEN', process.env.BLOB_READ_WRITE_TOKEN)
    return { provider: 'vercel_blob', tokenConfigured: true }
  }

  const bucket = process.env.OBJECT_STORAGE_BUCKET || process.env.S3_BUCKET || process.env.COS_BUCKET
  if (!hasValue(bucket)) throw new Error('OBJECT_STORAGE_BUCKET / S3_BUCKET / COS_BUCKET is required')
  assertNotPlaceholder('object storage bucket', bucket)
  if (!hasValue(process.env.OBJECT_STORAGE_ENDPOINT) && !hasValue(process.env.S3_ENDPOINT) && !hasValue(process.env.COS_ENDPOINT)) {
    throw new Error('OBJECT_STORAGE_ENDPOINT / S3_ENDPOINT / COS_ENDPOINT is required')
  }
  if (!hasValue(process.env.OBJECT_STORAGE_ACCESS_KEY) && !hasValue(process.env.S3_ACCESS_KEY_ID) && !hasValue(process.env.COS_SECRET_ID)) {
    throw new Error('object storage access key is required')
  }
  if (!hasValue(process.env.OBJECT_STORAGE_SECRET_KEY) && !hasValue(process.env.S3_SECRET_ACCESS_KEY) && !hasValue(process.env.COS_SECRET_KEY)) {
    throw new Error('object storage secret key is required')
  }
  const endpoint = process.env.OBJECT_STORAGE_ENDPOINT || process.env.S3_ENDPOINT || process.env.COS_ENDPOINT
  const accessKey = process.env.OBJECT_STORAGE_ACCESS_KEY || process.env.S3_ACCESS_KEY_ID || process.env.COS_SECRET_ID
  const secretKey = process.env.OBJECT_STORAGE_SECRET_KEY || process.env.S3_SECRET_ACCESS_KEY || process.env.COS_SECRET_KEY
  assertNotPlaceholder('object storage access key', accessKey)
  assertNotPlaceholder('object storage secret key', secretKey)
  const ping = await pingUrl('OBJECT_STORAGE_ENDPOINT', endpoint)
  return { bucket, ...ping }
})

await check('monitoring configuration', async () => {
  if (process.env.VERCEL_ALERTS_ENABLED === 'true') {
    return { provider: 'vercel_alerts' }
  }
  if (hasValue(process.env.SENTRY_DSN)) {
    const dsn = validateUrl('SENTRY_DSN', process.env.SENTRY_DSN)
    return { provider: 'sentry', host: dsn.host }
  }
  if (hasValue(process.env.LOG_DRAIN_URL)) {
    return { provider: 'log_drain', ...(await pingUrl('LOG_DRAIN_URL', process.env.LOG_DRAIN_URL)) }
  }
  if (hasValue(process.env.OBSERVABILITY_ENDPOINT)) {
    return { provider: 'observability', ...(await pingUrl('OBSERVABILITY_ENDPOINT', process.env.OBSERVABILITY_ENDPOINT)) }
  }
  throw new Error('SENTRY_DSN / LOG_DRAIN_URL / OBSERVABILITY_ENDPOINT is required')
})

const failed = checks.filter(item => !item.ok)

console.log(JSON.stringify({
  ok: failed.length === 0,
  pingExternals,
  checks,
}, null, 2))

if (failed.length > 0) process.exit(1)
