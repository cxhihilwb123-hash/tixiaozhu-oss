import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const backendDir = path.join(projectRoot, 'backend')
const port = Number(process.env.INTERACTION_QA_PORT || (9900 + Math.floor(Math.random() * 300)))
const ocrPort = port + 1000
const baseUrl = `http://127.0.0.1:${port}`
const domainUrl = `http://localhost:${port}`
const apiBase = `${baseUrl}/api`
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tixiaozhu-interaction-qa-'))
const dataFile = path.join(tempDir, 'store.json')
const uploadImagePath = path.join(tempDir, 'ocr-upload.png')
const artifactDir = path.join(projectRoot, 'output', 'playwright', `interaction-qa-${new Date().toISOString().replace(/[:.]/g, '-')}`)
const adminUsername = 'interaction-qa-admin'
const adminPassword = 'interaction-qa-admin-password-123'
const studentPassword = 'student-password-123'

let server = null
let ocrServer = null
let serverStderr = ''
let lastOcrRequest = null
const checks = []

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

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

const startOcrServer = async () => {
  ocrServer = createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Method not allowed' }))
      return
    }

    let body = ''
    req.on('data', chunk => {
      body += chunk.toString()
    })
    req.on('end', () => {
      lastOcrRequest = JSON.parse(body || '{}')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        recognizedText: '计算：125 × 8 = ?',
        question: {
          id: `ocr-${Date.now()}`,
          content: '计算：125 × 8 = ?',
          type: '填空题',
          answer: '1000',
          explanation: '125 × 8 = 1000，可以拆成 125 × 4 × 2。',
          knowledgePoint: '乘法运算',
          subject: '数学',
          difficulty: '基础',
        },
      }))
    })
  })

  await new Promise((resolve, reject) => {
    ocrServer.once('error', reject)
    ocrServer.listen(ocrPort, '127.0.0.1', resolve)
  })
}

const startServer = async () => {
  await fs.mkdir(artifactDir, { recursive: true })
  await fs.writeFile(
    uploadImagePath,
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64'),
  )
  await startOcrServer()

  server = spawn(process.execPath, ['src/server.js'], {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '0.0.0.0',
      TIXIAOZHU_ENV: 'production',
      ALLOW_BLOCKED_PRODUCTION_START: 'true',
      ALLOW_FILE_STORE_FOR_ISOLATED_TESTS: 'true',
      PAYMENT_LAUNCH_STRATEGY: 'deferred',
      REQUIRE_STUDENT_AUTH: 'true',
      TIXIAOZHU_DATA_LAYER: 'file',
      TIXIAOZHU_DATA_FILE: dataFile,
      ADMIN_USERNAME: adminUsername,
      ADMIN_PASSWORD: adminPassword,
      ADMIN_SESSION_SECRET: 'interaction-qa-admin-secret-interaction-qa-admin',
      STUDENT_SESSION_SECRET: 'interaction-qa-student-secret-interaction-qa',
      FRONTEND_URL: baseUrl,
      ADMIN_URL: `${baseUrl}/admin`,
      CORS_ALLOW_ORIGIN: `${baseUrl},${domainUrl}`,
      OCR_API_URL: `http://127.0.0.1:${ocrPort}/recognize`,
    },
  })
  server.stderr.on('data', chunk => {
    serverStderr += chunk.toString()
  })
  await waitForHealth()
}

const stopServer = async () => {
  if (server && !server.killed) {
    server.kill('SIGTERM')
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 1000)
      server.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  }
  if (ocrServer) {
    await new Promise(resolve => ocrServer.close(resolve))
  }
}

const expectVisibleText = async (page, text, timeout = 8000) => {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout })
}

const clickText = async (page, text, options = {}) => {
  await page.getByText(text, { exact: options.exact ?? false }).nth(options.nth ?? 0).click({ timeout: options.timeout ?? 8000 })
}

const installPageGuards = (page, label, options = {}) => {
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
    if (!options.allowApiErrors && status >= 400 && response.url().includes('/api/')) {
      errors.push(`response: ${status} ${response.url()}`)
    }
  })
  return () => {
    expect(errors, `${label} should not emit browser errors`).toEqual([])
  }
}

