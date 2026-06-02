import http from 'node:http'
import { execFile } from 'node:child_process'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath, URL, pathToFileURL } from 'node:url'
import { buildCommercialLaunchReadinessReport } from './commercial-launch-readiness.js'
import { buildProductReadinessReport } from './product-readiness.js'
import { buildLaunchIntegrationStatus, emitMonitoringEvent } from './launch-integrations.js'
import { createStorePersistence, loadStore } from './store-persistence.js'

const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '127.0.0.1'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5173'
const ADMIN_URL = process.env.ADMIN_URL || 'http://127.0.0.1:5174'
const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const CUPS_FILTER_PATH = process.env.CUPS_FILTER_PATH || '/usr/sbin/cupsfilter'
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'tixiaozhu-local-admin-secret'
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || ''
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7
const STUDENT_SESSION_SECRET = process.env.STUDENT_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || 'tixiaozhu-local-student-secret'
const STUDENT_SESSION_TTL_MS = Number(process.env.STUDENT_SESSION_TTL_MS || 1000 * 60 * 60 * 24 * 30)
const PASSWORD_HASH_ROUNDS = Number(process.env.PASSWORD_HASH_ROUNDS || 12)
const PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || ''
const AI_API_KEY = process.env.AI_API_KEY || ''
const AI_API_BASE = process.env.AI_API_BASE || ''
const AI_MODEL = process.env.AI_MODEL || ''
const OCR_API_URL = process.env.OCR_API_URL || ''
const IS_PRODUCTION_RUNTIME = process.env.NODE_ENV === 'production' || process.env.TIXIAOZHU_ENV === 'production'
const REQUIRE_STUDENT_AUTH = IS_PRODUCTION_RUNTIME || process.env.REQUIRE_STUDENT_AUTH === 'true'
const PAYMENT_LAUNCH_STRATEGY = process.env.PAYMENT_LAUNCH_STRATEGY || process.env.TIXIAOZHU_PAYMENT_STRATEGY || ''
const OCR_LAUNCH_STRATEGY = process.env.OCR_LAUNCH_STRATEGY || process.env.RECOGNITION_LAUNCH_STRATEGY || ''
const CORS_ALLOW_ORIGIN = process.env.CORS_ALLOW_ORIGIN || (IS_PRODUCTION_RUNTIME ? `${FRONTEND_URL},${ADMIN_URL}` : '*')
const ADMIN_LOGIN_MAX_ATTEMPTS = Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS || 8)
const ADMIN_LOGIN_WINDOW_MS = Number(process.env.ADMIN_LOGIN_WINDOW_MS || 10 * 60 * 1000)
const STUDENT_LOGIN_MAX_ATTEMPTS = Number(process.env.STUDENT_LOGIN_MAX_ATTEMPTS || 10)
const STUDENT_LOGIN_WINDOW_MS = Number(process.env.STUDENT_LOGIN_WINDOW_MS || 10 * 60 * 1000)
const execFileAsync = promisify(execFile)
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const frontendDistDir = process.env.FRONTEND_DIST_DIR || path.join(projectRoot, 'frontend', 'dist')
const adminDistDir = process.env.ADMIN_DIST_DIR || path.join(projectRoot, 'admin', 'dist')
const store = await loadStore()
const storePersistence = createStorePersistence(store)
const scheduleStorePersist = () => storePersistence.schedule()
const questionPackPdfCache = new Map()
const questionPackPdfJobs = new Map()
const questionPackPdfErrors = new Map()
const adminLoginAttempts = new Map()
const studentLoginAttempts = new Map()

const hasConfigValue = (value) => String(value || '').trim().length > 0

const isPaymentLaunchDeferred = () => {
  const strategy = String(PAYMENT_LAUNCH_STRATEGY || '').trim()
  if (strategy === 'deferred') return true
  if (strategy === 'production') return false
  return store.settings.paymentFeatureVisible !== true
}

const isOcrLaunchDeferred = () => {
  const strategy = String(OCR_LAUNCH_STRATEGY || '').trim()
  if (strategy === 'deferred') return true
  if (strategy === 'production') return false
  return IS_PRODUCTION_RUNTIME && !hasConfigValue(OCR_API_URL)
}

const requirePaymentLaunchAvailable = () => {
  if (!IS_PRODUCTION_RUNTIME || !isPaymentLaunchDeferred()) return
  const error = new Error('Payment launch is deferred for this production release')
  error.status = 503
  throw error
}

const assertProductionLaunchAllowed = () => {
  const isolatedBypass = process.env.ALLOW_BLOCKED_PRODUCTION_START === 'true' && process.env.NODE_ENV !== 'production'
  if (!IS_PRODUCTION_RUNTIME || isolatedBypass) return

  const report = buildCommercialLaunchReadinessReport(store, process.env)
  if (report.readiness === 'launch_ready') return

  const issueSummary = report.issues
    .slice(0, 8)
    .map(issue => `${issue.level}:${issue.title}`)
    .join('; ')
  throw new Error(`Commercial launch preflight failed: ${issueSummary}. Set ALLOW_BLOCKED_PRODUCTION_START=true only for isolated verification.`)
}

assertProductionLaunchAllowed()

const allowedCorsOrigins = () => String(CORS_ALLOW_ORIGIN || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean)

const resolveCorsOrigin = (requestOrigin) => {
  const origins = allowedCorsOrigins()
  if (!IS_PRODUCTION_RUNTIME && origins.includes('*')) return '*'
  if (requestOrigin && origins.includes(requestOrigin)) return requestOrigin
  return IS_PRODUCTION_RUNTIME ? 'null' : (origins[0] || FRONTEND_URL)
}

const corsHeaders = (requestOrigin) => ({
  'Access-Control-Allow-Origin': resolveCorsOrigin(requestOrigin),
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Admin-Token,X-Payment-Signature',
  'Vary': 'Origin',
})

const flushStoreBeforeResponse = async () => {
  if (storePersistence.pending()) await storePersistence.flush()
}

const json = async (res, status, payload) => {
  await flushStoreBeforeResponse()
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...corsHeaders(res.__requestOrigin),
  })
  res.end(body)
}

const html = (res, status, body) => {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...corsHeaders(res.__requestOrigin),
  })
  res.end(body)
}

const binary = (res, status, body, headers = {}) => {
  res.writeHead(status, {
    'Content-Length': body.length,
    ...corsHeaders(res.__requestOrigin),
    ...headers,
  })
  res.end(body)
}

const staticContentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
}

const serveStaticFile = async (res, filePath, cacheControl = 'public, max-age=3600') => {
  const body = await fs.readFile(filePath)
  return binary(res, 200, body, {
    'Content-Type': staticContentTypes[path.extname(filePath)] || 'application/octet-stream',
    'Cache-Control': cacheControl,
  })
}

const safeStaticPath = (baseDir, requestPath) => {
  const normalizedPath = decodeURIComponent(requestPath || '/')
  const withoutLeadingSlash = normalizedPath.replace(/^\/+/, '')
  const filePath = path.resolve(baseDir, withoutLeadingSlash || 'index.html')
  const relativePath = path.relative(path.resolve(baseDir), filePath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null
  return filePath
}

const serveStaticApp = async (res, requestPath, baseDir) => {
  const filePath = safeStaticPath(baseDir, requestPath)
  if (!filePath) return json(res, 403, { ok: false, error: 'Forbidden' })

  try {
    return await serveStaticFile(res, filePath, requestPath.includes('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache')
  } catch (error) {
    if (error.code !== 'ENOENT' || path.extname(requestPath)) {
      return json(res, 404, { ok: false, error: 'Not found' })
    }
    return serveStaticFile(res, path.join(baseDir, 'index.html'), 'no-cache')
  }
}

const readBody = async (req) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return {}
  }
}

const ok = (data, meta = {}) => ({ ok: true, data, meta })

