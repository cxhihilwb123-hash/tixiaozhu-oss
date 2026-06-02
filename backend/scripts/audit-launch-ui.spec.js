import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const backendDir = path.join(projectRoot, 'backend')
const envFile = path.join(projectRoot, '.env.deepseek.local')
const port = Number(process.env.LAUNCH_UI_AUDIT_PORT || (9600 + Math.floor(Math.random() * 300)))
const baseUrl = `http://127.0.0.1:${port}`
const apiBase = `${baseUrl}/api`
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tixiaozhu-launch-ui-'))
const dataFile = path.join(tempDir, 'store.json')
const artifactDir = path.join(projectRoot, 'output', 'playwright', `launch-ui-${new Date().toISOString().replace(/[:.]/g, '-')}`)
const adminUsername = 'launch-ui-admin'
const adminPassword = 'launch-ui-admin-password-123'
const studentPassword = 'student-password-123'

let server = null
let adminToken = ''
let serverStderr = ''
const checks = []

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

const loadEnvFile = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return Object.fromEntries(raw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        const key = line.slice(0, index).trim()
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
        return [key, value]
      }))
  } catch {
    return {}
  }
}

const providerEnv = await loadEnvFile(envFile)

const record = (name, detail = {}) => {
  checks.push({ name, ok: true, detail })
}

const request = async (pathName, options = {}) => {
  const response = await fetch(`${apiBase}${pathName}`, {
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

const waitForHealth = async () => {
  const deadline = Date.now() + 10_000
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const { response } = await request('/health')
      if (response.ok) return
    } catch (error) {
      lastError = error
    }
    await new Promise(resolve => setTimeout(resolve, 180))
  }
  throw new Error(`backend did not become healthy${lastError ? `: ${lastError.message}` : ''}`)
}

const startServer = async () => {
  await fs.mkdir(artifactDir, { recursive: true })
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ...providerEnv,
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
      ADMIN_SESSION_SECRET: 'launch-ui-admin-secret-launch-ui-admin-secret-launch-ui',
      STUDENT_SESSION_SECRET: 'launch-ui-student-secret-launch-ui-student-secret',
      FRONTEND_URL: baseUrl,
      ADMIN_URL: `${baseUrl}/admin`,
      CORS_ALLOW_ORIGIN: baseUrl,
    },
  })
  server.stderr.on('data', chunk => {
    serverStderr += chunk.toString()
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

const expectVisibleText = async (page, text, timeout = 8000) => {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout })
}

const clickText = async (page, text, options = {}) => {
  const locator = page.getByText(text, { exact: options.exact ?? false })
  await locator.nth(options.nth ?? 0).click({ timeout: options.timeout ?? 8000 })
}

const installPageGuards = (page, label) => {
  const errors = []
  page.on('pageerror', error => {
    errors.push(`pageerror: ${error.message}`)
  })
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      errors.push(`console: ${message.text()}`)
    }
  })
  page.on('response', response => {
    const status = response.status()
    if (status >= 400 && response.url().includes('/api/')) {
      errors.push(`response: ${status} ${response.url()}`)
    }
  })
  return () => {
    expect(errors, `${label} should not emit browser errors`).toEqual([])
  }
}

const finishStudentOnboarding = async (page, nickname) => {
  await page.goto(baseUrl)
  await expectVisibleText(page, '先确定学习阶段')
  await clickText(page, '四年级')
  await clickText(page, '确认 四年级')
  await page.getByPlaceholder('例如：小宇').fill(nickname)
  await clickText(page, '保存并继续')
  await expectVisibleText(page, '学习台已准备好')
  await clickText(page, '进入题小助')
  await expectVisibleText(page, '题小助学习台')
}

const registerStudentFromProfile = async (page, suffix, nickname) => {
  await page.getByTestId('student-tab-profile').click()
  await expectVisibleText(page, '学习档案')
  await clickText(page, '注册')
  await expectVisibleText(page, '注册学生账号')
  await page.getByPlaceholder('例如：小宇').fill(nickname)
  await page.getByPlaceholder('请输入手机号').fill(`1881234${suffix}`)
  await page.getByPlaceholder('至少 8 位').fill(studentPassword)
  await clickText(page, '创建账号并登录')
  await expectVisibleText(page, '已登录正式账号')
}