const finishStudentOnboarding = async (page, nickname, url = baseUrl) => {
  await page.goto(url)
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

test.beforeAll(async () => {
  await startServer()
})

test.afterAll(async () => {
  await stopServer()
  const report = {
    ok: checks.every(item => item.ok),
    baseUrl,
    domainUrl,
    artifactDir,
    checks,
    serverStderr: serverStderr.trim() ? serverStderr.trim().split('\n').slice(-20) : [],
  }
  await fs.writeFile(path.join(artifactDir, 'interaction-qa-report.json'), JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify(report, null, 2))
})

test('真实图片上传、移动端输入聚焦与 OCR 失败恢复', async ({ page }) => {
  const assertNoBrowserErrors = installPageGuards(page, 'mobile-ocr', { allowApiErrors: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await finishStudentOnboarding(page, '专项手机')
  await registerStudentFromProfile(page, '7701', '专项手机学生')

  await page.getByTestId('student-tab-capture').click()
  await expectVisibleText(page, '拍题批改')
  await page.locator('input[type="file"]').setInputFiles(uploadImagePath)
  await expectVisibleText(page, '检查识别结果', 12_000)
  expect(lastOcrRequest?.image).toMatch(/^data:image\/png;base64,/)

  const textarea = page.getByPlaceholder('题目内容')
  await textarea.focus()
  await textarea.fill('计算：125 × 8 = ?\n请写出完整过程，并说明为什么可以把 125 × 8 拆成 125 × 4 × 2。')
  const textareaBox = await textarea.boundingBox()
  expect(textareaBox).toBeTruthy()
  expect(textareaBox.y + textareaBox.height).toBeLessThanOrEqual(844)
  record('手机 OCR 上传发送真实 data URL', { imagePrefix: lastOcrRequest.image.slice(0, 22) })
  record('手机输入聚焦可见性', { bottom: Math.round(textareaBox.y + textareaBox.height), viewportHeight: 844 })

  await page.getByRole('button', { name: '确认题目' }).click()
  await expectVisibleText(page, '先独立写答案')
  const answerInput = page.getByPlaceholder('输入答案')
  await answerInput.focus()
  await answerInput.fill('1000')
  const answerBox = await answerInput.boundingBox()
  expect(answerBox).toBeTruthy()
  expect(answerBox.y + answerBox.height).toBeLessThanOrEqual(844)
  record('手机答案输入框聚焦可见性', { bottom: Math.round(answerBox.y + answerBox.height), viewportHeight: 844 })

  await page.goto(baseUrl)
  await expectVisibleText(page, '题小助学习台')
  await page.route('**/api/uploads/recognize', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ ok: false, error: 'OCR unavailable' }),
  }))
  await page.getByTestId('student-tab-capture').click()
  await page.locator('input[type="file"]').setInputFiles(uploadImagePath)
  await expectVisibleText(page, '图片识别暂时失败', 12_000)
  await page.getByTestId('capture-manual-input-card').click()
  await expectVisibleText(page, '输入题目内容')
  await page.unroute('**/api/uploads/recognize')
  assertNoBrowserErrors()
  record('OCR 失败后可恢复到手动输入', { fallback: 'manual input visible' })
  await page.screenshot({ path: path.join(artifactDir, 'mobile-ocr-recovery.png'), fullPage: false })
})

test('弹窗关闭边界、长列表滚动与页面返回', async ({ page }) => {
  const assertNoBrowserErrors = installPageGuards(page, 'modal-scroll')
  await page.setViewportSize({ width: 390, height: 844 })
  await finishStudentOnboarding(page, '弹窗手机')
  await registerStudentFromProfile(page, '7702', '弹窗学生')

  await page.getByTestId('student-tab-practice').click()
  await expectVisibleText(page, '从题库、拍题本和错题本组练习')
  await clickText(page, '去题库商城买新题包')
  await expectVisibleText(page, '题库商城')

  await page.getByRole('button', { name: '题目预览' }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 12_000 })
  await expect(dialog).toContainText('题目预览')
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden')
  const scrollResult = await dialog.evaluate((element) => {
    element.scrollTop = element.scrollHeight
    return {
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }
  })
  expect(scrollResult.scrollHeight).toBeGreaterThan(scrollResult.clientHeight)
  expect(scrollResult.scrollTop).toBeGreaterThan(0)
  record('题目预览弹窗长列表可滚动', scrollResult)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('')
  record('弹窗 Escape 可关闭且恢复页面滚动')

  await page.getByRole('button', { name: '题目预览' }).first().click()
  await expect(dialog).toBeVisible({ timeout: 12_000 })
  await page.getByRole('button', { name: '关闭' }).first().click()
  await expect(dialog).toBeHidden()
  record('弹窗关闭按钮可关闭')

  await clickText(page, '返回练习中心')
  await expectVisibleText(page, '练习中心')
  assertNoBrowserErrors()
  record('题库商城返回练习中心边界正常')
  await page.screenshot({ path: path.join(artifactDir, 'modal-scroll-return.png'), fullPage: false })
})

test('异常网络不白屏，真实部署域名同源访问正常', async ({ browser }) => {
  const networkContext = await browser.newContext({ viewport: { width: 768, height: 1024 } })
  const networkPage = await networkContext.newPage()
  const assertNoNetworkJsErrors = installPageGuards(networkPage, 'network-degraded', { allowApiErrors: true })
  await finishStudentOnboarding(networkPage, '异常网络')
  await registerStudentFromProfile(networkPage, '7703', '异常网络学生')
  await networkPage.route('**/api/question-packs**', route => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ ok: false, error: 'network qa failure' }),
  }))
  await networkPage.getByTestId('student-tab-practice').click()
  await expectVisibleText(networkPage, '练习中心')
  await expectVisibleText(networkPage, '当前没有可练题包')
  assertNoNetworkJsErrors()
  record('题包接口 500 时练习中心不白屏', { expectedEmptyState: '当前没有可练题包' })
  await networkPage.screenshot({ path: path.join(artifactDir, 'network-degraded.png'), fullPage: false })
  await networkContext.close()

  const domainContext = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const domainPage = await domainContext.newPage()
  const assertNoDomainErrors = installPageGuards(domainPage, 'domain-origin')
  await finishStudentOnboarding(domainPage, '域名访问', domainUrl)
  await expect(domainPage.url()).toContain(`localhost:${port}`)
  await domainPage.getByTestId('student-tab-capture').click()
  await expectVisibleText(domainPage, '拍题批改')
  assertNoDomainErrors()
  record('localhost 部署域名同源体验正常', { url: domainPage.url() })
  await domainPage.screenshot({ path: path.join(artifactDir, 'domain-origin.png'), fullPage: false })
  await domainContext.close()
})