const sanitizeSettings = (settings) => {
  const next = { ...(settings || {}) }
  delete next.adminPassword
  return next
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const safeFileName = (value) => String(value || '题包')
  .replace(/[\\/:*?"<>|]/g, '-')
  .replace(/\s+/g, '')
  .slice(0, 80) || '题包'

const invalidateQuestionPackPdf = (packId) => {
  const key = String(packId || '')
  if (!key) return
  questionPackPdfCache.delete(key)
  questionPackPdfJobs.delete(key)
  questionPackPdfErrors.delete(key)
}

const pad = (value) => String(value).padStart(2, '0')

const normalizeUserName = (value) => String(value || '同学').trim() || '同学'
const normalizeAdminName = (value) => String(value || '').trim()
const normalizePhone = (value) => String(value || '').replace(/\s+/g, '').trim()

const formatDate = (date) => {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  return `${year}-${month}-${day}`
}

const formatDateTime = (date) => {
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${formatDate(date)} ${hours}:${minutes}`
}

const bySearch = (items, search, keys) => {
  if (!search) return items
  return items.filter(item => keys.some(key => String(item[key] || '').includes(search)))
}

const createAdminToken = (profile) => {
  const payload = {
    username: profile.username,
    role: 'admin',
    displayName: profile.displayName || '管理员',
    exp: Date.now() + ADMIN_SESSION_TTL_MS,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', ADMIN_SESSION_SECRET).update(body).digest('base64url')
  return `${body}.${signature}`
}

const readAdminToken = (token) => {
  if (!token || !token.includes('.')) return null
  const [body, signature] = token.split('.')
  if (!body || !signature) return null

  const expected = createHmac('sha256', ADMIN_SESSION_SECRET).update(body).digest('base64url')
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload?.exp || Number(payload.exp) < Date.now()) return null
    if (payload.role !== 'admin') return null
    return payload
  } catch {
    return null
  }
}

const getAdminTokenFromRequest = (req) => {
  const header = req.headers.authorization || ''
  if (header.startsWith('Bearer ')) return header.slice(7).trim()
  const direct = req.headers['x-admin-token']
  return typeof direct === 'string' ? direct.trim() : ''
}

const requireAdmin = (req) => {
  const payload = readAdminToken(getAdminTokenFromRequest(req))
  if (!payload) {
    const error = new Error('Admin authentication required')
    error.status = 401
    throw error
  }
  return payload
}

const hasAdminSession = (req) => Boolean(readAdminToken(getAdminTokenFromRequest(req)))

const buildAdminProfile = (username) => ({
  username,
  displayName: '管理员',
  role: 'super_admin',
})

const adminCredentialConfig = () => ({
  username: normalizeAdminName(process.env.ADMIN_USERNAME || store.settings.adminUsername || 'admin'),
  password: String(process.env.ADMIN_PASSWORD || (!IS_PRODUCTION_RUNTIME ? 'admin123' : '')),
  passwordHash: ADMIN_PASSWORD_HASH,
})

const adminLoginKey = (body) => normalizeAdminName(body.username || 'unknown') || 'unknown'

const assertAdminLoginAllowed = (key) => {
  const now = Date.now()
  const entry = adminLoginAttempts.get(key)
  if (!entry || now - entry.firstAt > ADMIN_LOGIN_WINDOW_MS) {
    adminLoginAttempts.set(key, { count: 0, firstAt: now })
    return
  }

  if (entry.count >= ADMIN_LOGIN_MAX_ATTEMPTS) {
    const error = new Error('登录失败次数过多，请稍后再试')
    error.status = 429
    throw error
  }
}

const recordAdminLoginFailure = (key) => {
  const now = Date.now()
  const entry = adminLoginAttempts.get(key)
  if (!entry || now - entry.firstAt > ADMIN_LOGIN_WINDOW_MS) {
    adminLoginAttempts.set(key, { count: 1, firstAt: now })
    return
  }
  entry.count += 1
}

const adminLogin = async (body) => {
  const loginKey = adminLoginKey(body)
  assertAdminLoginAllowed(loginKey)

  const username = normalizeAdminName(body.username)
  const password = String(body.password || '')
  const { username: expectedUsername, password: expectedPassword, passwordHash } = adminCredentialConfig()
  const passwordMatches = passwordHash
    ? await bcrypt.compare(password, passwordHash)
    : Boolean(expectedPassword) && password === expectedPassword

  if (username !== expectedUsername || !passwordMatches) {
    recordAdminLoginFailure(loginKey)
    const error = new Error('账号或密码错误')
    error.status = 401
    throw error
  }

  adminLoginAttempts.delete(loginKey)
  const profile = buildAdminProfile(expectedUsername)
  return {
    token: createAdminToken(profile),
    profile,
  }
}

const studentLoginKey = (body) => normalizePhone(body.phone || body.login || 'unknown') || 'unknown'

const assertStudentLoginAllowed = (key) => {
  const now = Date.now()
  const entry = studentLoginAttempts.get(key)
  if (!entry || now - entry.firstAt > STUDENT_LOGIN_WINDOW_MS) {
    studentLoginAttempts.set(key, { count: 0, firstAt: now })
    return
  }

  if (entry.count >= STUDENT_LOGIN_MAX_ATTEMPTS) {
    const error = new Error('登录失败次数过多，请稍后再试')
    error.status = 429
    throw error
  }
}

const recordStudentLoginFailure = (key) => {
  const now = Date.now()
  const entry = studentLoginAttempts.get(key)
  if (!entry || now - entry.firstAt > STUDENT_LOGIN_WINDOW_MS) {
    studentLoginAttempts.set(key, { count: 1, firstAt: now })
    return
  }
  entry.count += 1
}

const createLegacyStudentPasswordHash = (password, salt = randomBytes(16).toString('hex')) => {
  const hash = createHmac('sha256', STUDENT_SESSION_SECRET)
    .update(`${salt}:${String(password || '')}`)
    .digest('base64url')
  return `${salt}.${hash}`
}

const createStudentPasswordHash = async (password) => bcrypt.hash(String(password || ''), PASSWORD_HASH_ROUNDS)

const verifyLegacyStudentPassword = (password, storedHash) => {
  if (!storedHash || !storedHash.includes('.')) return false
  const [salt, hash] = storedHash.split('.')
  const expected = createLegacyStudentPasswordHash(password, salt).split('.')[1]
  const left = Buffer.from(hash || '')
  const right = Buffer.from(expected || '')
  return left.length === right.length && timingSafeEqual(left, right)
}

const verifyStudentPassword = async (password, storedHash) => {
  if (!storedHash) return { ok: false, needsRehash: false }
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    return {
      ok: await bcrypt.compare(String(password || ''), storedHash),
      needsRehash: false,
    }
  }
  return {
    ok: verifyLegacyStudentPassword(password, storedHash),
    needsRehash: true,
  }
}

const createStudentToken = (authUser, profile) => {
  const payload = {
    authUserId: authUser.id,
    userId: authUser.userId,
    nickname: profile?.nickname || authUser.nickname,
    role: 'student',
    exp: Date.now() + STUDENT_SESSION_TTL_MS,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', STUDENT_SESSION_SECRET).update(body).digest('base64url')
  return `${body}.${signature}`
}

const readStudentToken = (token) => {
  if (!token || !token.includes('.')) return null
  const [body, signature] = token.split('.')
  if (!body || !signature) return null

  const expected = createHmac('sha256', STUDENT_SESSION_SECRET).update(body).digest('base64url')
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload?.exp || Number(payload.exp) < Date.now()) return null
    if (payload.role !== 'student') return null
    return payload
  } catch {
    return null
  }
}

const getStudentTokenFromRequest = (req) => {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

const sanitizeStudentProfile = (profile) => {
  if (!profile) return null
  return {
    id: profile.id,
    nickname: profile.nickname,
    grade: profile.grade,
    subject: profile.subject,
    memberStatus: profile.memberStatus,
    memberPlan: profile.memberPlan,
    expireDate: profile.expireDate,
    pointsBalance: Number(profile.pointsBalance || 0),
    totalQuestions: Number(profile.totalQuestions || 0),
    accuracy: Number(profile.accuracy || 0),
    lastActive: profile.lastActive,
  }
}

const ensureStudentAuthCollections = () => {
  store.studentAuthUsers ||= []
}

const findStudentAuthUser = (login) => {
  const normalized = normalizePhone(login)
  ensureStudentAuthCollections()
  return store.studentAuthUsers.find(item => item.phone === normalized || item.login === normalized)
}

const requireStudent = (req) => {
  const payload = readStudentToken(getStudentTokenFromRequest(req))
  if (!payload) {
    const error = new Error('Student authentication required')
    error.status = 401
    throw error
  }

  const profile = store.users.find(item => Number(item.id) === Number(payload.userId))
  if (!profile) {
    const error = new Error('Student profile not found')
    error.status = 401
    throw error
  }
  return { payload, profile }
}

const bindStudentBody = (req, body = {}) => {
  const { profile } = requireStudent(req)
  return {
    ...body,
    userId: profile.id,
    user: profile.nickname,
  }
}

const resolveStudentScope = (req, requestedUser) => {
  const adminPayload = readAdminToken(getAdminTokenFromRequest(req))
  if (adminPayload) {
    return {
      isAdmin: true,
      user: requestedUser ? normalizeUserName(requestedUser) : null,
      userId: null,
    }
  }

  const { profile } = requireStudent(req)
  return {
    isAdmin: false,
    user: profile.nickname,
    userId: profile.id,
  }
}

const isInStudentScope = (item, scope) => {
  return sameStudentOwner(item, scope)
}

const sameStudentOwner = (item, identity = {}) => {
  const hasUserId = identity?.userId !== undefined && identity?.userId !== null && String(identity.userId) !== ''
  const hasUser = Boolean(String(identity?.user || '').trim())
  if (!hasUserId && !hasUser) return true
  if (hasUserId && item?.userId !== undefined && item?.userId !== null && String(item.userId) !== '') {
    return Number(item.userId) === Number(identity.userId)
  }
  if (!hasUser) return false
  return normalizeUserName(item?.user) === normalizeUserName(identity.user)
}

const createUserProfile = (name) => {
  const nickname = normalizeUserName(name)
  const user = {
    id: store.users.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1,
    nickname,
    grade: '未设置',
    subject: '数学',
    memberStatus: 'none',
    memberPlan: null,
    expireDate: null,
    totalQuestions: 0,
    accuracy: 0,
    lastActive: formatDate(new Date()),
    pointsBalance: Number(store.settings?.newUserInitialPoints || 20),
    pointsTotalEarned: Number(store.settings?.newUserInitialPoints || 20),
    pointsTotalSpent: 0,
  }
  store.users.push(user)
  scheduleStorePersist()
  return user
}

const findOrCreateUser = (name) => {
  const nickname = normalizeUserName(name)
  const user = store.users.find(item => item.nickname === nickname)
  if (user) return user
  return createUserProfile(nickname)
}

const findUserByIdentity = ({ user, userId } = {}) => {
  if (userId !== undefined && userId !== null && String(userId) !== '') {
    const existing = store.users.find(item => Number(item.id) === Number(userId))
    if (existing) return existing
  }
  const existingByName = store.users.find(item => item.nickname === normalizeUserName(user))
  if (existingByName) return existingByName
  const error = new Error('Student account is required')
  error.status = 401
  throw error
}

const registerStudent = async (body) => {
  const phone = normalizePhone(body.phone || body.login)
  const password = String(body.password || '')
  const nickname = normalizeUserName(body.nickname || phone || '同学')

  if (!phone || phone.length < 5) {
    const error = new Error('请输入有效手机号或登录账号')
    error.status = 400
    throw error
  }

  if (password.length < 8) {
    const error = new Error('密码至少需要 8 位')
    error.status = 400
    throw error
  }

  if (findStudentAuthUser(phone)) {
    const error = new Error('账号已存在')
    error.status = 409
    throw error
  }

  const profile = createUserProfile(nickname)
  profile.grade = body.grade || profile.grade || '未设置'
  profile.subject = body.subject || profile.subject || '数学'
  profile.lastActive = formatDate(new Date())

  ensureStudentAuthCollections()
  const authUser = {
    id: `stu-${Date.now()}-${randomBytes(4).toString('hex')}`,
    userId: profile.id,
    login: phone,
    phone,
    nickname: profile.nickname,
    passwordHash: await createStudentPasswordHash(password),
    provider: 'password',
    status: 'active',
    createdAt: formatDateTime(new Date()),
    lastLoginAt: formatDateTime(new Date()),
  }
  profile.authUserId = authUser.id
  store.studentAuthUsers.unshift(authUser)
  scheduleStorePersist()

  return {
    token: createStudentToken(authUser, profile),
    user: sanitizeStudentProfile(profile),
  }
}

const loginStudent = async (body) => {
  const loginKey = studentLoginKey(body)
  assertStudentLoginAllowed(loginKey)

  const login = normalizePhone(body.phone || body.login)
  const password = String(body.password || '')
  const authUser = findStudentAuthUser(login)
  const passwordCheck = authUser && authUser.status !== 'disabled'
    ? await verifyStudentPassword(password, authUser.passwordHash)
    : { ok: false, needsRehash: false }
  if (!authUser || authUser.status === 'disabled' || !passwordCheck.ok) {
    recordStudentLoginFailure(loginKey)
    const error = new Error('账号或密码错误')
    error.status = 401
    throw error
  }

  const profile = store.users.find(item => Number(item.id) === Number(authUser.userId))
  if (!profile) {
    const error = new Error('学生档案不存在')
    error.status = 404
    throw error
  }

  authUser.lastLoginAt = formatDateTime(new Date())
  if (passwordCheck.needsRehash) authUser.passwordHash = await createStudentPasswordHash(password)
  profile.lastActive = formatDate(new Date())
  studentLoginAttempts.delete(loginKey)
  scheduleStorePersist()
  return {
    token: createStudentToken(authUser, profile),
    user: sanitizeStudentProfile(profile),
  }
}

const currentStudentSession = (req) => {
  const { profile } = requireStudent(req)
  return sanitizeStudentProfile(profile)
}

const getPointRule = (action) => store.pointRules.find(rule => rule.action === action && rule.enabled !== false)

const createPointTransaction = ({ user, userId, type, action, points, note, relatedId, operator = 'system' }) => {
  const account = findUserByIdentity({ user, userId })
  const value = Math.max(0, Number(points || 0))
  if (!value) throw new Error('Points must be greater than 0')

  if (type === 'debit' && Number(account.pointsBalance || 0) < value) {
    const error = new Error('Insufficient points')
    error.status = 409
    throw error
  }

  if (type === 'credit') {
    account.pointsBalance = Number(account.pointsBalance || 0) + value
    account.pointsTotalEarned = Number(account.pointsTotalEarned || 0) + value
  } else {
    account.pointsBalance = Number(account.pointsBalance || 0) - value
    account.pointsTotalSpent = Number(account.pointsTotalSpent || 0) + value
  }
  account.lastActive = formatDate(new Date())

  const transaction = {
    id: `PT${String((store.pointTransactions?.length || 0) + 1).padStart(3, '0')}`,
    userId: account.id,
    user: account.nickname,
    type,
    action,
    points: value,
    balanceAfter: account.pointsBalance,
    note: note || '',
    relatedId: relatedId || null,
    createdAt: formatDateTime(new Date()),
    operator,
  }

  store.pointTransactions ||= []
  store.pointTransactions.unshift(transaction)
  scheduleStorePersist()
  return { account, transaction }
}

const buildPointAccount = (name, userId = null) => {
  const user = findUserByIdentity({ user: name, userId })
  return {
    user: {
      id: user.id,
      nickname: user.nickname,
      grade: user.grade,
      subject: user.subject,
    },
    balance: Number(user.pointsBalance || 0),
    totalEarned: Number(user.pointsTotalEarned || 0),
    totalSpent: Number(user.pointsTotalSpent || 0),
    rules: store.pointRules,
    packages: store.pointPackages.filter(item => item.status === 'active'),
    recentTransactions: (store.pointTransactions || [])
      .filter(item => (item.userId !== undefined && item.userId !== null)
        ? Number(item.userId) === Number(user.id)
        : item.user === user.nickname)
      .slice(0, 12),
  }
}

const hasContentAccess = (user, pack, userId = null) => {
  if (!pack) return false
  if ((pack.accessType || 'free') === 'free' || Number(pack.pointCost || 0) <= 0) return true
  const nickname = normalizeUserName(user)
  return (store.contentPurchases || []).some(item => sameStudentOwner(item, { user: nickname, userId }) && item.packId === pack.id)
}

const packKnowledgeTerms = (pack) => Array.from(new Set([
  pack.unitName,
  ...(String(pack.coverage || '').split('、')),
  ...(String(pack.structure || '').split(/[·,，、\s]+/)),
].map(item => String(item || '').trim()).filter(item => item.length >= 2)))

const buildPackRecommendation = (pack, user) => {
  const nickname = normalizeUserName(user)
  const profile = store.users.find(item => item.nickname === nickname)
  const terms = packKnowledgeTerms(pack)
  const haystack = `${pack.name || ''}${pack.unitName || ''}${pack.coverage || ''}${pack.structure || ''}`
  const records = store.learningRecords.filter(item => item.user === nickname)
  const activeWrongQuestions = store.wrongQuestions.filter(item =>
    item.user === nickname && normalizeWrongStatus(item) !== 'mastered'
  )
  const weakPoints = Array.from(new Set(records
    .flatMap(record => Array.isArray(record.weakKnowledgePoints) ? record.weakKnowledgePoints : [])
    .filter(Boolean)))
  const matchedWrongPoints = Array.from(new Set(activeWrongQuestions
    .filter(item => item.subject === pack.subject || item.subject === normalizeSubject(pack.subject))
    .map(item => item.knowledgePoint)
    .filter(point => point && (haystack.includes(point) || terms.some(term => point.includes(term) || term.includes(point))))))
  const matchedWeakPoints = weakPoints.filter(point =>
    haystack.includes(point) || terms.some(term => point.includes(term) || term.includes(point))
  )
  const sameSubjectRecords = records.filter(item => item.subject === pack.subject || item.subject === normalizeSubject(pack.subject))
  const latestSameSubjectRecord = sameSubjectRecords[0]

  const reasons = []
  let score = 0
  if (profile?.grade && pack.grade === profile.grade) {
    reasons.push(`年级匹配：适合${profile.grade}当前进度`)
    score += 30
  }
  if (matchedWrongPoints.length > 0) {
    reasons.push(`错题回收：覆盖${matchedWrongPoints.slice(0, 3).join('、')}`)
    score += 35
  }
  if (matchedWeakPoints.length > 0) {
    reasons.push(`薄弱巩固：针对近期${matchedWeakPoints.slice(0, 3).join('、')}`)
    score += 25
  }
  if (latestSameSubjectRecord?.accuracy !== undefined && Number(latestSameSubjectRecord.accuracy) < 75) {
    reasons.push(`${pack.subject}近期正确率${latestSameSubjectRecord.accuracy}%，建议补一轮基础`)
    score += 15
  }
  if (reasons.length === 0 && records.length === 0) {
    reasons.push('尚无学习记录，可作为首轮摸底练习')
    score += 8
  }
  if (reasons.length === 0) {
    reasons.push(pack.roundType === 'paper' ? '适合阶段检测和家长查看结果' : pack.roundType === 'special' ? '适合集中突破单类题型' : '适合日常同步巩固')
    score += 6
  }

  return {
    level: score >= 65 ? 'high' : score >= 30 ? 'medium' : 'normal',
    score,
    headline: reasons[0],
    reasons: reasons.slice(0, 3),
    matchedWrongPoints,
    matchedWeakPoints,
  }
}

const parseStoreDate = (value) => {
  const parsed = new Date(String(value || '').replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const isSameCalendarDate = (left, right) => (
  left && right &&
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate()
)

const isWithinRecentDays = (date, days) => {
  if (!date) return false
  const diff = Date.now() - date.getTime()
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000
}

const enrichPackForUser = (pack, user, userId = null) => ({
  ...pack,
  accessType: pack.accessType || (pack.isMemberOnly ? 'points' : 'free'),
  pointCost: Number(pack.pointCost || 0),
  owned: hasContentAccess(user, pack, userId),
  recommendation: buildPackRecommendation(pack, user),
})

const dashboardSummary = () => {
  const paidOrders = store.orders.filter(order => order.status === 'paid')
  const totalQuestions = store.learningRecords.reduce((sum, record) => sum + record.total, 0)
  const correctQuestions = store.learningRecords.reduce((sum, record) => sum + record.correct, 0)
  const today = new Date()
  const todayRecords = store.learningRecords.filter(record => isSameCalendarDate(parseStoreDate(record.completedAt), today))
  const todayPractice = todayRecords.reduce((sum, record) => sum + Number(record.total || 0), 0)
  const todayRevenue = paidOrders
    .filter(order => isSameCalendarDate(parseStoreDate(order.paidAt || order.createdAt), today))
    .reduce((sum, order) => sum + Number(order.amount || 0), 0)

  return {
    totalUsers: store.users.length,
    activeUsers: store.users.filter(user => isWithinRecentDays(parseStoreDate(user.lastActive), 7)).length,
    paidUsers: store.users.filter(user => user.memberStatus === 'active').length,
    pointUsers: store.users.filter(user => Number(user.pointsBalance || 0) > 0).length,
    pointsIssued: store.users.reduce((sum, user) => sum + Number(user.pointsTotalEarned || 0), 0),
    pointsSpent: store.users.reduce((sum, user) => sum + Number(user.pointsTotalSpent || 0), 0),
    todayRevenue,
    todayPractice,
    wrongQuestions: store.wrongQuestions.filter(item => !item.mastered).length,
    accuracyRate: totalQuestions ? Math.round((correctQuestions / totalQuestions) * 100) : 0,
    generatedQuestions: store.questions.length,
    hotPacks: store.questionPacks
      .slice()
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5),
    errorPoints: store.knowledgePoints
      .slice()
      .sort((a, b) => b.wrongRate - a.wrongRate)
      .slice(0, 5),
    subjectScores: buildSubjectScores(),
  }
}

const countBy = (items, getKey) => items.reduce((result, item) => {
  const key = getKey(item) || '未标注'
  result[key] = (result[key] || 0) + 1
  return result
}, {})

const buildQuestionBankQualityReport = () => {
  const packs = store.questionPacks || []
  const questions = store.questions || []
  const packIds = new Set(packs.map(pack => String(pack.id)))
  const questionsByPack = questions.reduce((result, question) => {
    const packId = String(question.packId || '')
    result[packId] ||= []
    result[packId].push(question)
    return result
  }, {})
  const normalizedContentCount = questions.reduce((result, question) => {
    const key = String(question.content || '').replace(/\s+/g, '')
    if (key) result[key] = (result[key] || 0) + 1
    return result
  }, {})

  const requiredQuestionFields = [
    'content',
    'answer',
    'explanation',
    'knowledgePoint',
    'domain',
    'difficultyTier',
    'masteryStage',
    'variantType',
    'ability',
    'literacyDimension',
    'cognitiveLevel',
    'scenarioType',
    'commonMistake',
    'answerMethod',
    'answerTemplate',
    'parentTip',
    'scoringRubric',
    'curriculumNode',
    'sourceBlueprint',
    'reviewStatus',
    'sourcePolicy',
    'expertTeacherLens',
    'teachingIntent',
    'stemDesign',
    'solutionSteps',
    'keyCheckpoint',
    'misconceptionDiagnosis',
    'variantIntent',
    'classroomReviewScript',
    'parentReviewScript',
    'gradingPoints',
    'extensionPrompt',
    'contentQualityLevel',
    'originalStem',
    'variantFamily',
    'tierTaskPrompt',
    'tierTaskAnswer',
  ]
  const missingMetadata = questions.filter(question =>
    requiredQuestionFields.some(field => {
      const value = question[field]
      return !value || (Array.isArray(value) && value.length === 0)
    })
  )
  const duplicateQuestions = Object.entries(normalizedContentCount)
    .filter(([, count]) => count > 1)
    .map(([contentKey, count]) => ({ contentKey, count }))
  const countMismatches = packs
    .map(pack => ({
      id: pack.id,
      name: pack.name,
      expected: Number(pack.questionCount || 0),
      actual: (questionsByPack[String(pack.id)] || []).length,
    }))
    .filter(item => item.expected !== item.actual)
  const lowCoveragePacks = packs.filter(pack => {
    const actual = (questionsByPack[String(pack.id)] || []).length
    if (pack.series === 'textbook') return actual < 20
    if (pack.series === 'special') return actual < 24
    if (pack.series === 'paper') return actual < 30
    return actual < 10
  })
  const orphanQuestions = questions.filter(question => !packIds.has(String(question.packId)))
  const reviewQueue = questions.filter(question => question.reviewStatus && question.reviewStatus !== 'published')
  const missingDistractorAnalysis = questions.filter(question => question.type === '选择题' && !question.distractorAnalysis)
  const weakExpertDesign = questions.filter(question => (
    !Array.isArray(question.solutionSteps) || question.solutionSteps.length < 3 ||
    !Array.isArray(question.gradingPoints) || question.gradingPoints.length < 3 ||
    !String(question.explanation || '').includes('解题步骤') ||
    !String(question.explanation || '').includes('错因提醒') ||
    !String(question.explanation || '').includes('讲评建议')
  ))
  const thinQuestionBody = questions.filter(question => (
    String(question.content || '').replace(/\s+/g, '').length < 70 ||
    String(question.explanation || '').replace(/\s+/g, '').length < 120 ||
    !String(question.content || '').includes('任务：') ||
    (!String(question.content || '').includes('题组角色') && !String(question.content || '').includes('Item role'))
  ))
  const mechanicalOriginalStem = questions.filter(question => /^(计算：|解方程：|.*练习题\s*\d+$)/.test(String(question.originalStem || '').trim()))
  const lowProfessionalPacks = packs.filter((pack) => {
    const actualQuestions = questionsByPack[String(pack.id)] || []
    const professionalFieldsMissing = !pack.productPositioning
      || !pack.suitableScene
      || !pack.diagnosticFocus
      || !pack.prerequisite
      || !Array.isArray(pack.learningObjectives) || pack.learningObjectives.length < 2
      || !Array.isArray(pack.targetAbility) || pack.targetAbility.length < 2
      || !Array.isArray(pack.curriculumTags) || pack.curriculumTags.length < 1
    const cognitiveCount = new Set(actualQuestions.map(question => question.cognitiveLevel).filter(Boolean)).size
    const domainCount = new Set(actualQuestions.map(question => question.domain).filter(Boolean)).size
    const difficultyCount = new Set(actualQuestions.map(question => question.difficultyTier).filter(Boolean)).size
    const masteryStageCount = new Set(actualQuestions.map(question => question.masteryStage).filter(Boolean)).size
    const insufficientDistribution = pack.series === 'paper'
      ? cognitiveCount < 3 || domainCount < 2 || difficultyCount < 4 || masteryStageCount < 4
      : cognitiveCount < 2 || domainCount < 1 || difficultyCount < 3 || masteryStageCount < 3
    return professionalFieldsMissing || insufficientDistribution
  })
  const qualityScores = questions.map(question => Number(question.qualityScore || 0)).filter(Boolean)
  const avgQualityScore = qualityScores.length
    ? Math.round(qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length)
    : 0
  const countUnique = (items, getKey) => Object.keys(countBy(items, getKey)).length

  const issues = [
    missingMetadata.length ? { level: 'high', title: '题目质量字段缺失', count: missingMetadata.length, action: '补齐答案、解析、能力、易错点和审核状态' } : null,
    orphanQuestions.length ? { level: 'high', title: '存在未归属题目', count: orphanQuestions.length, action: '重新绑定题包或移入单题池' } : null,
    missingDistractorAnalysis.length ? { level: 'medium', title: '选择题缺少干扰项分析', count: missingDistractorAnalysis.length, action: '补充干扰项设计逻辑，增强题库教研说明力' } : null,
    weakExpertDesign.length ? { level: 'medium', title: '名师命题资产不足', count: weakExpertDesign.length, action: '补齐步骤解析、错因诊断、变式意图、评分要点和讲评脚本' } : null,
    thinQuestionBody.length ? { level: 'medium', title: '题干或解析内容偏薄', count: thinQuestionBody.length, action: '补充真实材料、明确任务、作答要求和充分解析' } : null,
    mechanicalOriginalStem.length ? { level: 'medium', title: '核心题干仍偏机械', count: mechanicalOriginalStem.length, action: '把裸计算、裸方程或泛化练习题改成有材料和任务的题目' } : null,
    countMismatches.length ? { level: 'medium', title: '题包题量不一致', count: countMismatches.length, action: '刷新题包题量或检查调题记录' } : null,
    duplicateQuestions.length ? { level: 'medium', title: '疑似重复题干', count: duplicateQuestions.length, action: '进入单题库去重或改造成变式题' } : null,
    lowCoveragePacks.length ? { level: 'medium', title: '低覆盖题包', count: lowCoveragePacks.length, action: '补足题量后再对外售卖' } : null,
    lowProfessionalPacks.length ? { level: 'medium', title: '专业题库字段或分布不足', count: lowProfessionalPacks.length, action: '补齐教学目标、适用场景、认知层级和领域分布' } : null,
    reviewQueue.length ? { level: 'low', title: '待审核题目', count: reviewQueue.length, action: '完成老师审核后发布' } : null,
  ].filter(Boolean)

  return {
    readiness: issues.some(issue => issue.level === 'high') ? 'needs_fix' : issues.length ? 'watch' : 'ready',
    summary: {
      packs: packs.length,
      questions: questions.length,
      knowledgePoints: store.knowledgePoints.length,
      avgQualityScore,
      averageQuestionsPerPack: Math.round((questions.length / Math.max(1, packs.length)) * 10) / 10,
      domainCount: countUnique(questions, question => question.domain),
      difficultyTierCount: countUnique(questions, question => question.difficultyTier),
      masteryStageCount: countUnique(questions, question => question.masteryStage),
      cognitiveLevelCount: countUnique(questions, question => question.cognitiveLevel),
      sceneTypeCount: countUnique(questions, question => question.scenarioType),
      contentQualityLevelCount: countUnique(questions, question => question.contentQualityLevel),
      variantFamilyCount: countUnique(questions, question => question.variantFamily),
    },
    bySeries: countBy(packs, pack => pack.seriesName || pack.series),
    bySubject: countBy(questions, question => question.subject),
    byDomain: countBy(questions, question => question.domain),
    byDifficultyTier: countBy(questions, question => question.difficultyTier),
    byMasteryStage: countBy(questions, question => question.masteryStage),
    byCognitiveLevel: countBy(questions, question => question.cognitiveLevel),
    byScenarioType: countBy(questions, question => question.scenarioType),
    byContentQualityLevel: countBy(questions, question => question.contentQualityLevel),
    byVariantFamily: countBy(questions, question => question.variantFamily),
    bySource: countBy(packs, pack => pack.sourceLabel || pack.source),
    reviewStatus: countBy(questions, question => question.reviewStatus || 'published'),
    qualityTier: countBy(packs, pack => pack.qualityTier || '标准'),
    issues,
    samples: {
      missingMetadata: missingMetadata.slice(0, 5).map(question => ({ id: question.id, content: question.content, packId: question.packId })),
      countMismatches: countMismatches.slice(0, 5),
      lowCoveragePacks: lowCoveragePacks.slice(0, 5).map(pack => ({ id: pack.id, name: pack.name, questionCount: questionsByPack[String(pack.id)]?.length || 0 })),
      duplicateQuestions: duplicateQuestions.slice(0, 5),
      weakExpertDesign: weakExpertDesign.slice(0, 5).map(question => ({ id: question.id, content: question.content, packId: question.packId })),
      thinQuestionBody: thinQuestionBody.slice(0, 5).map(question => ({ id: question.id, content: question.content, packId: question.packId })),
      mechanicalOriginalStem: mechanicalOriginalStem.slice(0, 5).map(question => ({ id: question.id, originalStem: question.originalStem, packId: question.packId })),
      lowProfessionalPacks: lowProfessionalPacks.slice(0, 5).map(pack => ({
        id: pack.id,
        name: pack.name,
        series: pack.series,
        objectives: Array.isArray(pack.learningObjectives) ? pack.learningObjectives.length : 0,
      })),
    },
  }
}

const buildCurrentProductReadinessReport = () => buildProductReadinessReport(store)

const buildCurrentCommercialLaunchReport = () => buildCommercialLaunchReadinessReport(store, process.env)

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const buildOperationalReadinessReport = async () => {
  const commercial = buildCurrentCommercialLaunchReport()
  const integrations = buildLaunchIntegrationStatus(process.env)
  const frontendReady = await fileExists(path.join(frontendDistDir, 'index.html'))
  const adminReady = await fileExists(path.join(adminDistDir, 'index.html'))
  const checks = [
    { name: 'frontend_static', ok: frontendReady, detail: frontendDistDir },
    { name: 'admin_static', ok: adminReady, detail: adminDistDir },
    { name: 'data_layer', ok: !IS_PRODUCTION_RUNTIME || storePersistence.dataLayer === 'postgres', detail: storePersistence.dataLayer },
    { name: 'object_storage', ok: !IS_PRODUCTION_RUNTIME || integrations.objectStorage.configured, detail: integrations.objectStorage.provider },
    { name: 'monitoring', ok: !IS_PRODUCTION_RUNTIME || integrations.monitoring.configured, detail: integrations.monitoring.provider },
    { name: 'payment_deferred', ok: !IS_PRODUCTION_RUNTIME || isPaymentLaunchDeferred(), detail: isPaymentLaunchDeferred() ? 'deferred' : 'active' },
    { name: 'commercial_launch_gate', ok: !IS_PRODUCTION_RUNTIME || commercial.readiness === 'launch_ready', detail: commercial.readiness },
  ]
  return {
    ready: checks.every(item => item.ok),
    environment: process.env.TIXIAOZHU_ENV || process.env.NODE_ENV || 'development',
    service: 'tixiaozhu-backend',
    dataLayer: storePersistence.dataLayer,
    paymentLaunchStrategy: isPaymentLaunchDeferred() ? 'deferred' : 'production',
    integrations,
    checks,
  }
}

const buildQuestionBankCoverageReport = () => {
  const packs = store.questionPacks || []
  const questions = store.questions || []
  const knowledgePoints = store.knowledgePoints || []
  const packById = new Map(packs.map(pack => [String(pack.id), pack]))

  const rows = knowledgePoints.map((point) => {
    const matchedQuestions = questions.filter((question) => (
      question.subject === point.subject &&
      question.knowledgePoint === point.name
    ))
    const matchedPacks = Array.from(new Set(matchedQuestions.map(question => String(question.packId || '')).filter(Boolean)))
      .map(id => packById.get(id))
      .filter(Boolean)

    const seriesCoverage = {
      textbook: matchedPacks.filter(pack => pack.series === 'textbook').length,
      special: matchedPacks.filter(pack => pack.series === 'special').length,
      paper: matchedPacks.filter(pack => pack.series === 'paper').length,
    }
    const cognitiveLevels = countBy(matchedQuestions, question => question.cognitiveLevel)
    const scenarioTypes = countBy(matchedQuestions, question => question.scenarioType)
    const questionTypes = countBy(matchedQuestions, question => question.type)
    const difficultyTiers = countBy(matchedQuestions, question => question.difficultyTier)
    const grades = Array.from(new Set(matchedQuestions.map(question => question.grade).filter(Boolean)))
    const domainCoverage = Array.from(new Set(matchedQuestions.map(question => question.domain).filter(Boolean)))
    const averageQualityScore = matchedQuestions.length
      ? Math.round(matchedQuestions.reduce((sum, question) => sum + Number(question.qualityScore || 0), 0) / matchedQuestions.length)
      : 0

    let score = 0
    if (seriesCoverage.textbook > 0) score += 35
    if (seriesCoverage.special > 0) score += 25
    if (seriesCoverage.paper > 0) score += 20
    score += Math.min(10, Object.keys(cognitiveLevels).length * 3)
    score += Math.min(5, Object.keys(scenarioTypes).length)
    score += Math.min(5, Object.keys(difficultyTiers).length)
    score += Math.min(5, Math.floor(matchedQuestions.length / 12))
    score = Math.min(100, score)

    const issues = []
    if (seriesCoverage.textbook === 0) issues.push('缺教材同步')
    if (seriesCoverage.special === 0) issues.push('缺专项训练')
    if (seriesCoverage.paper === 0) issues.push('缺试卷诊断')
    if (matchedQuestions.length < 40) issues.push('题量偏少')
    if (Object.keys(cognitiveLevels).length < 3) issues.push('认知层级不足')
    if (Object.keys(difficultyTiers).length < 3) issues.push('难度梯度不足')
    if (Object.keys(questionTypes).length < 3) issues.push('题型分布偏窄')

    const status = score >= 90 && matchedQuestions.length >= 48
      ? 'leading'
      : score >= 75
        ? 'strong'
        : score >= 60
          ? 'developing'
          : 'weak'

    return {
      id: point.id,
      subject: point.subject,
      name: point.name,
      chapter: point.chapter,
      stage: point.stage,
      gradeRange: point.gradeRange,
      wrongRate: Number(point.wrongRate || 0),
      questionCount: matchedQuestions.length,
      packCount: matchedPacks.length,
      seriesCoverage,
      cognitiveLevels,
      scenarioTypes,
      questionTypes,
      difficultyTiers,
      grades,
      domainCoverage,
      averageQualityScore,
      coverageScore: score,
      status,
      issues,
      roundAdvice: point.roundAdvice,
    }
  })

  const summary = {
    knowledgePoints: rows.length,
    averageCoverageScore: rows.length
      ? Math.round(rows.reduce((sum, row) => sum + row.coverageScore, 0) / rows.length)
      : 0,
    leadingCount: rows.filter(row => row.status === 'leading').length,
    strongCount: rows.filter(row => row.status === 'strong').length,
    weakCount: rows.filter(row => row.status === 'weak').length,
    missingSeriesPoints: rows.filter(row => row.seriesCoverage.special === 0 || row.seriesCoverage.paper === 0 || row.seriesCoverage.textbook === 0).length,
  }

  return {
    summary,
    gaps: rows
      .filter(row => row.issues.length > 0)
      .sort((a, b) => a.coverageScore - b.coverageScore || b.wrongRate - a.wrongRate)
      .slice(0, 12),
    strongest: rows
      .slice()
      .sort((a, b) => b.coverageScore - a.coverageScore || b.questionCount - a.questionCount)
      .slice(0, 12),
    items: rows
      .slice()
      .sort((a, b) => a.coverageScore - b.coverageScore || b.wrongRate - a.wrongRate),
  }
}

const buildKnowledgePointCoachText = (pointId) => {
  const report = buildQuestionBankCoverageReport()
  const point = (store.knowledgePoints || []).find(item => String(item.id) === String(pointId))
  if (!point) {
    const error = new Error('Knowledge point not found')
    error.status = 404
    throw error
  }

  const coverage = report.items.find(item => String(item.id) === String(pointId)) || null
  const relatedQuestions = (store.questions || [])
    .filter(question => question.knowledgePoint === point.name && question.subject === point.subject)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))

  const pickedQuestions = []
  const seenTiers = new Set()
  for (const question of relatedQuestions) {
    const tier = question.difficultyTier || '常规'
    if (!seenTiers.has(tier)) {
      pickedQuestions.push(question)
      seenTiers.add(tier)
    }
    if (pickedQuestions.length >= 4) break
  }
  relatedQuestions.forEach((question) => {
    if (pickedQuestions.length >= 6) return
    if (!pickedQuestions.includes(question)) pickedQuestions.push(question)
  })

  const trainingCoverageText = coverage ? [
    `教材同步：${coverage.seriesCoverage.textbook} 包`,
    `专项训练：${coverage.seriesCoverage.special} 包`,
    `试卷诊断：${coverage.seriesCoverage.paper} 包`,
  ].join(' / ') : '暂无覆盖数据'

  const difficultyTiers = coverage ? Object.keys(coverage.difficultyTiers || {}) : []
  const cognitiveLevels = coverage ? Object.keys(coverage.cognitiveLevels || {}) : []

  const lines = [
    `${point.subject} · ${point.gradeRange} · ${point.name} 补弱讲义`,
    `章节：${point.chapter || '-'} | 学段：${point.stage || '-'} | 当前错误率：${point.wrongRate || 0}%`,
    '',
    '一、知识点定位',
    `训练覆盖：${trainingCoverageText}`,
    `覆盖评分：${coverage?.coverageScore ?? '-'} / 100`,
    `难度梯度：${difficultyTiers.length > 0 ? difficultyTiers.join('、') : '暂无'}`,
    `认知层级：${cognitiveLevels.length > 0 ? cognitiveLevels.join('、') : '暂无'}`,
    '',
    '二、讲评重点',
    point.teachingFocus || '暂无讲评重点',
    point.explanationScript || '暂无讲评脚本',
    '',
    '三、家长辅导建议',
    point.parentCoach || '暂无家长辅导建议',
    point.recoveryAction || '暂无补弱路径',
    '',
    '四、高频错因',
    ...((point.commonMistakes || []).length > 0 ? point.commonMistakes.map(item => `- ${item}`) : ['- 暂无']),
    '',
    '五、补弱清单',
    ...((point.remediationChecklist || []).length > 0 ? point.remediationChecklist.map((item, index) => `${index + 1}. ${item}`) : ['1. 暂无']),
    '',
    '六、代表题示例',
    ...(pickedQuestions.length > 0 ? pickedQuestions.flatMap((question, index) => ([
      `第${index + 1}题｜${question.difficultyTier || question.difficulty || '常规'}｜${question.masteryStage || '-'}｜${question.variantType || question.type || '题目'}`,
      question.content || '',
      `答案：${question.answer || question.correctAnswer || '-'}`,
      `解析：${question.explanation || '暂无解析'}`,
      Array.isArray(question.gradingPoints) && question.gradingPoints.length > 0 ? `评分要点：${question.gradingPoints.join('；')}` : '',
      question.extensionPrompt ? `追问变式：${question.extensionPrompt}` : '',
      '',
    ].filter(Boolean))) : ['暂无代表题']),
  ]

  return {
    title: `${point.name}补弱讲义`,
    content: lines.join('\n'),
  }
}

const generateQuestions = (config) => {
  const count = Math.max(1, Math.min(Number(config.count || 5), 20))
  const base = config.knowledgePoint || '乘法运算'
  const type = config.questionType || '填空题'
  const subject = config.subject || '数学'
  const grade = config.grade || '四年级'

  return Array.from({ length: count }, (_, index) => {
    const common = {
      id: `gen-${Date.now()}-${index + 1}`,
      subject,
      grade,
      knowledgePoint: base,
      type,
      difficulty: config.difficulty || '中等',
      status: 'draft',
      source: 'ai_generated',
    }

    if (subject === '数学') {
      const a = 12 + index * 3
      const b = 4 + index
      if (type === '选择题') {
        const answer = a * b
        return {
          ...common,
          content: `${grade}数学：一盒彩笔有 ${a} 支，买 ${b} 盒一共有多少支？`,
          options: [`A. ${answer - a}`, `B. ${answer}`, `C. ${answer + b}`, `D. ${a + b}`],
          answer: 'B',
          explanation: `求 ${b} 盒共有多少支，用 ${a} × ${b} = ${answer}。`,
        }
      }

      if (type === '应用题') {
        return {
          ...common,
          content: `${grade}数学：图书角有 ${a * b} 本书，平均放到 ${b} 个书架上，每个书架放多少本？`,
          answer: `${a} 本`,
          explanation: `平均分用除法，${a * b} ÷ ${b} = ${a}。`,
        }
      }

      return {
        ...common,
        content: `${grade}数学：计算 ${a} × ${b} = ______`,
        answer: String(a * b),
        explanation: `${a} × ${b} = ${a * b}，可以先分解再计算。`,
      }
    }

    if (subject === '语文') {
      const sentence = index % 2 === 0
        ? '雨后的校园亮晶晶的，跑道边的小草直起了腰。'
        : '小女孩把书轻轻合上，望着窗外的云，心里有了新的想法。'
      if (type === '选择题') {
        return {
          ...common,
          content: `阅读句子：“${sentence}”这句话主要写了什么？`,
          options: ['A. 人物外貌', 'B. 场景或心情', 'C. 购物过程', 'D. 实验步骤'],
          answer: 'B',
          explanation: `句子通过景物或动作表现画面和心情，要结合关键词判断。`,
        }
      }

      if (type === '简答题') {
        return {
          ...common,
          content: `阅读句子：“${sentence}”请找出一个关键词，并说明它有什么作用。`,
          answer: '示例：亮晶晶，写出了雨后校园清新明亮的样子。',
          explanation: `简答题需要先找原文词语，再说明表达效果。`,
        }
      }

      return {
        ...common,
        content: `${grade}语文：请用“${base}”写一个完整句子。`,
        answer: `示例：我能围绕“${base}”写出一句意思完整的话。`,
        explanation: `句子要有完整意思，表达要围绕关键词。`,
      }
    }

    if (subject === '英语') {
      const name = index % 2 === 0 ? 'Amy' : 'Tom'
      if (type === '选择题') {
        return {
          ...common,
          content: `${name} likes apples. Which sentence has the same meaning?`,
          options: [`A. ${name} doesn't like apples.`, `B. ${name} likes apples.`, `C. ${name} is an apple.`, `D. Apples like ${name}.`],
          answer: 'B',
          explanation: `likes apples 表示“喜欢苹果”，同义句应保留主语和动作含义。`,
        }
      }

      if (type === '简答题') {
        return {
          ...common,
          content: `Read: “${name} goes to school at 8:00.” When does ${name} go to school?`,
          answer: 'At 8:00.',
          explanation: `题目问 When，要从句子中找到时间 at 8:00。`,
        }
      }

      return {
        ...common,
        content: `Fill in the blank: I ______ English songs. (like / likes)`,
        answer: 'like',
        explanation: `主语 I 后面用动词原形 like。`,
      }
    }

    if (type === '选择题') {
      return {
        ...common,
        content: `${common.grade}${common.subject}：关于“${base}”，下列说法正确的是？`,
        options: ['A. 概念可以忽略条件', 'B. 只看数字大小即可', 'C. 需要先确认定义和限制条件', 'D. 不需要写关键步骤'],
        answer: 'C',
        explanation: `围绕 ${base} 的题目需要先确认定义和限制条件，再判断选项是否符合。`,
      }
    }

    if (type === '应用题') {
      return {
        ...common,
        content: `${common.grade}${common.subject}：请用 ${base} 的方法解决第 ${index + 1} 个情境问题，并写出过程。`,
        answer: '过程完整且结论正确',
        explanation: `先提取题干条件，再把条件转化为 ${base} 的步骤，最后检查结论。`,
      }
    }

    if (type === '简答题') {
      return {
        ...common,
        content: `${common.grade}${common.subject}：简要说明 ${base} 的核心方法。`,
        answer: `说明 ${base} 的定义、步骤和注意点`,
        explanation: `简答题重点看概念是否准确、步骤是否完整、表达是否清楚。`,
      }
    }

    return {
      ...common,
      content: `${common.grade}${common.subject}：${base} 练习题 ${index + 1}`,
      answer: String((index + 1) * 100),
      explanation: `围绕 ${base} 的核心规则进行拆解，先确认条件，再写出关键步骤。`,
    }
  })
}