const runPracticeRound = async (page) => {
  await page.getByTestId('student-tab-practice').click()
  await expectVisibleText(page, '从题库、拍题本和错题本组练习')
  await page.getByRole('button', { name: /拍题本/ }).click()
  await expectVisibleText(page, '拍题本沉淀个人题目')
  const startButton = page.getByRole('button', { name: '练这道题' }).first()
  await expect(startButton).toBeVisible({ timeout: 10_000 })
  await startButton.click()
  await expectVisibleText(page, '第 1 题')

  for (let index = 0; index < 8; index += 1) {
    const textInput = page.getByPlaceholder('输入答案')
    const processInput = page.getByPlaceholder('写下答案或过程')
    if (await textInput.count()) {
      await textInput.first().fill('1')
    } else if (await processInput.count()) {
      await processInput.first().fill('先列式，再计算。')
    } else {
      await page.getByRole('button', { name: /[A-D]\./ }).first().click()
    }
    await clickText(page, '提交答案')
    await expect(page.getByText(/回答正确|回答错误/).first()).toBeVisible({ timeout: 10_000 })
    const isLast = await page.getByRole('button', { name: '完成练习' }).count()
    if (isLast) {
      await page.getByRole('button', { name: '完成练习' }).click()
      await expectVisibleText(page, '本轮结果', 12_000)
      await page.getByRole('button', { name: '返回首页' }).click()
      await expectVisibleText(page, '题小助学习台')
      return
    }
    await page.getByRole('button', { name: '下一题' }).click()
    await expect(page.getByText(/第 \d+ 题/).first()).toBeVisible({ timeout: 10_000 })
  }
  throw new Error('practice round did not complete within 8 questions')
}

const runManualCapture = async (page) => {
  await page.getByTestId('student-tab-capture').click()
  await expectVisibleText(page, '拍题批改')
  await page.getByTestId('capture-manual-input-card').click()
  await expectVisibleText(page, '输入题目内容')
  await page.getByPlaceholder('例如：计算 125 × 8 = ?').fill('计算 125 × 8 = ?')
  await clickText(page, '开始作答')
  await expectVisibleText(page, '先独立写答案')
  await page.getByPlaceholder('输入答案').fill('1000')
  await clickText(page, '提交批改')
  await expect(page.getByText(/答案正确|需要订正/).first()).toBeVisible({ timeout: 12_000 })
  await page.getByTestId('capture-complete-button').click()
  await expectVisibleText(page, '拍题本沉淀个人题目')
}

const runStudentViewportAudit = async ({ browser, viewport, label, suffix }) => {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const assertNoBrowserErrors = installPageGuards(page, `student-${label}`)
  await finishStudentOnboarding(page, `上线${label}`)
  await registerStudentFromProfile(page, suffix, `学生${label}`)
  await page.getByTestId('student-tab-home').click()
  await expectVisibleText(page, '题小助学习台')
  await runManualCapture(page)
  await runPracticeRound(page)
  await page.getByTestId('student-tab-wrong').click()
  await expectVisibleText(page, '错题强化')
  await page.getByTestId('student-tab-profile').click()
  await expectVisibleText(page, '学习档案')
  await clickText(page, '学习记录')
  await expectVisibleText(page, '学习记录')
  await page.keyboard.press('Escape')
  await clickText(page, '收藏题目')
  await expectVisibleText(page, '收藏题目')
  assertNoBrowserErrors()
  await context.close()
  record(`学生端 ${label} 视口完整巡检`, viewport)
}

test.beforeAll(async () => {
  await startServer()
})

test.afterAll(async () => {
  await stopServer()
  const report = {
    ok: checks.every(item => item.ok),
    baseUrl,
    artifactDir,
    checks,
    serverStderr: serverStderr.trim() ? serverStderr.trim().split('\n').slice(-20) : [],
  }
  await fs.writeFile(path.join(artifactDir, 'launch-ui-report.json'), JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify(report, null, 2))
})

