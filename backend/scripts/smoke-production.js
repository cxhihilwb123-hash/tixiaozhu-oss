const apiBase = (process.env.SMOKE_API_BASE || process.env.PRODUCTION_API_BASE || process.env.API_BASE || '').replace(/\/$/, '')
const frontendUrl = (process.env.SMOKE_FRONTEND_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '')
const adminUrl = (process.env.SMOKE_ADMIN_URL || process.env.ADMIN_URL || '').replace(/\/$/, '')
const adminUsername = process.env.SMOKE_ADMIN_USERNAME || ''
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || ''

if (!apiBase) {
  console.error('SMOKE_API_BASE / PRODUCTION_API_BASE / API_BASE is required, for example https://api.example.com/api')
  process.exit(1)
}

const request = async (path, options = {}) => {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  })
  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  return { response, payload }
}

const requestAbsolute = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'text/html,application/json',
      ...(options.headers || {}),
    },
  })
  const text = await response.text().catch(() => '')
  return { response, text }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const assertAuthRequired = (response, label) => {
  assert([401, 403].includes(response.status), `${label} should require auth, got ${response.status}`)
}

let adminToken = ''

const requestWithAdmin = (path, options = {}) => request(path, {
  ...options,
  headers: {
    ...(options.headers || {}),
    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
  },
})

const checks = []

const check = async (name, fn) => {
  try {
    await fn()
    checks.push({ name, ok: true })
  } catch (error) {
    checks.push({ name, ok: false, error: error.message })
  }
}

await check('health endpoint is reachable', async () => {
  const { response, payload } = await request('/health')
  assert(response.ok, `expected 2xx, got ${response.status}`)
  assert(payload?.ok !== false, 'health returned ok=false')
})

await check('readiness endpoint accepts traffic', async () => {
  const { response, payload } = await request('/ready')
  assert(response.ok, `expected 2xx, got ${response.status}`)
  assert(payload?.data?.ready === true, 'readiness returned ready=false')
})

await check('payment entry is deferred or disabled', async () => {
  const { response, payload } = await request('/payment/config')
  assert(response.ok, `expected 2xx, got ${response.status}`)
  const config = payload?.data || {}
  assert(config.visible === false, 'payment visible must be false while payment is deferred')
  assert(config.pointsVisible === false, 'points purchase visible must be false while payment is deferred')
  assert(config.paymentLaunchStrategy === 'deferred', 'paymentLaunchStrategy should be deferred')
})

await check('deferred payment catalog is hidden publicly', async () => {
  const plans = await request('/membership-plans')
  assert(plans.response.ok, `membership-plans expected 2xx, got ${plans.response.status}`)
  assert(Array.isArray(plans.payload?.data), 'membership-plans should return an array')
  assert(plans.payload.data.length === 0, 'membership-plans should be empty while payment is deferred')

  const packages = await request('/point-packages')
  assert(packages.response.ok, `point-packages expected 2xx, got ${packages.response.status}`)
  assert(Array.isArray(packages.payload?.data), 'point-packages should return an array')
  assert(packages.payload.data.length === 0, 'point-packages should be empty while payment is deferred')
})

await check('student data requires authentication', async () => {
  const { response } = await request('/learning-records')
  assertAuthRequired(response, 'learning-records')
})

await check('admin launch readiness requires authentication', async () => {
  const { response } = await request('/commercial-launch-readiness')
  assertAuthRequired(response, 'commercial-launch-readiness')
})

await check('admin operations require authentication', async () => {
  const protectedPaths = [
    '/knowledge-points',
    '/subject-scores',
    '/point-rules',
    '/question-packs/smoke-pack/versions',
    '/knowledge-points/smoke-knowledge/coach-pack.pdf',
    '/question-bank-quality',
    '/question-bank-coverage',
    '/product-readiness',
  ]

  for (const path of protectedPaths) {
    const { response } = await request(path)
    assertAuthRequired(response, path)
  }
})

if (adminUsername && adminPassword) {
  await check('admin login succeeds for smoke account', async () => {
    const { response, payload } = await request('/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: adminUsername, password: adminPassword }),
    })
    assert(response.ok, `expected 2xx, got ${response.status}`)
    assert(payload?.data?.token, 'admin login did not return a token')
    adminToken = payload.data.token
  })

  await check('admin operations are usable with authentication', async () => {
    const knowledge = await requestWithAdmin('/knowledge-points')
    assert(knowledge.response.ok, `knowledge-points expected 2xx, got ${knowledge.response.status}`)
    assert(Array.isArray(knowledge.payload?.data), 'knowledge-points should return an array')
    const knowledgeId = knowledge.payload.data[0]?.id
    assert(knowledgeId, 'knowledge-points should include at least one item')

    const packs = await requestWithAdmin('/question-packs')
    assert(packs.response.ok, `question-packs expected 2xx, got ${packs.response.status}`)
    assert(Array.isArray(packs.payload?.data), 'question-packs should return an array')
    const packId = packs.payload.data[0]?.id
    assert(packId, 'question-packs should include at least one item')

    const adminPaths = [
      '/subject-scores',
      '/point-rules',
      `/question-packs/${encodeURIComponent(packId)}/versions`,
      `/knowledge-points/${encodeURIComponent(knowledgeId)}/coach-pack.pdf`,
    ]

    for (const path of adminPaths) {
      const { response } = await requestWithAdmin(path)
      assert(response.ok, `${path} expected 2xx, got ${response.status}`)
    }

    const plans = await requestWithAdmin('/membership-plans')
    assert(plans.response.ok, `admin membership-plans expected 2xx, got ${plans.response.status}`)
    assert(Array.isArray(plans.payload?.data) && plans.payload.data.length > 0, 'admin membership-plans should remain visible')

    const packages = await requestWithAdmin('/point-packages')
    assert(packages.response.ok, `admin point-packages expected 2xx, got ${packages.response.status}`)
    assert(Array.isArray(packages.payload?.data) && packages.payload.data.length > 0, 'admin point-packages should remain visible')
  })
}

if (frontendUrl) {
  await check('student frontend is reachable', async () => {
    const { response, text } = await requestAbsolute(frontendUrl)
    assert(response.ok, `expected 2xx, got ${response.status}`)
    assert(text.includes('id="root"') || text.includes("id='root'"), 'frontend HTML should contain root element')
  })
}

if (adminUrl) {
  await check('admin frontend is reachable', async () => {
    const { response, text } = await requestAbsolute(adminUrl)
    assert(response.ok, `expected 2xx, got ${response.status}`)
    assert(text.includes('id="root"') || text.includes("id='root'"), 'admin HTML should contain root element')
  })
}

const failed = checks.filter(item => !item.ok)
console.log(JSON.stringify({ ok: failed.length === 0, apiBase, frontendUrl: frontendUrl || null, adminUrl: adminUrl || null, checks }, null, 2))

if (failed.length > 0) process.exit(1)