const extractJsonArray = (text) => {
  const value = String(text || '').trim()
  const start = value.indexOf('[')
  const end = value.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) throw new Error('AI response did not contain a JSON array')
  return JSON.parse(value.slice(start, end + 1))
}

const generateQuestionsWithProvider = async (config) => {
  const hasAiConfig = hasConfigValue(AI_API_KEY) && hasConfigValue(AI_API_BASE) && hasConfigValue(AI_MODEL)
  if (!hasAiConfig) {
    if (IS_PRODUCTION_RUNTIME) {
      const error = new Error('Production AI generation service is not configured')
      error.status = 503
      throw error
    }
    return generateQuestions(config)
  }

  const response = await fetch(`${AI_API_BASE.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.45,
      messages: [
        {
          role: 'system',
          content: '你是一名严谨的小学主科命题专家。只返回 JSON 数组，不要 Markdown。每题必须包含 id, subject, grade, knowledgePoint, type, difficulty, content, answer, explanation，可选 options。',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'generate_high_quality_questions',
            config,
            count: Math.max(1, Math.min(Number(config.count || 5), 20)),
            standards: ['情境真实', '答案明确', '解析分步骤', '避免机械重复题', '适合家长和老师复盘'],
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    const error = new Error(`AI generation service failed: HTTP ${response.status}`)
    error.status = 502
    throw error
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  const questions = extractJsonArray(content).map((question, index) => ({
    id: question.id || `ai-${Date.now()}-${index + 1}`,
    subject: question.subject || config.subject || '数学',
    grade: question.grade || config.grade || '四年级',
    knowledgePoint: question.knowledgePoint || config.knowledgePoint || '未命名知识点',
    type: question.type || config.questionType || '填空题',
    difficulty: question.difficulty || config.difficulty || '中等',
    status: 'draft',
    source: 'ai_generated',
    content: question.content,
    options: question.options,
    answer: question.answer,
    explanation: question.explanation,
  }))

  if (!questions.length || questions.some(question => !question.content || !question.answer || !question.explanation)) {
    const error = new Error('AI generation service returned incomplete questions')
    error.status = 502
    throw error
  }
  return questions
}

const recognizeUploadWithProvider = async (body) => {
  if (IS_PRODUCTION_RUNTIME && isOcrLaunchDeferred()) {
    const error = new Error('Photo recognition is deferred for this production release')
    error.status = 503
    throw error
  }

  if (!hasConfigValue(OCR_API_URL)) {
    if (IS_PRODUCTION_RUNTIME) {
      const error = new Error('Production OCR service is not configured')
      error.status = 503
      throw error
    }
    return {
      recognizedText: '计算：125 × 8 = ?',
      question: {
        id: `upload-${Date.now()}`,
        content: '计算：125 × 8 = ?',
        type: '填空题',
        answer: '1000',
        explanation: '125 × 8 = 1000，可以拆分为 125 × 4 × 2。',
        knowledgePoint: '乘法运算',
        subject: '数学',
        difficulty: '基础',
      },
    }
  }

  const response = await fetch(OCR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(hasConfigValue(AI_API_KEY) ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = new Error(`OCR service failed: HTTP ${response.status}`)
    error.status = 502
    throw error
  }
  return response.json()
}

const submitGenerationForReview = (body) => {
  const questions = Array.isArray(body.questions) ? body.questions : []
  const config = body.config || {}
  const createdAt = new Date()
  const record = {
    id: `AI${String((store.aiGenerationHistory?.length || 0) + 1).padStart(3, '0')}`,
    subject: config.subject || questions[0]?.subject || '数学',
    grade: config.grade || questions[0]?.grade || '四年级',
    knowledgePoint: config.knowledgePoint || questions[0]?.knowledgePoint || '未命名知识点',
    count: questions.length,
    status: store.settings.contentReviewRequired ? 'review' : 'published',
    source: 'ai_generated',
    createdAt: formatDateTime(createdAt),
  }

  store.aiGenerationHistory ||= []
  store.aiGenerationHistory.unshift(record)
  store.questions.push(...questions.map((question) => ({
    ...question,
    id: `${question.id}-review`,
    status: record.status,
    source: 'ai_generated',
  })))
  scheduleStorePersist()

  return record
}

const paymentChannels = {
  wechat_pay: '微信支付',
  alipay: '支付宝',
}

const getActiveMembershipPlan = (planId) => {
  const plan = store.membershipPlans.find(item => item.id === planId && item.status === 'active')
  if (!plan) {
    const error = new Error('Membership plan not found')
    error.status = 400
    throw error
  }
  return plan
}

const activateMembership = (order, paidAt = new Date()) => {
  const expireDate = new Date(paidAt.getTime() + Number(order.duration || 30) * 24 * 60 * 60 * 1000)
  order.status = 'paid'
  order.paymentStatus = 'paid'
  order.paidAt = formatDateTime(paidAt)
  order.expireDate = formatDate(expireDate)

  const user = order.userId !== undefined && order.userId !== null && String(order.userId) !== ''
    ? store.users.find(item => Number(item.id) === Number(order.userId))
    : store.users.find(item => item.nickname === order.user)
  if (user) {
    user.memberStatus = 'active'
    user.memberPlan = order.plan
    user.expireDate = order.expireDate
    user.lastActive = formatDate(paidAt)
  }

  return order
}

const createPaidOrder = (body) => {
  requirePaymentLaunchAvailable()
  const createdAt = new Date()
  const order = {
    id: `ORD${String(store.orders.length + 1).padStart(3, '0')}`,
    userId: body.userId || null,
    user: body.user || '同学',
    plan: body.plan || body.planId || '会员',
    planId: body.planId || null,
    amount: Number(body.amount || 0),
    duration: Number(body.duration || 30),
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: body.paymentMethod || '微信支付',
    provider: body.provider || 'wechat_pay',
    transactionId: null,
    createdAt: formatDateTime(createdAt),
    paidAt: null,
    expireDate: '-',
  }

  store.orders.unshift(order)
  scheduleStorePersist()
  return activateMembership(order, createdAt)
}

const createPaymentSession = (body) => {
  requirePaymentLaunchAvailable()
  const createdAt = new Date()
  const provider = body.provider || 'wechat_pay'
  const plan = getActiveMembershipPlan(body.planId)
  const order = {
    id: `ORD${String(store.orders.length + 1).padStart(3, '0')}`,
    userId: body.userId || null,
    user: body.user || '同学',
    plan: plan.name,
    planId: plan.id,
    amount: Number(plan.price || 0),
    duration: Number(plan.duration || plan.durationDays || 30),
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: paymentChannels[provider] || provider,
    provider,
    transactionId: null,
    createdAt: formatDateTime(createdAt),
    paidAt: null,
    expireDate: '-',
  }

  const payment = {
    id: `PAY${String((store.payments?.length || 0) + 1).padStart(3, '0')}`,
    orderId: order.id,
    userId: order.userId,
    provider,
    channel: paymentChannels[provider] || provider,
    amount: order.amount,
    status: 'pending',
    transactionId: null,
    createdAt: formatDateTime(createdAt),
    paidAt: null,
    refundedAt: null,
    checkoutUrl: `testpay://checkout/${order.id}`,
  }

  store.orders.unshift(order)
  store.payments ||= []
  store.payments.unshift(payment)
  scheduleStorePersist()

  return {
    order,
    payment,
    mode: store.settings.paymentMode,
    checkoutUrl: payment.checkoutUrl,
    shouldAutoConfirm: store.settings.paymentMode === 'test',
  }
}

