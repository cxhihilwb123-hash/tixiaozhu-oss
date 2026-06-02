import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.RUNTIME_SECURITY_PORT || (9300 + Math.floor(Math.random() * 400)))
const apiBase = `http://127.0.0.1:${port}/api`
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tixiaozhu-runtime-security-'))
const dataFile = path.join(tempDir, 'store.json')
const adminUsername = 'security-admin'
const adminPassword = 'security-admin-password-123'
const studentPassword = 'student-password-123'

const checks = []
let server = null

const check = async (name, fn) => {
  try {
    const detail = await fn()
    checks.push({ name, ok: true, ...(detail ? { detail } : {}) })
  } catch (error) {
    checks.push({ name, ok: false, error: error.message })
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const assertStatus = (response, expected, label) => {
  const expectedStatuses = Array.isArray(expected) ? expected : [expected]
  assert(expectedStatuses.includes(response.status), `${label} expected ${expectedStatuses.join('/')} got ${response.status}`)
}

const request = async (path, options = {}) => {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
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

const postJson = (path, body, token = '') => request(path, {
  method: 'POST',
  body: JSON.stringify(body),
  headers: token ? { Authorization: `Bearer ${token}` } : {},
})

const getJson = (path, token = '') => request(path, {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
})

const waitForHealth = async () => {
  const deadline = Date.now() + 8000
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const { response } = await getJson('/health')
      if (response.ok) return
    } catch (error) {
      lastError = error
    }
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw new Error(`backend did not become healthy${lastError ? `: ${lastError.message}` : ''}`)
}

const startServer = async () => {
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      TIXIAOZHU_ENV: 'production',
      ALLOW_BLOCKED_PRODUCTION_START: 'true',
      ALLOW_FILE_STORE_FOR_ISOLATED_TESTS: 'true',
      PAYMENT_LAUNCH_STRATEGY: 'deferred',
      REQUIRE_STUDENT_AUTH: 'true',
      TIXIAOZHU_DATA_LAYER: 'file',
      TIXIAOZHU_DATA_FILE: dataFile,
      ADMIN_USERNAME: adminUsername,
      ADMIN_PASSWORD: adminPassword,
      ADMIN_SESSION_SECRET: 'runtime-security-admin-secret-runtime-security-admin-secret',
      STUDENT_SESSION_SECRET: 'runtime-security-student-secret-runtime-security-student-secret',
      FRONTEND_URL: 'https://student.tixiaozhu.test',
      ADMIN_URL: 'https://admin.tixiaozhu.test',
      CORS_ALLOW_ORIGIN: 'https://student.tixiaozhu.test,https://admin.tixiaozhu.test',
    },
  })

  let stderr = ''
  server.stderr.on('data', chunk => {
    stderr += chunk.toString()
  })
  server.on('exit', (code) => {
    if (code && checks.length === 0) {
      console.error(stderr)
    }
  })
  await waitForHealth()
}

const stopServer = async () => {
  if (!server || server.killed) return
  server.kill('SIGTERM')
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 1000)
    server.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

const registerStudent = async (suffix, nickname) => {
  const { response, payload } = await postJson('/auth/register', {
    phone: `1880000${suffix}`,
    password: studentPassword,
    nickname,
    grade: '四年级',
    subject: '数学',
  })
  assertStatus(response, 201, `register ${nickname}`)
  assert(payload?.data?.token, `register ${nickname} did not return token`)
  return payload.data
}

