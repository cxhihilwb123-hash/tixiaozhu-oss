import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const backendDir = path.join(projectRoot, 'backend')
const envFile = path.resolve(projectRoot, process.argv[2] || '.env.deepseek.local')
const port = Number(process.env.AI_VERIFY_PORT || (9700 + Math.floor(Math.random() * 250)))
const apiBase = `http://127.0.0.1:${port}/api`
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tixiaozhu-ai-verify-'))
const dataFile = path.join(tempDir, 'store.json')
const adminUsername = 'ai-verify-admin'
const adminPassword = 'ai-verify-admin-password-123'

const loadEnvFile = async (filePath) => {
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
}

const providerEnv = await loadEnvFile(envFile)
for (const key of ['AI_API_BASE', 'AI_API_KEY', 'AI_MODEL']) {
  if (!providerEnv[key]) throw new Error(`${key} is required in ${envFile}`)
}

let server = null

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
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    try {
      const { response } = await request('/health')
      if (response.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw new Error('backend did not become healthy for AI verification')
}

const startServer = async () => {
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
      ADMIN_SESSION_SECRET: 'ai-verify-admin-secret-ai-verify-admin-secret-ai-verify',
      STUDENT_SESSION_SECRET: 'ai-verify-student-secret-ai-verify-student-secret',
      FRONTEND_URL: 'https://student.tixiaozhu.verify',
      ADMIN_URL: 'https://admin.tixiaozhu.verify',
      CORS_ALLOW_ORIGIN: 'https://student.tixiaozhu.verify,https://admin.tixiaozhu.verify',
    },
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

try {
  await startServer()

  const login = await request('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: adminUsername, password: adminPassword }),
  })
  if (!login.response.ok || !login.payload?.data?.token) {
    throw new Error(`admin login failed: HTTP ${login.response.status}`)
  }

  const generated = await request('/ai/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${login.payload.data.token}` },
    body: JSON.stringify({
      subject: '数学',
      grade: '四年级',
      knowledgePoint: '三位数乘一位数',
      difficulty: '中等',
      questionType: '填空题',
      count: 2,
    }),
  })

  if (!generated.response.ok) {
    throw new Error(`AI provider verification failed: HTTP ${generated.response.status} ${generated.payload?.error || ''}`.trim())
  }
  const questions = generated.payload?.data || []
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('AI provider returned no questions')
  }
  if (questions.some(question => !question.content || !question.answer || !question.explanation)) {
    throw new Error('AI provider returned incomplete questions')
  }

  console.log(JSON.stringify({
    ok: true,
    provider: providerEnv.AI_API_BASE.replace(/\/\/[^/@]+@/, '//***@'),
    model: providerEnv.AI_MODEL,
    generated: questions.length,
    sample: {
      subject: questions[0].subject,
      grade: questions[0].grade,
      knowledgePoint: questions[0].knowledgePoint,
      type: questions[0].type,
      contentPreview: String(questions[0].content || '').slice(0, 80),
    },
  }, null, 2))
} finally {
  await stopServer()
  await fs.rm(tempDir, { recursive: true, force: true })
}