const confirmPayment = (body, options = {}) => {
  const payment = store.payments.find(item => item.id === body.paymentId || item.orderId === body.orderId)
  if (!payment) throw new Error('Payment not found')

  const order = store.orders.find(item => item.id === payment.orderId)
  if (!order) throw new Error('Order not found')
  if (options.enforceStudentOwner) {
    const sameUserId = body.userId !== undefined && body.userId !== null && String(body.userId) !== ''
      && String(payment.userId || order.userId || '') === String(body.userId)
    const sameUserName = normalizeUserName(body.user) && order.user === normalizeUserName(body.user)
    if (!sameUserId && !sameUserName) {
      const error = new Error('Payment does not belong to current student')
      error.status = 403
      throw error
    }
  }
  if (body.amount !== undefined && Number(body.amount) !== Number(payment.amount)) {
    const error = new Error('Payment amount mismatch')
    error.status = 409
    throw error
  }
  if (payment.status === 'paid' && order.paymentStatus === 'paid') return { order, payment, alreadyPaid: true }

  const paidAt = new Date()
  payment.status = 'paid'
  payment.paidAt = formatDateTime(paidAt)
  payment.transactionId = body.transactionId || `${payment.provider === 'alipay' ? 'ALI' : 'WX'}${Date.now()}`
  order.transactionId = payment.transactionId
  order.paymentMethod = payment.channel
  order.provider = payment.provider

  let pointTransaction = null
  if (order.orderType === 'points') {
    order.status = 'paid'
    order.paymentStatus = 'paid'
    order.paidAt = payment.paidAt
    const { transaction } = createPointTransaction({
      user: order.user,
      userId: order.userId,
      type: 'credit',
      action: 'purchase',
      points: Number(order.points || 0),
      note: `购买${order.plan}`,
      relatedId: order.id,
    })
    pointTransaction = transaction
  } else {
    activateMembership(order, paidAt)
  }
  scheduleStorePersist()

  return { order, payment, pointTransaction }
}

const refundPayment = (body) => {
  const payment = store.payments.find(item => item.id === body.paymentId || item.orderId === body.orderId)
  if (!payment) throw new Error('Payment not found')

  const order = store.orders.find(item => item.id === payment.orderId)
  if (!order) throw new Error('Order not found')

  const refundedAt = new Date()
  payment.status = 'refunded'
  payment.refundedAt = formatDateTime(refundedAt)
  order.status = 'refunded'
  order.paymentStatus = 'refunded'
  scheduleStorePersist()

  return { order, payment, reason: body.reason || '后台退款' }
}

const paymentWebhookPayloadToSign = (body) => [
  body.eventId || body.id || '',
  body.paymentId || '',
  body.orderId || '',
  body.status || '',
  body.amount ?? '',
  body.transactionId || '',
].join('|')

const verifyPaymentWebhookSignature = (body, req) => {
  if (!PAYMENT_WEBHOOK_SECRET) {
    const error = new Error('Payment webhook secret is not configured')
    error.status = 503
    throw error
  }

  const signature = String(req.headers['x-payment-signature'] || '')
  const expected = createHmac('sha256', PAYMENT_WEBHOOK_SECRET)
    .update(paymentWebhookPayloadToSign(body))
    .digest('hex')
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    const error = new Error('Invalid payment webhook signature')
    error.status = 401
    throw error
  }
}

const handlePaymentWebhook = (body, req) => {
  verifyPaymentWebhookSignature(body, req)

  const eventId = String(body.eventId || body.id || '').trim()
  if (!eventId) {
    const error = new Error('Missing payment webhook eventId')
    error.status = 400
    throw error
  }

  store.paymentWebhookEvents ||= []
  const existing = store.paymentWebhookEvents.find(item => item.eventId === eventId)
  if (existing) return { event: existing, duplicate: true }

  const payment = store.payments.find(item => (
    item.id === body.paymentId
    || item.orderId === body.orderId
    || item.transactionId === body.transactionId
  ))
  if (!payment) {
    const error = new Error('Payment not found')
    error.status = 404
    throw error
  }

  const normalizedStatus = String(body.status || '').toLowerCase()
  let result = null
  if (['paid', 'success', 'trade_success'].includes(normalizedStatus)) {
    result = confirmPayment({
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: body.amount,
      transactionId: body.transactionId,
    })
  } else if (['refunded', 'refund_success'].includes(normalizedStatus)) {
    result = refundPayment({
      paymentId: payment.id,
      orderId: payment.orderId,
      reason: body.reason || '支付平台回调退款',
    })
  } else {
    const error = new Error('Unsupported payment webhook status')
    error.status = 400
    throw error
  }

  const event = {
    eventId,
    paymentId: payment.id,
    orderId: payment.orderId,
    provider: body.provider || payment.provider,
    status: normalizedStatus,
    transactionId: body.transactionId || payment.transactionId || null,
    receivedAt: formatDateTime(new Date()),
    processedAt: formatDateTime(new Date()),
  }
  store.paymentWebhookEvents.unshift(event)
  scheduleStorePersist()
  return { event, result, duplicate: false }
}