test('学生端三端页面、按钮、注册、练习、拍题、错题验收', async ({ browser }) => {
  await runStudentViewportAudit({
    browser,
    viewport: { width: 390, height: 844 },
    label: '手机',
    suffix: '0001',
  })
  await runStudentViewportAudit({
    browser,
    viewport: { width: 768, height: 1024 },
    label: '平板',
    suffix: '0002',
  })
  await runStudentViewportAudit({
    browser,
    viewport: { width: 1280, height: 900 },
    label: '电脑',
    suffix: '0003',
  })
})

test('后台电脑端登录、菜单、关键运营按钮验收', async ({ page }) => {
  const assertNoBrowserErrors = installPageGuards(page, 'admin')
  await page.setViewportSize({ width: 1440, height: 980 })
  await page.goto(`${baseUrl}/admin/`)
  await expectVisibleText(page, '题小助运营后台')
  await page.getByPlaceholder('请输入管理员账号').fill(adminUsername)
  await page.getByPlaceholder('请输入密码').fill(adminPassword)
  await page.getByRole('button', { name: '进入后台' }).click()
  await expectVisibleText(page, '仪表盘中心')

  for (const [menu, heading] of [
    ['用户与档案', '用户与档案中心'],
    ['习题内容', '习题内容中心'],
    ['AI出题中心', 'AI出题中心'],
    ['题库与知识点', '题库与知识点中心'],
    ['学习记录与错题', '学习记录与错题中心'],
    ['收费与积分', '收费与订单中心'],
    ['系统与权限', '系统与权限中心'],
  ]) {
    await page.getByRole('button', { name: menu }).click()
    await expectVisibleText(page, heading)
    record(`后台菜单 ${menu}`, { heading })
  }

  await page.getByRole('button', { name: 'AI出题中心' }).click()
  await expectVisibleText(page, '智能生成')
  await page.locator('input[type="number"]').fill('1')
  await page.getByPlaceholder('输入知识点').fill('三位数乘一位数')
  await page.getByRole('button', { name: '开始生成' }).click()
  await expect(page.getByText('答案：').first()).toBeVisible({ timeout: 45_000 })
  await expect(page.getByText('解析：').first()).toBeVisible({ timeout: 45_000 })
  record('后台 AI 出题按钮到生成预览', { providerConfigured: Boolean(providerEnv.AI_API_KEY) })

  const login = await request('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: adminUsername, password: adminPassword }),
  })
  expect(login.response.ok).toBeTruthy()
  adminToken = login.payload?.data?.token || ''
  expect(adminToken).toBeTruthy()

  const knowledge = await request('/knowledge-points', {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  expect(knowledge.response.ok).toBeTruthy()
  const firstKnowledgePoint = knowledge.payload?.data?.[0]
  expect(firstKnowledgePoint?.id).toBeTruthy()
  const coachPack = await request(`/knowledge-points/${encodeURIComponent(firstKnowledgePoint.id)}/coach-pack.pdf`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  expect(coachPack.response.status).toBe(200)
  record('后台知识点讲义导出接口', { knowledgePoint: firstKnowledgePoint.name })

  await page.getByRole('button', { name: '题库与知识点' }).click()
  await expectVisibleText(page, '导出讲义')
  await page.getByRole('button', { name: '退出' }).click()
  await expectVisibleText(page, '登录继续管理项目')
  assertNoBrowserErrors()
})

test('上线关键 API 状态补充验收', async () => {
  const health = await request('/health')
  expect(health.response.status).toBe(200)
  record('生产 health 状态', health.payload?.data || {})

  const ready = await request('/ready')
  expect([200, 503]).toContain(ready.response.status)
  expect(typeof ready.payload?.data?.ready).toBe('boolean')
  record('隔离验收 ready 状态已返回', {
    status: ready.response.status,
    ready: ready.payload?.data?.ready,
    store: ready.payload?.data?.store,
  })

  const paymentConfig = await request('/payment/config')
  expect(paymentConfig.response.status).toBe(200)
  expect(paymentConfig.payload?.data?.paymentLaunchStrategy).toBe('deferred')
  expect(paymentConfig.payload?.data?.visible).toBe(false)
  record('支付延期入口隐藏', paymentConfig.payload?.data)
})
