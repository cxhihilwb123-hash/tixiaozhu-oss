const hasValue = (value) => String(value || '').trim().length > 0

const safeOrigin = (value) => {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export const resolveObjectStorageConfig = (env = process.env) => {
  if (hasValue(env.BLOB_READ_WRITE_TOKEN)) {
    return {
      configured: true,
      provider: 'vercel_blob',
    }
  }

  const bucket = env.OBJECT_STORAGE_BUCKET || env.S3_BUCKET || env.COS_BUCKET || ''
  const endpoint = env.OBJECT_STORAGE_ENDPOINT || env.S3_ENDPOINT || env.COS_ENDPOINT || ''
  const accessKey = env.OBJECT_STORAGE_ACCESS_KEY || env.S3_ACCESS_KEY_ID || env.COS_SECRET_ID || ''
  const secretKey = env.OBJECT_STORAGE_SECRET_KEY || env.S3_SECRET_ACCESS_KEY || env.COS_SECRET_KEY || ''

  return {
    configured: hasValue(bucket) && hasValue(endpoint) && hasValue(accessKey) && hasValue(secretKey),
    provider: hasValue(bucket) ? 's3_compatible' : 'none',
    bucket: hasValue(bucket) ? bucket : null,
    endpointOrigin: hasValue(endpoint) ? safeOrigin(endpoint) : null,
  }
}

export const resolveMonitoringConfig = (env = process.env) => {
  if (env.VERCEL_ALERTS_ENABLED === 'true') {
    return {
      configured: true,
      provider: 'vercel_alerts',
    }
  }

  if (hasValue(env.SENTRY_DSN)) {
    return {
      configured: true,
      provider: 'sentry',
      endpointOrigin: safeOrigin(env.SENTRY_DSN),
    }
  }

  if (hasValue(env.LOG_DRAIN_URL)) {
    return {
      configured: true,
      provider: 'log_drain',
      endpoint: env.LOG_DRAIN_URL,
      endpointOrigin: safeOrigin(env.LOG_DRAIN_URL),
    }
  }

  if (hasValue(env.OBSERVABILITY_ENDPOINT)) {
    return {
      configured: true,
      provider: 'observability',
      endpoint: env.OBSERVABILITY_ENDPOINT,
      endpointOrigin: safeOrigin(env.OBSERVABILITY_ENDPOINT),
    }
  }

  return {
    configured: false,
    provider: 'none',
  }
}

export const buildLaunchIntegrationStatus = (env = process.env) => ({
  objectStorage: resolveObjectStorageConfig(env),
  monitoring: resolveMonitoringConfig(env),
})

export const emitMonitoringEvent = (event, env = process.env) => {
  const monitoring = resolveMonitoringConfig(env)
  if (!['log_drain', 'observability'].includes(monitoring.provider) || !monitoring.endpoint) return

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(env.MONITORING_EVENT_TIMEOUT_MS || 1500))
  fetch(monitoring.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service: 'tixiaozhu-backend',
      environment: env.TIXIAOZHU_ENV || env.NODE_ENV || 'development',
      time: new Date().toISOString(),
      ...event,
    }),
    signal: controller.signal,
  })
    .catch(() => {})
    .finally(() => clearTimeout(timer))
}