const purchasePointPackage = (body) => {
  requirePaymentLaunchAvailable()
  const pack = store.pointPackages.find(item => item.id === body.packageId && item.status === 'active')
  if (!pack) throw new Error('Point package not found')

  const createdAt = new Date()
  const totalPoints = Number(pack.points || 0) + Number(pack.bonusPoints || 0)
  const user = normalizeUserName(body.user)
  const order = {
    id: `ORD-P${String(store.orders.length + 1).padStart(3, '0')}`,
    userId: body.userId || null,
    user,
    plan: pack.name,
    planId: pack.id,
    orderType: 'points',
    points: totalPoints,
    amount: Number(pack.price || 0),
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: paymentChannels[body.provider || 'wechat_pay'] || '微信支付',
    provider: body.provider || 'wechat_pay',
    transactionId: null,
    createdAt: formatDateTime(createdAt),
    paidAt: null,
    expireDate: '-',
  }
  const payment = {
    id: `PAY${String((store.payments?.length || 0) + 1).padStart(3, '0')}`,
    orderId: order.id,
    userId: order.userId,
    provider: order.provider,
    channel: order.paymentMethod,
    amount: order.amount,
    status: 'pending',
    transactionId: null,
    createdAt: order.createdAt,
    paidAt: null,
    refundedAt: null,
    checkoutUrl: `testpay://checkout/${order.id}`,
  }

  store.orders.unshift(order)
  store.payments ||= []
  store.payments.unshift(payment)

  if (store.settings.paymentMode === 'test') {
    const paidAt = new Date()
    payment.status = 'paid'
    payment.paidAt = formatDateTime(paidAt)
    payment.transactionId = `${payment.provider === 'alipay' ? 'ALI' : 'WX'}${Date.now()}`
    order.status = 'paid'
    order.paymentStatus = 'paid'
    order.paidAt = payment.paidAt
    order.transactionId = payment.transactionId
    const { account, transaction } = createPointTransaction({
      user,
      userId: body.userId,
      type: 'credit',
      action: 'purchase',
      points: totalPoints,
      note: `购买${pack.name}`,
      relatedId: order.id,
    })
    scheduleStorePersist()
    return { order, payment, package: pack, account: buildPointAccount(account.nickname, account.id), transaction }
  }

  scheduleStorePersist()
  return { order, payment, package: pack, account: buildPointAccount(user, body.userId), shouldAutoConfirm: false }
}

const spendPoints = (body) => {
  const action = body.action || 'manual'
  if (action !== 'content_purchase' || !body.packId) {
    const error = new Error('Use content purchase endpoint to spend points')
    error.status = 400
    throw error
  }
  return purchaseContentPack({
    user: body.user,
    userId: body.userId,
    packId: body.packId,
  })
}

const adjustPoints = (body) => {
  const points = Math.abs(Number(body.points || 0))
  const type = body.type === 'debit' ? 'debit' : 'credit'
  const { account, transaction } = createPointTransaction({
    user: body.user,
    userId: body.userId,
    type,
    action: body.action || 'admin_adjust',
    points,
    note: body.note || '后台积分调整',
    relatedId: body.relatedId,
    operator: body.operator || 'admin',
  })
  return { account: buildPointAccount(account.nickname, account.id), transaction }
}

const createUploadedQuestion = (body) => {
  const question = body.question || body
  const createdAt = new Date()
  const record = {
    id: `upl-${Date.now()}`,
    userId: body.userId || null,
    user: normalizeUserName(body.user || question.user),
    content: question.content || body.recognizedText || '未命名拍题',
    type: question.type || '填空题',
    subject: question.subject || '数学',
    knowledgePoint: question.knowledgePoint || '未归类知识点',
    difficulty: question.difficulty || '基础',
    answer: question.answer || body.correctAnswer || '',
    userAnswer: body.userAnswer || question.userAnswer || '',
    correctionStatus: body.correctionStatus || (body.isCorrect === false ? 'wrong' : body.isCorrect === true ? 'correct' : 'ungraded'),
    source: 'uploaded',
    sourceType: body.sourceType || 'photo',
    recognizedText: body.recognizedText || question.content || '',
    explanation: question.explanation || body.explanation || '',
    uploadedAt: formatDateTime(createdAt),
    lastPracticedAt: null,
    practiceCount: 0,
  }

  store.uploadedQuestions ||= []
  store.uploadedQuestions.unshift(record)
  scheduleStorePersist()
  return record
}

const purchaseContentPack = (body) => {
  const user = normalizeUserName(body.user)
  const pack = store.questionPacks.find(item => item.id === body.packId)
  if (!pack) throw new Error('Question pack not found')

  const pointCost = Number(pack.pointCost || 0)
  if ((pack.accessType || 'free') === 'free' || pointCost <= 0) {
    return {
      purchase: null,
      pack: enrichPackForUser(pack, user, body.userId),
      account: buildPointAccount(user, body.userId),
      alreadyOwned: true,
    }
  }

  store.contentPurchases ||= []
  const existing = store.contentPurchases.find(item => sameStudentOwner(item, { user, userId: body.userId }) && item.packId === pack.id)
  if (existing) {
    return {
      purchase: existing,
      pack: enrichPackForUser(pack, user, body.userId),
      account: buildPointAccount(user, body.userId),
      alreadyOwned: true,
    }
  }

  const { transaction } = createPointTransaction({
    user,
    userId: body.userId,
    type: 'debit',
    action: 'content_purchase',
    points: pointCost,
    note: `购买题包：${pack.name}`,
    relatedId: pack.id,
  })

  const purchase = {
    id: `CP${String(store.contentPurchases.length + 1).padStart(3, '0')}`,
    userId: body.userId || null,
    user,
    packId: pack.id,
    pointCost,
    title: pack.name,
    purchasedAt: formatDateTime(new Date()),
    pointTransactionId: transaction.id,
  }

  store.contentPurchases.unshift(purchase)
  scheduleStorePersist()
  return {
    purchase,
    pack: enrichPackForUser(pack, user, body.userId),
    account: buildPointAccount(user, body.userId),
    transaction,
    alreadyOwned: false,
  }
}

const refreshPackQuestionCount = (packId) => {
  const pack = store.questionPacks.find(item => item.id === packId)
  if (!pack) return null
  pack.questionCount = store.questions.filter(question => question.packId === pack.id).length
  invalidateQuestionPackPdf(pack.id)
  return pack
}

const questionsForPack = (packId) => store.questions
  .filter(question => String(question.packId) === String(packId))
  .sort((a, b) => Number(a.sortOrder ?? a.order ?? 9999) - Number(b.sortOrder ?? b.order ?? 9999))