try {
  await startServer()

  let adminToken = ''
  let studentA = null
  let studentB = null
  let lockedPackId = ''
  let freePackId = ''

  await check('admin login works with configured credential', async () => {
    const { response, payload } = await postJson('/admin/auth/login', {
      username: adminUsername,
      password: adminPassword,
    })
    assertStatus(response, 200, 'admin login')
    assert(payload?.data?.token, 'admin login did not return token')
    adminToken = payload.data.token
  })

  await check('student registration creates isolated sessions', async () => {
    studentA = await registerStudent('0101', '安全学生甲')
    studentB = await registerStudent('0102', '安全学生乙')
    assert(studentA.user.id !== studentB.user.id, 'students should have different user ids')
    return { studentA: studentA.user.id, studentB: studentB.user.id }
  })

  await check('anonymous personal student data is blocked', async () => {
    const paths = [
      '/auth/session',
      '/learning-records',
      '/learning-report',
      '/wrong-questions',
      '/wrong-questions/export.pdf',
      '/favorite-questions',
      '/uploaded-questions',
      '/content-purchases',
      '/points/account',
    ]
    for (const path of paths) {
      const { response } = await getJson(path)
      assertStatus(response, [401, 403], path)
    }
    return { paths: paths.length }
  })

  await check('anonymous admin operations are blocked', async () => {
    const paths = [
      '/users',
      '/orders',
      '/payments',
      '/settings',
      '/question-bank-quality',
      '/question-bank-coverage',
      '/product-readiness',
      '/commercial-launch-readiness',
      '/knowledge-points',
      '/subject-scores',
      '/point-rules',
      '/question-packs/smoke-pack/versions',
    ]
    for (const path of paths) {
      const { response } = await getJson(path)
      assertStatus(response, [401, 403], path)
    }
    return { paths: paths.length }
  })

  await check('deferred payment entry points are closed', async () => {
    const studentToken = studentA.token
    const session = await postJson('/payments/session', {
      planId: 'month',
      plan: '月会员',
      amount: 29,
      provider: 'wechat_pay',
      duration: 30,
    }, studentToken)
    assertStatus(session.response, 503, 'payments/session')

    const points = await postJson('/points/purchase', {
      packageId: 'points-1',
      provider: 'wechat_pay',
    }, studentToken)
    assertStatus(points.response, 503, 'points/purchase')

    const mockConfirm = await postJson('/payments/mock-confirm', {
      paymentId: 'PAY-SHOULD-NOT-WORK',
      orderId: 'ORD-SHOULD-NOT-WORK',
    }, studentToken)
    assertStatus(mockConfirm.response, 503, 'payments/mock-confirm')
  })

  await check('public payment catalog is hidden while admin catalog remains usable', async () => {
    const publicPlans = await getJson('/membership-plans')
    assertStatus(publicPlans.response, 200, 'public membership-plans')
    assert(Array.isArray(publicPlans.payload?.data) && publicPlans.payload.data.length === 0, 'public membership plans should be empty')

    const publicPackages = await getJson('/point-packages')
    assertStatus(publicPackages.response, 200, 'public point-packages')
    assert(Array.isArray(publicPackages.payload?.data) && publicPackages.payload.data.length === 0, 'public point packages should be empty')

    const adminPlans = await getJson('/membership-plans', adminToken)
    assertStatus(adminPlans.response, 200, 'admin membership-plans')
    assert(Array.isArray(adminPlans.payload?.data) && adminPlans.payload.data.length > 0, 'admin membership plans should be visible')

    const adminPackages = await getJson('/point-packages', adminToken)
    assertStatus(adminPackages.response, 200, 'admin point-packages')
    assert(Array.isArray(adminPackages.payload?.data) && adminPackages.payload.data.length > 0, 'admin point packages should be visible')
  })

  await check('student data ignores forged user query and stays scoped', async () => {
    const records = await getJson('/learning-records?user=小明', studentA.token)
    assertStatus(records.response, 200, 'student scoped learning-records')
    assert(Array.isArray(records.payload?.data), 'learning records should be an array')
    assert(records.payload.data.every(item => Number(item.userId) === Number(studentA.user.id) || item.user === studentA.user.nickname), 'student A should not receive another user records')

    const purchases = await getJson('/content-purchases?user=小明', studentA.token)
    assertStatus(purchases.response, 200, 'student scoped content-purchases')
    assert(Array.isArray(purchases.payload?.data), 'content purchases should be an array')
    assert(purchases.payload.data.length === 0, 'new student should not inherit 小明 purchases through query string')
  })

  await check('locked paid pack questions cannot be read by unowned student', async () => {
    const packs = await getJson('/question-packs', studentA.token)
    assertStatus(packs.response, 200, 'student question-packs')
    const packItems = packs.payload?.data || []
    const lockedPack = packItems.find(item => (item.accessType || 'free') !== 'free' && Number(item.pointCost || 0) > 0 && item.owned !== true)
    const freePack = packItems.find(item => (item.accessType || 'free') === 'free' || Number(item.pointCost || 0) <= 0)
    assert(lockedPack?.id, 'expected at least one locked paid pack')
    assert(freePack?.id, 'expected at least one free pack')
    lockedPackId = lockedPack.id
    freePackId = freePack.id

    const lockedQuestions = await getJson(`/questions?packId=${encodeURIComponent(lockedPackId)}`, studentA.token)
    assertStatus(lockedQuestions.response, 403, 'locked pack questions')

    const freeQuestions = await getJson(`/questions?packId=${encodeURIComponent(freePackId)}`, studentA.token)
    assertStatus(freeQuestions.response, 200, 'free pack questions')
    assert(Array.isArray(freeQuestions.payload?.data) && freeQuestions.payload.data.length > 0, 'free pack should return questions')
    return { lockedPackId, freePackId }
  })

  await check('anonymous write actions that bind student identity are blocked', async () => {
    const paths = [
      ['/favorite-questions', { questionId: 'q-smoke' }],
      ['/uploaded-questions', { content: '测试题干', answer: 'A' }],
      ['/content-purchases/buy', { packId: lockedPackId }],
      ['/points/spend', { action: 'content_purchase', points: 1, note: 'should fail' }],
    ]
    for (const [path, body] of paths) {
      const { response } = await postJson(path, body)
      assertStatus(response, [401, 403], path)
    }
    return { paths: paths.length }
  })
} finally {
  await stopServer()
  await fs.rm(tempDir, { recursive: true, force: true })
}

const failed = checks.filter(item => !item.ok)
console.log(JSON.stringify({
  ok: failed.length === 0,
  apiBase,
  checks,
}, null, 2))

if (failed.length > 0) process.exit(1)