const buildQuestionPackPrintHtml = (pack, user, options = {}) => {
  const interactive = options.interactive !== false
  const questions = questionsForPack(pack.id)
  const title = pack.name || '题包题目'
  const pdfUrl = `/api/question-packs/${encodeURIComponent(pack.id)}/export.pdf?user=${encodeURIComponent(normalizeUserName(user))}`
  const pdfStatusUrl = `/api/question-packs/${encodeURIComponent(pack.id)}/export-status?user=${encodeURIComponent(normalizeUserName(user))}`
  const pdfReady = questionPackPdfCache.has(String(pack.id))
  const coverage = Array.from(new Set([
    pack.unitName,
    ...(String(pack.coverage || '').split('、')),
    ...questions.map(question => question.knowledgePoint),
  ].map(item => String(item || '').trim()).filter(Boolean))).slice(0, 16)
  const typeCounts = questions.reduce((result, question) => {
    const type = question.type || '未分类'
    result[type] = (result[type] || 0) + 1
    return result
  }, {})

  const questionHtml = questions.map((question, index) => {
    const options = Array.isArray(question.options) ? question.options : []
    return `
      <article class="question">
        <div class="question-meta">第 ${index + 1} 题 · ${escapeHtml(question.type || '题目')} · ${escapeHtml(question.difficulty || '常规')} · ${escapeHtml(question.knowledgePoint || '未标注知识点')} · ${escapeHtml(question.ability || '能力训练')} · ${escapeHtml(question.contentQualityLevel || '高标准原创题')}</div>
        <div class="question-content">${escapeHtml(question.content || '')}</div>
        <div class="question-design">${escapeHtml(question.teachingIntent || '')} ${escapeHtml(question.stemDesign || '')}</div>
        ${options.length > 0 ? `<ol class="options">${options.map(option => `<li>${escapeHtml(option)}</li>`).join('')}</ol>` : ''}
        <div class="answer-space"></div>
      </article>
    `
  }).join('')

  const formatQuestionAnalysisHtml = (question) => [
    question.explanation || '暂无解析',
    Array.isArray(question.gradingPoints) && question.gradingPoints.length > 0 ? `评分要点：${question.gradingPoints.join('；')}` : '',
    question.variantIntent ? `变式价值：${question.variantIntent}` : '',
  ].filter(Boolean).map(item => escapeHtml(item)).join('<br />')

  const answerHtml = questions.map((question, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(question.answer || question.correctAnswer || '')}</td>
      <td>${formatQuestionAnalysisHtml(question)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f5f5f4;
      color: #1c1917;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      line-height: 1.6;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      background: rgba(255,255,255,.92);
      border-bottom: 1px solid #e7e5e4;
      backdrop-filter: blur(10px);
    }
    .toolbar-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    .toolbar button {
      border: 0;
      border-radius: 8px;
      background: #1c1917;
      color: white;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .toolbar .download-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      border: 0;
      border-radius: 8px;
      background: #1c1917;
      color: white;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
    }
    .toolbar .download-link.is-loading {
      background: #44403c;
    }
    .toolbar .download-link.is-disabled {
      pointer-events: none;
      opacity: .72;
    }
    .toolbar button.secondary {
      border: 1px solid #d6d3d1;
      background: white;
      color: #44403c;
    }
    .download-status {
      width: 100%;
      color: #78716c;
      font-size: 12px;
      text-align: right;
    }
    .page {
      width: min(920px, calc(100% - 32px));
      margin: 24px auto;
      background: white;
      padding: 36px;
      border: 1px solid #e7e5e4;
      border-radius: 8px;
    }
    h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.25; }
    h2 { margin: 32px 0 12px; font-size: 20px; }
    .muted { color: #78716c; font-size: 14px; }
    .summary-line {
      margin-top: 8px;
      color: #57534e;
      font-size: 15px;
      font-weight: 700;
    }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .tag {
      border-radius: 999px;
      background: #f5f5f4;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
      color: #57534e;
    }
    .question {
      break-inside: avoid;
      border-top: 1px solid #e7e5e4;
      padding: 18px 0;
    }
    .question-meta { color: #78716c; font-size: 13px; font-weight: 700; }
    .question-content { margin-top: 8px; font-size: 17px; }
    .question-design { margin-top: 6px; color: #57534e; font-size: 13px; }
    .options {
      margin: 10px 0 0;
      padding-left: 24px;
      display: grid;
      gap: 4px;
    }
    .answer-space {
      height: 44px;
      margin-top: 14px;
      border-bottom: 1px dashed #d6d3d1;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      border: 1px solid #e7e5e4;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    th { background: #f5f5f4; }
    @page { size: A4; margin: 14mm; }
    @media print {
      body { background: white; }
      .toolbar { display: none; }
      .page {
        width: auto;
        margin: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
      }
      h2 { break-after: avoid; }
      .answer-key { break-before: page; }
    }
  </style>
</head>
<body>
  ${interactive ? `<div class="toolbar">
    <div>
      <strong>${escapeHtml(pack.name || '题包')}</strong>
      <span class="muted">可下载 PDF 文件</span>
    </div>
    <div class="toolbar-actions">
      <button class="secondary" onclick="if (window.history.length > 1) { window.history.back() } else { window.location.href='${escapeHtml(FRONTEND_URL)}' }">返回题库</button>
      <a
        class="download-link${pdfReady ? '' : ' is-loading is-disabled'}"
        data-download-link
        data-ready="${pdfReady ? 'true' : 'false'}"
        href="${pdfReady ? escapeHtml(pdfUrl) : '#pdf-not-ready'}"
        download="${escapeHtml(safeFileName(pack.name))}题目.pdf"
      >${pdfReady ? '保存PDF' : 'PDF准备中'}</a>
      <span class="download-status" data-download-status>${pdfReady ? 'PDF已准备好' : '正在预生成PDF，稍等几秒后即可下载'}</span>
    </div>
  </div>` : ''}
  <main class="page">
    <header>
      <h1>${escapeHtml(title)}</h1>
      <div class="summary-line">${escapeHtml(pack.grade || '-')} · ${escapeHtml(pack.subject || '-')} · ${questions.length}题 · ${Number(pack.estimatedTime || 15)}分钟 · ${escapeHtml(pack.seriesName || pack.roundType || '训练')}</div>
    </header>

    <section>
      <p>${escapeHtml(pack.structure || pack.description || '按题包顺序完成一轮训练。')}</p>
      <div class="tags">
        ${coverage.map(point => `<span class="tag">${escapeHtml(point)}</span>`).join('')}
      </div>
      <div class="tags">
        ${Object.entries(typeCounts).map(([type, count]) => `<span class="tag">${escapeHtml(type)} ${count}题</span>`).join('')}
        ${pack.sourceLabel ? `<span class="tag">${escapeHtml(pack.sourceLabel)}</span>` : ''}
        ${pack.qualityTier ? `<span class="tag">${escapeHtml(pack.qualityTier)}</span>` : ''}
      </div>
      ${pack.sourcePolicy ? `<p class="muted">${escapeHtml(pack.sourcePolicy)}</p>` : ''}
    </section>

    <section>
      <h2>题目</h2>
      ${questionHtml || '<p class="muted">暂无题目。</p>'}
    </section>

    <section class="answer-key">
      <h2>答案与解析</h2>
      <table>
        <thead><tr><th style="width: 64px;">题号</th><th style="width: 120px;">答案</th><th>解析</th></tr></thead>
        <tbody>${answerHtml || '<tr><td colspan="3">暂无答案。</td></tr>'}</tbody>
      </table>
    </section>
  </main>
  ${interactive ? `<script>
    (function () {
      var link = document.querySelector('[data-download-link]');
      var status = document.querySelector('[data-download-status]');
      if (!link || !status) return;
      var pdfUrl = '${escapeHtml(pdfUrl)}';
      var statusUrl = '${escapeHtml(pdfStatusUrl)}';

      function enableDownload() {
        link.href = pdfUrl;
        link.dataset.ready = 'true';
        link.textContent = '保存PDF';
        link.classList.remove('is-loading', 'is-disabled');
        status.textContent = 'PDF已准备好，点击即可下载';
      }

      function poll() {
        fetch(statusUrl, { cache: 'no-store' })
          .then(function (response) { return response.json(); })
          .then(function (payload) {
            if (payload && payload.data && payload.data.ready) {
              enableDownload();
              return;
            }
            if (payload && payload.data && payload.data.error) {
              status.textContent = 'PDF生成失败，请刷新后重试';
              link.textContent = '重新准备';
              link.classList.remove('is-disabled');
              return;
            }
            status.textContent = 'PDF准备中，完成后会自动变成可下载';
            window.setTimeout(poll, 1000);
          })
          .catch(function () {
            status.textContent = '正在连接PDF生成服务...';
            window.setTimeout(poll, 1500);
          });
      }

      link.addEventListener('click', function (event) {
        if (link.dataset.ready !== 'true') {
          event.preventDefault();
          status.textContent = 'PDF还在准备，稍等一下';
          return;
        }
        status.textContent = '已开始下载。如果浏览器没有提示，请再点一次保存PDF';
      });

      if (link.dataset.ready !== 'true') poll();
    })();
  </script>` : ''}
</body>
</html>`
}

const buildQuestionPackPlainText = (pack) => {
  const questions = questionsForPack(pack.id)
  const lines = [
    pack.name || '题包题目',
    `${pack.grade || '-'} · ${pack.subject || '-'} · ${questions.length}题 · ${Number(pack.estimatedTime || 15)}分钟 · ${pack.seriesName || pack.roundType || '训练'}`,
    '',
    pack.structure || pack.description || '按题包顺序完成一轮训练。',
    '',
    '题目',
    '----------------------------------------',
  ]

  questions.forEach((question, index) => {
    lines.push(`第 ${index + 1} 题 · ${question.type || '题目'} · ${question.difficulty || '常规'} · ${question.knowledgePoint || '未标注知识点'}`)
    lines.push(question.content || '')
    if (Array.isArray(question.options) && question.options.length > 0) {
      question.options.forEach(option => lines.push(`  ${option}`))
    }
    lines.push('')
    lines.push('答：__________________________________________________')
    lines.push('')
  })

  lines.push('')
  lines.push('答案与解析')
  lines.push('----------------------------------------')
  questions.forEach((question, index) => {
    lines.push(`${index + 1}. 答案：${question.answer || question.correctAnswer || ''}`)
    lines.push(`   解析：${question.explanation || '暂无解析'}`)
    if (Array.isArray(question.gradingPoints) && question.gradingPoints.length > 0) {
      lines.push(`   评分要点：${question.gradingPoints.join('；')}`)
    }
    if (question.variantIntent) lines.push(`   变式价值：${question.variantIntent}`)
  })

  return `${lines.join('\n')}\n`
}

const renderQuestionPackPdfWithCups = async (pack) => {
  await fs.access(CUPS_FILTER_PATH)
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tixiaozhu-pdf-'))
  const textPath = path.join(tempDir, 'pack.txt')

  try {
    await fs.writeFile(textPath, buildQuestionPackPlainText(pack), 'utf8')
    const { stdout } = await execFileAsync(CUPS_FILTER_PATH, [
      '-i',
      'text/plain',
      '-m',
      'application/pdf',
      textPath,
    ], {
      encoding: 'buffer',
      env: { ...process.env, LANG: 'zh_CN.UTF-8' },
      maxBuffer: 20 * 1024 * 1024,
      timeout: 10000,
    })
    if (!Buffer.isBuffer(stdout) || stdout.subarray(0, 4).toString('utf8') !== '%PDF') {
      throw new Error('cupsfilter did not return a PDF')
    }
    return stdout
  } finally {
    fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

const encodePdfHexText = (text) => {
  const bytes = []
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    bytes.push((code >> 8) & 0xff, code & 0xff)
  }
  return Buffer.from(bytes).toString('hex').toUpperCase()
}

const wrapPdfLine = (line, maxLength = 42) => {
  if (line.length <= maxLength) return [line]
  const chunks = []
  for (let index = 0; index < line.length; index += maxLength) {
    chunks.push(line.slice(index, index + maxLength))
  }
  return chunks
}

const renderTextPdfFallback = (text, title = '导出') => {
  const sourceLines = [title, '', ...String(text || '').split(/\r?\n/)]
  const lines = sourceLines.flatMap(line => wrapPdfLine(line.replace(/\t/g, '  ')))
  const linesPerPage = 42
  const pageLines = []
  for (let index = 0; index < lines.length; index += linesPerPage) {
    pageLines.push(lines.slice(index, index + linesPerPage))
  }
  if (pageLines.length === 0) pageLines.push([''])

  const objects = []
  const addObject = (body) => {
    objects.push(body)
    return objects.length
  }

  const catalogId = addObject('CATALOG')
  const pagesId = addObject('PAGES')
  const fontDescriptorId = addObject('<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 700 /StemV 80 >>')
  const cidFontId = addObject(`<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /FontDescriptor ${fontDescriptorId} 0 R >>`)
  const fontId = addObject(`<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [${cidFontId} 0 R] >>`)
  const pageIds = []

  pageLines.forEach((page) => {
    const textOps = page
      .map(line => `<${encodePdfHexText(line || ' ')}> Tj T*`)
      .join('\n')
    const stream = `BT\n/F1 11 Tf\n14 TL\n50 790 Td\n${textOps}\nET`
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`)
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`)
    pageIds.push(pageId)
  })

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'binary'))
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefOffset = Buffer.byteLength(pdf, 'binary')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(pdf, 'binary')
}

const renderPlainTextPdf = async (text, title = '导出') => {
  try {
    await fs.access(CUPS_FILTER_PATH)
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tixiaozhu-pdf-'))
    const textPath = path.join(tempDir, `${safeFileName(title)}.txt`)

    try {
      await fs.writeFile(textPath, text, 'utf8')
      const { stdout } = await execFileAsync(CUPS_FILTER_PATH, [
        '-i',
        'text/plain',
        '-m',
        'application/pdf',
        textPath,
      ], {
        encoding: 'buffer',
        env: { ...process.env, LANG: 'zh_CN.UTF-8' },
        maxBuffer: 20 * 1024 * 1024,
        timeout: 10000,
      })
      if (!Buffer.isBuffer(stdout) || stdout.subarray(0, 4).toString('utf8') !== '%PDF') {
        throw new Error('cupsfilter did not return a PDF')
      }
      return stdout
    } finally {
      fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  } catch {
    return renderTextPdfFallback(text, title)
  }
}

const renderQuestionPackPdfWithChrome = async (pack, user) => {
  await fs.access(CHROME_PATH)
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tixiaozhu-pdf-'))
  const htmlPath = path.join(tempDir, 'pack.html')
  const pdfPath = path.join(tempDir, `${safeFileName(pack.name)}.pdf`)
  const profileDir = path.join(tempDir, 'chrome-profile')

  try {
    await fs.writeFile(htmlPath, buildQuestionPackPrintHtml(pack, user, { interactive: false }), 'utf8')
    await execFileAsync(CHROME_PATH, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      `--user-data-dir=${profileDir}`,
      '--print-to-pdf-no-header',
      `--print-to-pdf=${pdfPath}`,
      pathToFileURL(htmlPath).href,
    ], { timeout: 30000 })
    return await fs.readFile(pdfPath)
  } finally {
    fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

const renderQuestionPackPdf = async (pack, user) => {
  try {
    return await renderQuestionPackPdfWithCups(pack)
  } catch {
    try {
      return await renderQuestionPackPdfWithChrome(pack, user)
    } catch {
      return renderTextPdfFallback(buildQuestionPackPlainText(pack), pack.name)
    }
  }
}

const ensureQuestionPackPdf = (pack, user) => {
  const key = String(pack.id)
  const cached = questionPackPdfCache.get(key)
  if (cached?.buffer) return Promise.resolve(cached.buffer)
  const existingJob = questionPackPdfJobs.get(key)
  if (existingJob) return existingJob

  questionPackPdfErrors.delete(key)
  const job = renderQuestionPackPdf(pack, user)
    .then((buffer) => {
      questionPackPdfCache.set(key, {
        buffer,
        generatedAt: formatDateTime(new Date()),
      })
      questionPackPdfJobs.delete(key)
      return buffer
    })
    .catch((error) => {
      questionPackPdfJobs.delete(key)
      questionPackPdfErrors.set(key, error.message || 'PDF generation failed')
      throw error
    })
  questionPackPdfJobs.set(key, job)
  return job
}

const questionPackPdfStatus = (packId) => {
  const key = String(packId || '')
  const cached = questionPackPdfCache.get(key)
  return {
    ready: Boolean(cached?.buffer),
    generating: questionPackPdfJobs.has(key),
    generatedAt: cached?.generatedAt || null,
    error: questionPackPdfErrors.get(key) || null,
  }
}

const normalizePackQuestionOrder = (packId) => {
  questionsForPack(packId).forEach((question, index) => {
    question.sortOrder = index + 1
  })
}

const createQuestionPackVersion = (packId, action, summary, detail = {}) => {
  const pack = store.questionPacks.find(item => String(item.id) === String(packId))
  if (!pack) return null
  store.questionPackVersions ||= []
  const version = {
    id: `qpv-${Date.now()}-${store.questionPackVersions.length + 1}`,
    packId: pack.id,
    packName: pack.name,
    versionNo: (store.questionPackVersions.filter(item => item.packId === pack.id).length || 0) + 1,
    action,
    summary,
    detail,
    questionCount: Number(pack.questionCount || questionsForPack(pack.id).length || 0),
    createdAt: formatDateTime(new Date()),
    operator: detail.operator || 'admin',
  }
  store.questionPackVersions.unshift(version)
  return version
}

const updateQuestionPack = (id, body) => {
  const pack = store.questionPacks.find(item => item.id === id)
  if (!pack) {
    const error = new Error('Question pack not found')
    error.status = 404
    throw error
  }

  const allowedStatuses = new Set(['published', 'draft', 'review'])
  if (body.status !== undefined) {
    if (!allowedStatuses.has(body.status)) {
      const error = new Error('Invalid question pack status')
      error.status = 400
      throw error
    }
    pack.status = body.status
  }

  if (body.pointCost !== undefined) {
    const pointCost = Math.max(0, Number(body.pointCost || 0))
    pack.pointCost = pointCost
    pack.accessType = pointCost > 0 ? 'points' : 'free'
    pack.isMemberOnly = pointCost > 0
  }

  if (body.accessType !== undefined) {
    pack.accessType = body.accessType === 'points' ? 'points' : 'free'
    if (pack.accessType === 'free') pack.pointCost = 0
    pack.isMemberOnly = pack.accessType === 'points'
  }

  if (body.structure !== undefined) pack.structure = String(body.structure || '').trim()
  if (body.coverage !== undefined) pack.coverage = String(body.coverage || '').trim()

  refreshPackQuestionCount(pack.id)
  createQuestionPackVersion(pack.id, 'pack_update', '更新题包基础信息', {
    changes: body,
    operator: body.operator,
  })
  scheduleStorePersist()
  return pack
}

const reassignQuestion = (id, body) => {
  const question = store.questions.find(item => String(item.id) === String(id))
  if (!question) {
    const error = new Error('Question not found')
    error.status = 404
    throw error
  }

  const previousPackId = question.packId || null
  const nextPackId = body.packId || null
  if (nextPackId && !store.questionPacks.some(pack => pack.id === nextPackId)) {
    const error = new Error('Target question pack not found')
    error.status = 404
    throw error
  }

  question.packId = nextPackId
  if (nextPackId) {
    question.sortOrder = questionsForPack(nextPackId).length + 1
  } else {
    delete question.sortOrder
  }
  const affectedPacks = [previousPackId, nextPackId]
    .filter(Boolean)
    .filter((packId, index, list) => list.indexOf(packId) === index)
    .map((packId) => {
      normalizePackQuestionOrder(packId)
      return refreshPackQuestionCount(packId)
    })
    .filter(Boolean)

  const version = createQuestionPackVersion(nextPackId || previousPackId, nextPackId ? 'question_add' : 'question_remove', nextPackId ? '调入 1 道题' : '移出 1 道题', {
    questionIds: [question.id],
    fromPackId: previousPackId,
    toPackId: nextPackId,
    operator: body.operator,
  })
  scheduleStorePersist()

  return { question, affectedPacks, version }
}

const bulkAssignQuestions = (packId, body) => {
  const pack = store.questionPacks.find(item => String(item.id) === String(packId))
  if (!pack) {
    const error = new Error('Question pack not found')
    error.status = 404
    throw error
  }
  const action = body.action === 'remove' ? 'remove' : 'add'
  const questionIds = Array.isArray(body.questionIds) ? body.questionIds.map(String) : []
  const movedQuestions = store.questions.filter(question => questionIds.includes(String(question.id)))
  const affectedPackIds = new Set([pack.id])

  movedQuestions.forEach((question) => {
    if (question.packId) affectedPackIds.add(question.packId)
    if (action === 'remove') {
      if (String(question.packId) === String(pack.id)) {
        question.packId = null
        delete question.sortOrder
      }
      return
    }
    question.packId = pack.id
    question.sortOrder = questionsForPack(pack.id).length + 1
  })

  const affectedPacks = Array.from(affectedPackIds)
    .filter(Boolean)
    .map((id) => {
      normalizePackQuestionOrder(id)
      return refreshPackQuestionCount(id)
    })
    .filter(Boolean)

  const summary = action === 'remove'
    ? `批量移出 ${movedQuestions.length} 道题`
    : `批量调入 ${movedQuestions.length} 道题`
  const version = createQuestionPackVersion(pack.id, action === 'remove' ? 'question_bulk_remove' : 'question_bulk_add', summary, {
    questionIds: movedQuestions.map(question => question.id),
    operator: body.operator,
  })
  scheduleStorePersist()

  return {
    questions: movedQuestions,
    affectedPacks,
    version,
  }
}

const reorderPackQuestions = (packId, body) => {
  const pack = store.questionPacks.find(item => String(item.id) === String(packId))
  if (!pack) {
    const error = new Error('Question pack not found')
    error.status = 404
    throw error
  }
  const orderedIds = Array.isArray(body.questionIds) ? body.questionIds.map(String) : []
  const currentQuestions = questionsForPack(pack.id)
  const currentIds = currentQuestions.map(question => String(question.id))
  const validOrderedIds = orderedIds.filter(id => currentIds.includes(id))
  const missingIds = currentIds.filter(id => !validOrderedIds.includes(id))
  const nextIds = [...validOrderedIds, ...missingIds]

  nextIds.forEach((id, index) => {
    const question = store.questions.find(item => String(item.id) === id)
    if (question) question.sortOrder = index + 1
  })

  refreshPackQuestionCount(pack.id)
  const version = createQuestionPackVersion(pack.id, 'question_reorder', '调整题目顺序', {
    questionIds: nextIds,
    operator: body.operator,
  })
  scheduleStorePersist()

  return {
    questions: questionsForPack(pack.id),
    pack,
    version,
  }
}

const normalizeAnswerText = (value) => String(value ?? '')
  .trim()
  .replace(/\s+/g, '')
  .replace(/[。．.，,；;：:！!？?]$/g, '')
  .toUpperCase()

const resolveQuestion = (questionId, fallbackQuestion) => {
  const question = store.questions.find(item => String(item.id) === String(questionId))
  if (question) return question
  return fallbackQuestion || null
}

const gradeQuestionAnswer = (question, answer) => {
  const correctAnswer = question?.answer ?? question?.correctAnswer ?? ''
  const normalizedAnswer = normalizeAnswerText(answer)
  const normalizedCorrectAnswer = normalizeAnswerText(correctAnswer)
  return {
    isCorrect: Boolean(normalizedCorrectAnswer) && normalizedAnswer === normalizedCorrectAnswer,
    correctAnswer,
  }
}

const gradeAnswer = ({ questionId, answer, question: fallbackQuestion }) => {
  const question = resolveQuestion(questionId, fallbackQuestion)
  if (!question) {
    const error = new Error('Question not found')
    error.status = 404
    throw error
  }
  const graded = gradeQuestionAnswer(question, answer)
  return {
    isCorrect: graded.isCorrect,
    userAnswer: answer,
    correctAnswer: graded.correctAnswer,
    explanation: question.explanation,
    feedback: graded.isCorrect ? '回答正确，继续保持。' : `答案需要订正，参考答案是 ${graded.correctAnswer || '待确认'}。`,
  }
}

const subjectLabels = {
  math: '数学',
  chinese: '语文',
  english: '英语',
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  history: '历史',
  geography: '地理',
  politics: '政治',
}

const normalizeSubject = (subject) => subjectLabels[subject] || subject || '数学'

const normalizeWrongStatus = (question) => {
  if (question?.status) return question.status
  if (question?.mastered) return 'mastered'
  if (Number(question?.practiceCount || 0) > 0) return 'reviewing'
  return 'new'
}

const wrongStatusLabel = (status) => ({
  new: '新错题',
  corrected: '已订正',
  reviewing: '复练中',
  mastered: '已掌握',
}[status] || '新错题')

const filterWrongQuestionsForExport = (params) => {
  const ids = String(params.get('ids') || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
  const idSet = new Set(ids)
  const user = params.get('user')
  const status = params.get('status')
  const subject = params.get('subject')
  const knowledgePoint = params.get('knowledgePoint')

  let items = (store.wrongQuestions || []).map(item => ({
    ...item,
    status: normalizeWrongStatus(item),
    statusLabel: item.statusLabel || wrongStatusLabel(normalizeWrongStatus(item)),
  }))

  if (ids.length > 0) {
    items = items.filter(item => idSet.has(String(item.id)) || idSet.has(String(item.questionId)))
  }
  if (user) items = items.filter(item => item.user === normalizeUserName(user))
  if (status && status !== 'all') {
    items = status === 'active'
      ? items.filter(item => normalizeWrongStatus(item) !== 'mastered')
      : items.filter(item => normalizeWrongStatus(item) === status)
  }
  if (subject && subject !== 'all') {
    const normalizedSubject = normalizeSubject(subject)
    items = items.filter(item => normalizeSubject(item.subject) === normalizedSubject)
  }
  if (knowledgePoint && knowledgePoint !== 'all') {
    items = items.filter(item => (item.knowledgePoint || '未归类知识点') === knowledgePoint)
  }

  return items
}

const buildWrongQuestionsExportText = ({ title, questions }) => {
  const activeCount = questions.filter(item => normalizeWrongStatus(item) !== 'mastered').length
  const knowledgePoints = Array.from(new Set(questions.map(item => item.knowledgePoint || '未归类知识点'))).slice(0, 8)
  const lines = [
    title || '错题打印练习',
    `${questions.length}题 · 待回收${activeCount}题${knowledgePoints.length ? ` · ${knowledgePoints.join('、')}` : ''}`,
    '',
    '题目',
    '----------------------------------------',
  ]

  questions.forEach((question, index) => {
    lines.push(`第 ${index + 1} 题 · ${normalizeSubject(question.subject)} · ${question.knowledgePoint || '未归类知识点'} · ${wrongStatusLabel(normalizeWrongStatus(question))}`)
    lines.push(question.content || '')
    if (Array.isArray(question.options) && question.options.length > 0) {
      question.options.forEach(option => lines.push(`  ${option}`))
    }
    lines.push('')
    lines.push('答：__________________________________________________')
    lines.push('')
  })

  lines.push('')
  lines.push('答案与订正参考')
  lines.push('----------------------------------------')
  questions.forEach((question, index) => {
    lines.push(`${index + 1}. 正确答案：${question.answer || question.correctAnswer || '待确认'}`)
    if (question.wrongAnswer || question.userAnswer) lines.push(`   上次答案：${question.wrongAnswer || question.userAnswer}`)
    lines.push(`   订正建议：${question.explanation || '先回到题干条件，再复盘出错步骤。'}`)
  })

  return `${lines.join('\n')}\n`
}

const parseDateTime = (value) => {
  if (!value) return null
  const date = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}

const summarizeRecords = (records) => {
  const total = records.reduce((sum, record) => sum + Number(record.total || 0), 0)
  const correct = records.reduce((sum, record) => sum + Number(record.correct || 0), 0)
  const duration = records.reduce((sum, record) => sum + Number(record.duration || 0), 0)
  return {
    rounds: records.length,
    total,
    correct,
    wrong: Math.max(0, total - correct),
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    duration,
  }
}

const buildSubjectScores = () => {
  const grouped = new Map()

  store.learningRecords.forEach((record) => {
    const subject = normalizeSubject(record.subject)
    const current = grouped.get(subject) || {
      subject,
      attempts: 0,
      total: 0,
      correct: 0,
      duration: 0,
      scoreSum: 0,
      latestAt: record.completedAt,
    }

    const total = Number(record.total || 0)
    const correct = Number(record.correct || 0)
    const score = Number(record.score ?? (total ? Math.round((correct / total) * 100) : 0))

    current.attempts += 1
    current.total += total
    current.correct += correct
    current.duration += Number(record.duration || 0)
    current.scoreSum += score
    current.latestAt = record.completedAt > current.latestAt ? record.completedAt : current.latestAt
    grouped.set(subject, current)
  })

  return Array.from(grouped.values()).map((item) => ({
    subject: item.subject,
    attempts: item.attempts,
    total: item.total,
    correct: item.correct,
    accuracy: item.total ? Math.round((item.correct / item.total) * 100) : 0,
    averageScore: item.attempts ? Math.round(item.scoreSum / item.attempts) : 0,
    duration: item.duration,
    latestAt: item.latestAt,
  }))
}

const buildLearningReport = ({ user, period = 'week' }) => {
  const nickname = normalizeUserName(user)
  const now = new Date()
  const days = period === 'month' ? 30 : 7
  const periodLabel = period === 'month' ? '月报' : '周报'
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const userRecords = store.learningRecords.filter(item => item.user === nickname)
  const periodRecords = userRecords.filter((record) => {
    const date = parseDateTime(record.completedAt)
    return !date || date >= since
  })
  const summary = summarizeRecords(periodRecords)
  const activeWrong = store.wrongQuestions.filter(item =>
    item.user === nickname && normalizeWrongStatus(item) !== 'mastered'
  )
  const masteredWrong = store.wrongQuestions.filter(item =>
    item.user === nickname && normalizeWrongStatus(item) === 'mastered'
  )
  const wrongTotal = activeWrong.length + masteredWrong.length
  const recoveryRate = wrongTotal ? Math.round((masteredWrong.length / wrongTotal) * 100) : 0

  const weakPointCounts = new Map()
  periodRecords.forEach(record => {
    ;(record.weakKnowledgePoints || []).forEach(point => weakPointCounts.set(point, (weakPointCounts.get(point) || 0) + 1))
  })
  activeWrong.forEach(question => {
    if (question.knowledgePoint) weakPointCounts.set(question.knowledgePoint, (weakPointCounts.get(question.knowledgePoint) || 0) + 1)
  })
  const weakPoints = Array.from(weakPointCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))
    .slice(0, 6)

  const subjectMap = new Map()
  periodRecords.forEach((record) => {
    const subject = normalizeSubject(record.subject)
    const current = subjectMap.get(subject) || { subject, rounds: 0, total: 0, correct: 0 }
    current.rounds += 1
    current.total += Number(record.total || 0)
    current.correct += Number(record.correct || 0)
    subjectMap.set(subject, current)
  })
  const subjectSummary = Array.from(subjectMap.values()).map(item => ({
    ...item,
    accuracy: item.total ? Math.round((item.correct / item.total) * 100) : 0,
  }))

  const trend = periodRecords
    .slice()
    .reverse()
    .slice(-8)
    .map((record) => {
      const total = Number(record.total || 0)
      const correct = Number(record.correct || 0)
      return {
        id: record.id,
        date: record.completedAt,
        pack: record.pack || '自主练习',
        accuracy: total ? Math.round((correct / total) * 100) : Number(record.score || 0),
      }
    })

  const conclusion = summary.rounds === 0
    ? '本周期暂无完整练习记录，建议先完成一组年级推荐题包作为摸底。'
    : activeWrong.length > 0
      ? `本周期还有 ${activeWrong.length} 道错题待回收，建议先完成错题专项，再进入下一组题包。`
      : summary.accuracy >= 85
        ? '本周期掌握较稳定，可以安排阶段检测或进入下一单元。'
        : '本周期正确率仍需巩固，建议优先做薄弱知识点专项。'

  const lines = [
    `题小助学习${periodLabel}`,
    `学生：${nickname}`,
    `周期：${formatDate(since)} 至 ${formatDate(now)}`,
    '',
    '一、总体表现',
    `完成轮次：${summary.rounds} 轮`,
    `完成题量：${summary.total} 题`,
    `正确率：${summary.accuracy}%`,
    `错题回收率：${recoveryRate}%`,
    '',
    '二、学科表现',
    ...(subjectSummary.length > 0
      ? subjectSummary.map(item => `${item.subject}：${item.rounds}轮，${item.total}题，正确率${item.accuracy}%`)
      : ['暂无学科练习数据']),
    '',
    '三、重点关注',
    ...(weakPoints.length > 0
      ? weakPoints.map(item => `${item.name}：出现 ${item.count} 次`)
      : ['暂无明显薄弱知识点']),
    '',
    '四、最近练习',
    ...(trend.length > 0
      ? trend.map(item => `${item.date}｜${item.pack}｜${item.accuracy}%`)
      : ['暂无最近练习']),
    '',
    '五、下一步建议',
    conclusion,
  ]

  return {
    user: nickname,
    period,
    periodLabel,
    range: {
      from: formatDate(since),
      to: formatDate(now),
      days,
    },
    summary,
    activeWrongCount: activeWrong.length,
    masteredWrongCount: masteredWrong.length,
    recoveryRate,
    weakPoints,
    subjectSummary,
    trend,
    conclusion,
    content: lines.join('\n'),
  }
}

const createPracticeRecord = (body) => {
  const completedAt = new Date()
  const pack = store.questionPacks.find(item => item.id === body.packId)
  const rawAnswers = Array.isArray(body.answers) ? body.answers : []
  const answers = rawAnswers.map((answer) => {
    const question = resolveQuestion(answer.questionId, answer.question || answer)
    const graded = gradeQuestionAnswer(question, answer.answer ?? answer.userAnswer)
    return {
      questionId: answer.questionId || question?.id || `answer-${Date.now()}`,
      answer: String(answer.answer ?? answer.userAnswer ?? ''),
      userAnswer: String(answer.answer ?? answer.userAnswer ?? ''),
      isCorrect: graded.isCorrect,
      content: question?.content || answer.content || '',
      type: question?.type || answer.type || '',
      knowledgePoint: question?.knowledgePoint || answer.knowledgePoint || '',
      correctAnswer: graded.correctAnswer || answer.correctAnswer || '',
      explanation: question?.explanation || answer.explanation || '',
    }
  })
  const total = answers.length || Number(body.total || 0)
  const correct = answers.filter(answer => answer.isCorrect).length
  const weakKnowledgePoints = Array.from(new Set(answers
    .filter(answer => answer && answer.isCorrect === false)
    .map(answer => answer.knowledgePoint)
    .filter(Boolean)))
  const accuracy = total ? Math.round((correct / total) * 100) : 0
  const rating = accuracy >= 90 ? '优秀' : accuracy >= 75 ? '良好' : accuracy >= 60 ? '需巩固' : '重点补弱'
  const parentSummary = accuracy >= 90
    ? '本轮掌握稳定，可以进入下一组训练。'
    : accuracy >= 75
      ? '整体完成不错，建议针对错题知识点做一次回收练习。'
      : '本轮暴露出明显薄弱点，建议先复盘错题，再做同类题巩固。'
  const nextAction = weakKnowledgePoints.length > 0
    ? `优先复习：${weakKnowledgePoints.slice(0, 3).join('、')}`
    : '保持当前节奏，继续完成下一组教材同步练。'
  const record = {
    id: `lr-${Date.now()}`,
    userId: body.userId || null,
    user: normalizeUserName(body.user),
    packId: body.packId || pack?.id || null,
    pack: body.packName || pack?.name || '自主练习',
    subject: normalizeSubject(body.subject || pack?.subject),
    roundType: body.roundType || pack?.roundType || 'daily',
    completedAt: formatDateTime(completedAt),
    total,
    correct,
    wrong: Math.max(0, total - correct),
    score: accuracy,
    accuracy,
    duration: Number(body.duration || 0),
    rating,
    weakKnowledgePoints,
    parentSummary,
    nextAction,
    answers,
  }

  store.learningRecords.unshift(record)

  record.answers
    .filter(answer => answer.isCorrect === false)
    .forEach((answer) => {
      const existing = store.wrongQuestions.find(item => sameStudentOwner(item, record) && item.questionId === answer.questionId)
      if (existing) {
        existing.userId = existing.userId || record.userId
        existing.user = record.user
        existing.wrongAnswer = answer.answer
        existing.correctAnswer = answer.correctAnswer
        existing.practiceCount = Number(existing.practiceCount || 0) + 1
        existing.mastered = false
        existing.status = 'new'
        existing.statusLabel = '新错题'
        existing.lastPracticedAt = record.completedAt
        return
      }
      store.wrongQuestions.unshift({
        id: `wq-${Date.now()}-${answer.questionId}`,
        questionId: answer.questionId,
        userId: record.userId,
        user: record.user,
        subject: record.subject,
        knowledgePoint: answer.knowledgePoint || '未归类知识点',
        content: answer.content || '',
        wrongAnswer: answer.answer || '',
        correctAnswer: answer.correctAnswer || '',
        explanation: answer.explanation || '',
        practiceCount: 1,
        mastered: false,
        status: 'new',
        statusLabel: '新错题',
        addedAt: record.completedAt,
      })
    })

  record.answers
    .filter(answer => answer.isCorrect === true)
    .forEach((answer) => {
      const existing = store.wrongQuestions.find(item => sameStudentOwner(item, record) && item.questionId === answer.questionId)
      if (!existing || existing.mastered) return
      existing.userId = existing.userId || record.userId
      existing.user = record.user
      const previousPracticeCount = Number(existing.practiceCount || 0)
      existing.practiceCount = previousPracticeCount + 1
      existing.lastPracticedAt = record.completedAt
      existing.correctedAt = existing.correctedAt || record.completedAt
      existing.status = previousPracticeCount >= 2 ? 'mastered' : 'corrected'
      existing.statusLabel = existing.status === 'mastered' ? '已掌握' : '已订正'
      existing.mastered = existing.status === 'mastered'
      if (existing.mastered) existing.masteredAt = record.completedAt
    })

  if (pack) {
    pack.usageCount = Number(pack.usageCount || 0) + 1
    const packRecords = store.learningRecords.filter(item => item.packId === pack.id || item.pack === pack.name)
    pack.completionRate = Math.round(
      packRecords.reduce((sum, item) => sum + (item.total ? (item.correct / item.total) * 100 : 0), 0) / Math.max(packRecords.length, 1)
    )
  }

  const user = record.userId !== undefined && record.userId !== null && String(record.userId) !== ''
    ? store.users.find(item => Number(item.id) === Number(record.userId))
    : store.users.find(item => item.nickname === record.user)
  if (user) {
    user.totalQuestions = Number(user.totalQuestions || 0) + total
    user.accuracy = record.total ? Math.round((record.correct / record.total) * 100) : user.accuracy
    user.subject = record.subject
    user.lastActive = formatDate(completedAt)
  }

  let rewardTransaction = null
  const rewardRule = getPointRule('practice_reward')
  if (rewardRule?.reward) {
    rewardTransaction = createPointTransaction({
      user: record.user,
      userId: record.userId,
      type: 'credit',
      action: 'practice_reward',
      points: rewardRule.reward,
      note: `完成${record.pack}`,
      relatedId: record.id,
    }).transaction
  }

  scheduleStorePersist()

  return { ...record, rewardTransaction }
}

const updateWrongQuestion = (id, body, scope = null) => {
  const question = store.wrongQuestions.find(item => String(item.id) === String(id) || String(item.questionId) === String(id))
  if (!question) {
    const error = new Error('Wrong question not found')
    error.status = 404
    throw error
  }

  if (scope && !scope.isAdmin && (scope.user || scope.userId) && !isInStudentScope(question, scope)) {
    const error = new Error('Wrong question is outside current student scope')
    error.status = 403
    throw error
  }

  const nextStatus = body.status || body.masteryStatus
  const allowedStatuses = new Set(['new', 'corrected', 'reviewing', 'mastered'])
  if (nextStatus !== undefined) {
    if (!allowedStatuses.has(nextStatus)) {
      const error = new Error('Invalid wrong question status')
      error.status = 400
      throw error
    }
    question.status = nextStatus
    question.statusLabel = nextStatus === 'new'
      ? '新错题'
      : nextStatus === 'corrected'
        ? '已订正'
        : nextStatus === 'reviewing'
          ? '复练中'
          : '已掌握'
    question.mastered = nextStatus === 'mastered'
    if (nextStatus === 'corrected') question.correctedAt = formatDateTime(new Date())
    if (nextStatus === 'reviewing') question.reviewStartedAt = formatDateTime(new Date())
    if (nextStatus === 'mastered') question.masteredAt = formatDateTime(new Date())
  }

  if (body.practiceCount !== undefined) question.practiceCount = Math.max(0, Number(body.practiceCount || 0))
  if (body.lastPracticedAt !== undefined) question.lastPracticedAt = body.lastPracticedAt
  if (body.mastered !== undefined && nextStatus === undefined) {
    question.mastered = Boolean(body.mastered)
    question.status = question.mastered ? 'mastered' : normalizeWrongStatus(question)
    if (question.mastered) question.masteredAt = formatDateTime(new Date())
  }

  scheduleStorePersist()
  return question
}

const favoriteQuestion = (body) => {
  const user = normalizeUserName(body.user)
  const questionId = body.questionId
  const question = store.questions.find(item => item.id === questionId) || body.question
  if (!questionId || !question) {
    const error = new Error('Question not found')
    error.status = 404
    throw error
  }

  store.favoriteQuestions ||= []
  const existing = store.favoriteQuestions.find(item => sameStudentOwner(item, { user, userId: body.userId }) && item.questionId === questionId)
  if (existing) return { favorite: existing, alreadyFavorited: true }

  const favorite = {
    id: `fav-${Date.now()}`,
    userId: body.userId || null,
    user,
    questionId,
    packId: body.packId || question.packId || null,
    packName: body.packName || '',
    subject: normalizeSubject(body.subject || question.subject),
    type: question.type || body.type || '题目',
    knowledgePoint: question.knowledgePoint || body.knowledgePoint || '未归类知识点',
    content: question.content || body.content || '',
    answer: question.answer || body.answer || '',
    explanation: question.explanation || body.explanation || '',
    createdAt: formatDateTime(new Date()),
  }
  store.favoriteQuestions.unshift(favorite)
  scheduleStorePersist()
  return { favorite, alreadyFavorited: false }
}

export const requestHandler = async (req, res) => {
  res.__requestOrigin = req.headers.origin || ''
  if (req.method === 'OPTIONS') return json(res, 204, {})

  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = url.pathname

  if (!path.startsWith('/api/')) {
    if (path === '/admin' || path.startsWith('/admin/')) {
      const adminPath = path.replace(/^\/admin\/?/, '/')
      return serveStaticApp(res, adminPath, adminDistDir)
    }
    return serveStaticApp(res, path, frontendDistDir)
  }

  try {
    if (path === '/api/health') {
      return json(res, 200, ok({ status: 'ok', service: 'tixiaozhu-backend', time: new Date().toISOString() }))
    }

    if (path === '/api/ready') {
      const readiness = await buildOperationalReadinessReport()
      return json(res, readiness.ready ? 200 : 503, ok(readiness))
    }

    if (path === '/api/dashboard') {
      requireAdmin(req)
      return json(res, 200, ok(dashboardSummary()))
    }

    if (path === '/api/question-bank-quality') {
      requireAdmin(req)
      return json(res, 200, ok(buildQuestionBankQualityReport()))
    }

    if (path === '/api/question-bank-coverage') {
      requireAdmin(req)
      return json(res, 200, ok(buildQuestionBankCoverageReport()))
    }

    if (path === '/api/product-readiness') {
      requireAdmin(req)
      return json(res, 200, ok(buildCurrentProductReadinessReport()))
    }

    if (path === '/api/commercial-launch-readiness') {
      requireAdmin(req)
      return json(res, 200, ok(buildCurrentCommercialLaunchReport()))
    }

    if (path === '/api/auth/register' && req.method === 'POST') {
      return json(res, 201, ok(await registerStudent(await readBody(req))))
    }

    if (path === '/api/auth/login' && req.method === 'POST') {
      return json(res, 200, ok(await loginStudent(await readBody(req))))
    }

    if (path === '/api/auth/session' && req.method === 'GET') {
      return json(res, 200, ok(currentStudentSession(req)))
    }

    if (path === '/api/admin/auth/login' && req.method === 'POST') {
      return json(res, 200, ok(await adminLogin(await readBody(req))))
    }

    if (path === '/api/admin/auth/session' && req.method === 'GET') {
      const payload = requireAdmin(req)
      return json(res, 200, ok(buildAdminProfile(payload.username)))
    }

    if (path === '/api/users') {
      requireAdmin(req)
      const search = url.searchParams.get('search')
      const status = url.searchParams.get('status')
      let users = bySearch(store.users, search, ['nickname', 'grade', 'subject'])
      if (status && status !== 'all') users = users.filter(user => user.memberStatus === status)
      return json(res, 200, ok(users, { total: users.length }))
    }

    if (path === '/api/question-packs') {
      const search = url.searchParams.get('search')
      const subject = url.searchParams.get('subject')
      const status = url.searchParams.get('status')
      const scope = resolveStudentScope(req, url.searchParams.get('user'))
      let packs = bySearch(store.questionPacks, search, ['name', 'grade', 'subject'])
      if (subject && subject !== 'all') packs = packs.filter(pack => pack.subject === subject)
      if (status && status !== 'all') packs = packs.filter(pack => pack.status === status)
      const enrichedPacks = packs.map(pack => enrichPackForUser(pack, scope.user, scope.userId))
      return json(res, 200, ok(enrichedPacks, { total: enrichedPacks.length }))
    }

    if (path.startsWith('/api/question-packs/') && path.endsWith('/export.pdf') && req.method === 'GET') {
      const id = decodeURIComponent(path.replace('/api/question-packs/', '').replace('/export.pdf', ''))
      const { user, userId } = resolveStudentScope(req, url.searchParams.get('user'))
      const pack = store.questionPacks.find(item => String(item.id) === String(id))
      if (!pack) return json(res, 404, { ok: false, error: 'Question pack not found' })
      if (!hasContentAccess(user, pack, userId)) return json(res, 403, { ok: false, error: 'Question pack is locked' })
      const pdf = await ensureQuestionPackPdf(pack, user)
      const filename = `${safeFileName(pack.name)}题目打印版.pdf`
      return binary(res, 200, pdf, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, max-age=3600',
      })
    }

    if (path.startsWith('/api/question-packs/') && path.endsWith('/export-status') && req.method === 'GET') {
      const id = decodeURIComponent(path.replace('/api/question-packs/', '').replace('/export-status', ''))
      const { user, userId } = resolveStudentScope(req, url.searchParams.get('user'))
      const pack = store.questionPacks.find(item => String(item.id) === String(id))
      if (!pack) return json(res, 404, { ok: false, error: 'Question pack not found' })
      if (!hasContentAccess(user, pack, userId)) return json(res, 403, { ok: false, error: 'Question pack is locked' })
      const status = questionPackPdfStatus(pack.id)
      if (!status.ready && !status.generating) {
        ensureQuestionPackPdf(pack, user).catch(() => {})
        return json(res, 200, ok({ ...questionPackPdfStatus(pack.id), generating: true }))
      }
      return json(res, 200, ok(status))
    }

    if (path.startsWith('/api/question-packs/') && path.endsWith('/export') && req.method === 'GET') {
      const id = decodeURIComponent(path.replace('/api/question-packs/', '').replace('/export', ''))
      const { user, userId } = resolveStudentScope(req, url.searchParams.get('user'))
      const pack = store.questionPacks.find(item => String(item.id) === String(id))
      if (!pack) return json(res, 404, { ok: false, error: 'Question pack not found' })
      if (!hasContentAccess(user, pack, userId)) return json(res, 403, { ok: false, error: 'Question pack is locked' })
      ensureQuestionPackPdf(pack, user).catch(() => {})
      return html(res, 200, buildQuestionPackPrintHtml(pack, user))
    }

    if (path.startsWith('/api/question-packs/') && path.endsWith('/versions') && req.method === 'GET') {
      requireAdmin(req)
      const id = decodeURIComponent(path.replace('/api/question-packs/', '').replace('/versions', ''))
      const versions = (store.questionPackVersions || [])
        .filter(item => String(item.packId) === String(id))
        .sort((a, b) => Number(b.versionNo || 0) - Number(a.versionNo || 0))
      return json(res, 200, ok(versions, { total: versions.length }))
    }

    if (path.startsWith('/api/question-packs/') && path.endsWith('/questions/bulk') && req.method === 'POST') {
      requireAdmin(req)
      const id = decodeURIComponent(path.replace('/api/question-packs/', '').replace('/questions/bulk', ''))
      return json(res, 200, ok(bulkAssignQuestions(id, await readBody(req))))
    }

    if (path.startsWith('/api/question-packs/') && path.endsWith('/questions/reorder') && req.method === 'PATCH') {
      requireAdmin(req)
      const id = decodeURIComponent(path.replace('/api/question-packs/', '').replace('/questions/reorder', ''))
      return json(res, 200, ok(reorderPackQuestions(id, await readBody(req))))
    }

    if (path.startsWith('/api/question-packs/') && req.method === 'PATCH') {
      requireAdmin(req)
      const id = decodeURIComponent(path.replace('/api/question-packs/', ''))
      return json(res, 200, ok(updateQuestionPack(id, await readBody(req))))
    }

    if (path === '/api/questions') {
      const packId = url.searchParams.get('packId')
      const scope = packId ? resolveStudentScope(req, url.searchParams.get('user')) : null
      if (!packId) requireAdmin(req)
      if (packId) {
        const pack = store.questionPacks.find(item => String(item.id) === String(packId))
        if (!pack) return json(res, 404, { ok: false, error: 'Question pack not found' })
        if (!scope.isAdmin && !hasContentAccess(scope.user, pack, scope.userId)) {
          return json(res, 403, { ok: false, error: 'Question pack is locked' })
        }
      }
      const questions = packId ? store.questions.filter(item => item.packId === packId) : store.questions
      const packSourceById = new Map(store.questionPacks.map(pack => [pack.id, pack.source || 'manual']))
      const enrichedQuestions = questions.map(question => ({
        ...question,
        source: question.source || packSourceById.get(question.packId) || 'manual',
      })).sort((a, b) => {
        if (String(a.packId || '') === String(b.packId || '')) {
          return Number(a.sortOrder ?? a.order ?? 9999) - Number(b.sortOrder ?? b.order ?? 9999)
        }
        return 0
      })
      return json(res, 200, ok(enrichedQuestions, { total: enrichedQuestions.length }))
    }

    if (path.startsWith('/api/questions/') && req.method === 'PATCH') {
      requireAdmin(req)
      const id = decodeURIComponent(path.replace('/api/questions/', ''))
      return json(res, 200, ok(reassignQuestion(id, await readBody(req))))
    }

    if (path.startsWith('/api/knowledge-points/') && path.endsWith('/coach-pack.pdf') && req.method === 'GET') {
      requireAdmin(req)
      const id = decodeURIComponent(path.replace('/api/knowledge-points/', '').replace('/coach-pack.pdf', ''))
      const pack = buildKnowledgePointCoachText(id)
      const pdf = await renderPlainTextPdf(pack.content, pack.title)
      return binary(res, 200, pdf, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${safeFileName(pack.title)}.pdf`)}`,
        'Cache-Control': 'private, max-age=300',
      })
    }
    if (path === '/api/knowledge-points') {
      requireAdmin(req)
      return json(res, 200, ok(store.knowledgePoints))
    }
    if (path === '/api/learning-report') {
      const { user } = resolveStudentScope(req, url.searchParams.get('user'))
      return json(res, 200, ok(buildLearningReport({
        user,
        period: url.searchParams.get('period') || 'week',
      })))
    }
    if (path === '/api/learning-records') {
      const scope = resolveStudentScope(req, url.searchParams.get('user'))
      const records = scope.user || scope.userId
        ? store.learningRecords.filter(item => isInStudentScope(item, scope))
        : store.learningRecords
      return json(res, 200, ok(records, { total: records.length }))
    }
    if (path === '/api/subject-scores') {
      requireAdmin(req)
      return json(res, 200, ok(buildSubjectScores()))
    }
    if (path === '/api/wrong-questions/export.pdf' && req.method === 'GET') {
      const { user } = resolveStudentScope(req, url.searchParams.get('user'))
      const exportParams = new URLSearchParams(url.searchParams)
      if (user) exportParams.set('user', user)
      const questions = filterWrongQuestionsForExport(exportParams)
      if (questions.length === 0) return json(res, 404, { ok: false, error: 'No wrong questions to export' })
      const title = url.searchParams.get('title') || '错题打印练习'
      const pdf = await renderPlainTextPdf(buildWrongQuestionsExportText({ title, questions }), title)
      return binary(res, 200, pdf, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${safeFileName(title)}.pdf`)}`,
        'Cache-Control': 'private, max-age=300',
      })
    }
    if (path === '/api/wrong-questions') {
      const scope = resolveStudentScope(req, url.searchParams.get('user'))
      const wrongQuestions = scope.user || scope.userId
        ? store.wrongQuestions.filter(item => isInStudentScope(item, scope))
        : store.wrongQuestions
      return json(res, 200, ok(wrongQuestions.map(item => ({
        ...item,
        status: normalizeWrongStatus(item),
        statusLabel: item.statusLabel || (normalizeWrongStatus(item) === 'mastered' ? '已掌握' : normalizeWrongStatus(item) === 'corrected' ? '已订正' : normalizeWrongStatus(item) === 'reviewing' ? '复练中' : '新错题'),
      }))))
    }
    if (path === '/api/favorite-questions' && req.method === 'GET') {
      const scope = resolveStudentScope(req, url.searchParams.get('user'))
      const favorites = scope.user || scope.userId
        ? (store.favoriteQuestions || []).filter(item => isInStudentScope(item, scope))
        : (store.favoriteQuestions || [])
      return json(res, 200, ok(favorites, { total: favorites.length }))
    }
    if (path === '/api/uploaded-questions' && req.method === 'GET') {
      const scope = resolveStudentScope(req, url.searchParams.get('user'))
      const items = scope.user || scope.userId
        ? (store.uploadedQuestions || []).filter(item => isInStudentScope(item, scope))
        : (store.uploadedQuestions || [])
      return json(res, 200, ok(items, { total: items.length }))
    }
    if (path === '/api/orders' && req.method === 'GET') {
      requireAdmin(req)
      return json(res, 200, ok(store.orders))
    }
    if (path === '/api/payments' && req.method === 'GET') {
      requireAdmin(req)
      return json(res, 200, ok(store.payments || []))
    }
    if (path === '/api/payment/config' && req.method === 'GET') {
      const paymentDeferred = IS_PRODUCTION_RUNTIME && isPaymentLaunchDeferred()
      return json(res, 200, ok({
        visible: paymentDeferred ? false : Boolean(store.settings.paymentFeatureVisible),
        pointsVisible: paymentDeferred ? false : Boolean(store.settings.pointsFeatureVisible),
        monetizationMode: store.settings.monetizationMode || 'membership',
        mode: store.settings.paymentMode,
        paymentLaunchStrategy: paymentDeferred ? 'deferred' : 'production',
        providers: store.settings.paymentProviders,
      }))
    }
    if (path === '/api/recognition/config' && req.method === 'GET') {
      const ocrDeferred = IS_PRODUCTION_RUNTIME && isOcrLaunchDeferred()
      return json(res, 200, ok({
        visible: !ocrDeferred,
        configured: hasConfigValue(OCR_API_URL),
        recognitionLaunchStrategy: ocrDeferred ? 'deferred' : 'production',
      }))
    }
    if (path === '/api/membership-plans') {
      const publicPaymentDeferred = IS_PRODUCTION_RUNTIME && isPaymentLaunchDeferred() && !hasAdminSession(req)
      return json(res, 200, ok(publicPaymentDeferred ? [] : store.membershipPlans))
    }
    if (path === '/api/point-packages') {
      const publicPaymentDeferred = IS_PRODUCTION_RUNTIME && isPaymentLaunchDeferred() && !hasAdminSession(req)
      const packages = publicPaymentDeferred ? [] : store.pointPackages.filter(item => item.status === 'active')
      return json(res, 200, ok(packages))
    }
    if (path === '/api/point-rules') {
      requireAdmin(req)
      return json(res, 200, ok(store.pointRules))
    }
    if (path === '/api/content-purchases') {
      const scope = resolveStudentScope(req, url.searchParams.get('user'))
      const purchases = scope.user || scope.userId
        ? (store.contentPurchases || []).filter(item => isInStudentScope(item, scope))
        : (store.contentPurchases || [])
      return json(res, 200, ok(purchases, { total: purchases.length }))
    }
    if (path === '/api/point-transactions') {
      requireAdmin(req)
      const user = url.searchParams.get('user')
      const transactions = user
        ? (store.pointTransactions || []).filter(item => item.user === user)
        : (store.pointTransactions || [])
      return json(res, 200, ok(transactions, { total: transactions.length }))
    }
    if (path === '/api/points/account') {
      const { user, userId } = resolveStudentScope(req, url.searchParams.get('user'))
      return json(res, 200, ok(buildPointAccount(user, userId)))
    }
    if (path === '/api/settings' && req.method === 'GET') {
      requireAdmin(req)
      return json(res, 200, ok(sanitizeSettings(store.settings)))
    }

    if (path === '/api/orders' && req.method === 'POST') {
      if (store.settings.paymentMode !== 'test') {
        return json(res, 403, { ok: false, error: 'Direct paid order creation is disabled outside test mode' })
      }
      return json(res, 201, ok(createPaidOrder(await readBody(req))))
    }

    if (path === '/api/payments/session' && req.method === 'POST') {
      return json(res, 201, ok(createPaymentSession(bindStudentBody(req, await readBody(req)))))
    }

    if (path === '/api/payments/webhook' && req.method === 'POST') {
      return json(res, 200, ok(handlePaymentWebhook(await readBody(req), req)))
    }

    if (path === '/api/payments/mock-confirm' && req.method === 'POST') {
      requirePaymentLaunchAvailable()
      if (store.settings.paymentMode !== 'test') return json(res, 403, { ok: false, error: 'Mock payment is disabled outside test mode' })
      return json(res, 200, ok(confirmPayment(bindStudentBody(req, await readBody(req)), { enforceStudentOwner: true })))
    }

    if (path === '/api/payments/refund' && req.method === 'POST') {
      requireAdmin(req)
      return json(res, 200, ok(refundPayment(await readBody(req))))
    }

    if (path === '/api/points/purchase' && req.method === 'POST') {
      return json(res, 201, ok(purchasePointPackage(bindStudentBody(req, await readBody(req)))))
    }

    if (path === '/api/points/spend' && req.method === 'POST') {
      return json(res, 200, ok(spendPoints(bindStudentBody(req, await readBody(req)))))
    }

    if (path === '/api/content-purchases/buy' && req.method === 'POST') {
      return json(res, 201, ok(purchaseContentPack(bindStudentBody(req, await readBody(req)))))
    }

    if (path.startsWith('/api/wrong-questions/') && req.method === 'PATCH') {
      const id = decodeURIComponent(path.replace('/api/wrong-questions/', ''))
      const scope = resolveStudentScope(req, null)
      return json(res, 200, ok(updateWrongQuestion(id, await readBody(req), scope)))
    }

    if (path === '/api/admin/points/adjust' && req.method === 'POST') {
      requireAdmin(req)
      return json(res, 200, ok(adjustPoints(await readBody(req))))
    }

    if (path === '/api/practice-records' && req.method === 'POST') {
      return json(res, 201, ok(createPracticeRecord(bindStudentBody(req, await readBody(req)))))
    }

    if (path === '/api/favorite-questions' && req.method === 'POST') {
      return json(res, 201, ok(favoriteQuestion(bindStudentBody(req, await readBody(req)))))
    }

    if (path === '/api/uploaded-questions' && req.method === 'POST') {
      return json(res, 201, ok(createUploadedQuestion(bindStudentBody(req, await readBody(req)))))
    }

    if (path === '/api/settings' && req.method === 'PATCH') {
      requireAdmin(req)
      const nextSettings = await readBody(req)
      if (IS_PRODUCTION_RUNTIME && isPaymentLaunchDeferred() && nextSettings.paymentFeatureVisible === true) {
        return json(res, 409, { ok: false, error: 'Payment entry cannot be enabled while payment launch is deferred' })
      }
      Object.assign(store.settings, nextSettings)
      scheduleStorePersist()
      return json(res, 200, ok(sanitizeSettings(store.settings)))
    }

    if (path === '/api/ai/generate' && req.method === 'POST') {
      requireAdmin(req)
      const questions = await generateQuestionsWithProvider(await readBody(req))
      return json(res, 200, ok(questions, { total: questions.length }))
    }

    if (path === '/api/ai/history' && req.method === 'GET') {
      requireAdmin(req)
      return json(res, 200, ok(store.aiGenerationHistory || []))
    }

    if (path === '/api/ai/review' && req.method === 'POST') {
      requireAdmin(req)
      return json(res, 201, ok(submitGenerationForReview(await readBody(req))))
    }

    if (path === '/api/uploads/recognize' && req.method === 'POST') {
      return json(res, 200, ok(await recognizeUploadWithProvider(bindStudentBody(req, await readBody(req)))))
    }

    if (path === '/api/answers/grade' && req.method === 'POST') {
      return json(res, 200, ok(gradeAnswer(bindStudentBody(req, await readBody(req)))))
    }

    return json(res, 404, { ok: false, error: 'Unknown API route' })
  } catch (error) {
    if ((error.status || 500) >= 500) {
      emitMonitoringEvent({
        level: 'error',
        event: 'api_error',
        path,
        method: req.method,
        message: error.message,
      })
    }
    return json(res, error.status || 500, { ok: false, error: error.message })
  }
}

const server = http.createServer(requestHandler)
const shouldListen = process.env.VERCEL !== '1'

if (shouldListen) {
  server.listen(PORT, HOST, () => {
    console.log(`Tixiaozhu backend listening on http://${HOST}:${PORT}`)
  })

  let closing = false
  const shutdown = async (signal) => {
    if (closing) return
    closing = true
    try {
      await storePersistence.flush()
    } catch (error) {
      console.error(`[store] failed to flush during ${signal}: ${error.message}`)
    }
    server.close(() => {
      process.exit(0)
    })
    setTimeout(() => process.exit(0), 800).unref()
  }

  process.on('SIGINT', () => {
    shutdown('SIGINT').catch(() => process.exit(1))
  })

  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch(() => process.exit(1))
  })
}
