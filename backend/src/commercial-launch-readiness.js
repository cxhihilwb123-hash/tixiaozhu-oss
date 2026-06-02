const DEFAULT_ADMIN_USERNAME = 'admin'
const DEFAULT_ADMIN_PASSWORD = 'admin123'
const DEFAULT_ADMIN_SECRET = 'tixiaozhu-local-admin-secret'
const DEFAULT_STUDENT_SECRET = 'tixiaozhu-local-student-secret'

const hasValue = (value) => String(value || '').trim().length > 0

const buildIssue = (level, title, action, detail) => ({
  level,
  title,
  action,
  detail,
})

const hasLivePaymentConfig = (env) => (
  hasValue(env.WECHAT_PAY_MCH_ID)
  || hasValue(env.ALIPAY_APP_ID)
  || hasValue(env.PAYMENT_PROVIDER_MODE)
)

const normalizePaymentLaunchStrategy = (settings, env) => {
  const explicit = String(env.PAYMENT_LAUNCH_STRATEGY || env.TIXIAOZHU_PAYMENT_STRATEGY || '').trim()
  if (['production', 'deferred'].includes(explicit)) return explicit
  return settings.paymentFeatureVisible ? 'production' : 'deferred'
}

const normalizeOcrLaunchStrategy = (env) => {
  const explicit = String(env.OCR_LAUNCH_STRATEGY || env.RECOGNITION_LAUNCH_STRATEGY || '').trim()
  if (['production', 'deferred'].includes(explicit)) return explicit
  return hasValue(env.OCR_API_URL) ? 'production' : 'deferred'
}

export const buildCommercialLaunchReadinessReport = (store, env = process.env) => {
  const settings = store.settings || {}
  const adminUsername = env.ADMIN_USERNAME || settings.adminUsername || DEFAULT_ADMIN_USERNAME
  const hasAdminPasswordHash = hasValue(env.ADMIN_PASSWORD_HASH)
  const adminPassword = hasAdminPasswordHash ? 'hash-configured' : (env.ADMIN_PASSWORD || settings.adminPassword || DEFAULT_ADMIN_PASSWORD)
  const sessionSecret = env.ADMIN_SESSION_SECRET || DEFAULT_ADMIN_SECRET
  const studentSessionSecret = env.STUDENT_SESSION_SECRET || env.ADMIN_SESSION_SECRET || DEFAULT_STUDENT_SECRET
  const requireStudentAuth = env.REQUIRE_STUDENT_AUTH === 'true' || env.TIXIAOZHU_ENV === 'production' || env.NODE_ENV === 'production'
  const paymentLaunchStrategy = normalizePaymentLaunchStrategy(settings, env)
  const paymentDeferred = paymentLaunchStrategy === 'deferred'
  const ocrLaunchStrategy = normalizeOcrLaunchStrategy(env)
  const ocrDeferred = ocrLaunchStrategy === 'deferred'
  const paymentMode = settings.paymentMode || 'test'
  const configuredAiProvider = env.AI_PROVIDER || settings.aiProvider || 'mock-compatible'
  const dataLayer = env.TIXIAOZHU_DATA_LAYER || (hasValue(env.DATABASE_URL) || hasValue(env.TIXIAOZHU_DATABASE_URL) ? 'postgres' : 'file')
  const hasDatabase = dataLayer === 'postgres' && (hasValue(env.DATABASE_URL) || hasValue(env.TIXIAOZHU_DATABASE_URL))
  const hasStudentAuth = (
    hasValue(env.STUDENT_AUTH_PROVIDER)
    || hasValue(env.AUTH_PROVIDER)
    || (studentSessionSecret !== DEFAULT_STUDENT_SECRET && requireStudentAuth)
  )
  const hasPaymentWebhookSecret = hasValue(env.PAYMENT_WEBHOOK_SECRET)
  const hasProductionAiService = hasValue(env.AI_API_KEY) && hasValue(env.AI_API_BASE) && hasValue(env.AI_MODEL)
  const hasProductionOcrService = hasValue(env.OCR_API_URL)
  const aiProvider = hasProductionAiService ? (env.AI_PROVIDER || 'production-configured') : configuredAiProvider
  const hasObjectStorage = hasValue(env.BLOB_READ_WRITE_TOKEN) || hasValue(env.OBJECT_STORAGE_BUCKET) || hasValue(env.S3_BUCKET) || hasValue(env.COS_BUCKET)
  const hasMonitoring = env.VERCEL_ALERTS_ENABLED === 'true' || hasValue(env.SENTRY_DSN) || hasValue(env.LOG_DRAIN_URL) || hasValue(env.OBSERVABILITY_ENDPOINT)
  const explicitFrontendUrl = hasValue(env.FRONTEND_URL)
  const explicitAdminUrl = hasValue(env.ADMIN_URL)
  const paymentDeferredSafely = paymentDeferred && settings.paymentFeatureVisible !== true && paymentMode === 'test'

  const deferredItems = [
    paymentDeferred ? {
      title: '正式支付延期上线',
      action: '生产环境先关闭前台支付入口和模拟支付确认；后续单独接入正式商户、回调验签、退款和对账。',
      detail: '支付不作为本轮上线范围，但不能把测试支付能力暴露给真实用户。',
    } : null,
    ocrDeferred ? {
      title: '拍照识别延期上线',
      action: '本轮先隐藏生产环境拍照/相册识别入口，保留手动输入、AI 批改、错题和题库链路；后续单独接入正式 OCR/视觉识别服务。',
      detail: '拍照识别不作为本轮上线范围，但不能用 mock 或不支持图片的模型伪装正式能力。',
    } : null,
  ].filter(Boolean)

  const issues = [
    !hasDatabase ? buildIssue(
      'high',
      '仍使用本地文件数据层',
      '接入 PostgreSQL 或等价生产数据库，并设置 DATABASE_URL / TIXIAOZHU_DATABASE_URL。',
      '本地 JSON 适合内测，不适合商业上线后的并发、备份、迁移和审计。'
    ) : null,
    (adminUsername === DEFAULT_ADMIN_USERNAME || adminPassword === DEFAULT_ADMIN_PASSWORD) ? buildIssue(
      'high',
      '后台仍可使用默认管理员账号',
      '上线前必须设置 ADMIN_USERNAME 和 ADMIN_PASSWORD_HASH，且不能保留 admin/admin123。',
      '默认管理员口令只能用于本地开发。'
    ) : null,
    !hasAdminPasswordHash ? buildIssue(
      'high',
      '管理员密码未哈希化配置',
      '上线前必须使用 ADMIN_PASSWORD_HASH，不能用明文 ADMIN_PASSWORD 作为生产凭据。',
      '管理员密码应以 bcrypt 哈希形式进入运行环境，避免明文口令扩散到部署配置。'
    ) : null,
    sessionSecret === DEFAULT_ADMIN_SECRET ? buildIssue(
      'high',
      '管理员会话仍使用默认签名密钥',
      '上线前必须设置 ADMIN_SESSION_SECRET，并使用高强度随机字符串。',
      '默认 secret 会让 token 签名安全性不足。'
    ) : null,
    !hasStudentAuth ? buildIssue(
      'high',
      '学生端真实账号体系未接入',
      '设置 STUDENT_SESSION_SECRET 和 REQUIRE_STUDENT_AUTH=true，并让练习、错题、收藏、购买记录绑定真实用户 ID。',
      '生产环境不能允许匿名用户用昵称隔离学习数据。'
    ) : null,
    paymentDeferred && !paymentDeferredSafely ? buildIssue(
      'high',
      '支付延期策略未安全关闭支付入口',
      '当 PAYMENT_LAUNCH_STRATEGY=deferred 时，必须关闭 paymentFeatureVisible，并禁止生产环境暴露模拟支付。',
      `当前 paymentFeatureVisible=${settings.paymentFeatureVisible}，paymentMode=${paymentMode}。`
    ) : null,
    (!paymentDeferred && paymentMode !== 'production') ? buildIssue(
      'high',
      '支付仍处于测试模式',
      '切换到 production 支付模式，并完成支付网关、回调验签、幂等和退款处理。',
      `当前 paymentMode=${paymentMode}。`
    ) : null,
    (!paymentDeferred && !hasLivePaymentConfig(env)) ? buildIssue(
      'high',
      '真实支付商户配置缺失',
      '配置微信/支付宝等正式商户参数，并建立支付回调验签。',
      '未检测到 WECHAT_PAY_MCH_ID、ALIPAY_APP_ID 或 PAYMENT_PROVIDER_MODE。'
    ) : null,
    (!paymentDeferred && !hasPaymentWebhookSecret) ? buildIssue(
      'high',
      '支付回调签名密钥未配置',
      '上线前必须设置 PAYMENT_WEBHOOK_SECRET，并在支付平台回调中发送 X-Payment-Signature。',
      '缺少回调验签会让支付通知无法安全进入订单状态机。'
    ) : null,
    !hasProductionAiService ? buildIssue(
      'medium',
      'AI 仍是测试服务口径',
      '配置正式 AI 出题服务 AI_API_KEY / AI_API_BASE / AI_MODEL。',
      '缺少正式 AI 生成服务配置。'
    ) : null,
    (!ocrDeferred && !hasProductionOcrService) ? buildIssue(
      'medium',
      'OCR 仍是测试服务口径',
      '配置正式 OCR_API_URL，或显式设置 OCR_LAUNCH_STRATEGY=deferred 并隐藏拍照识别入口。',
      `OCR launch strategy=${ocrLaunchStrategy}，OCR=${hasProductionOcrService ? 'configured' : 'missing'}。`
    ) : null,
    !hasObjectStorage ? buildIssue(
      'medium',
      '文件与导出物未接入对象存储',
      '配置生产对象存储，用于拍题图片、PDF、导出讲义和备份。',
      '本地文件不适合多实例部署和长期保存。'
    ) : null,
    !hasMonitoring ? buildIssue(
      'medium',
      '缺少生产监控与告警',
      '配置错误监控、日志收集和支付回调告警。',
      '商业上线需要能发现并定位线上故障。'
    ) : null,
    (!explicitFrontendUrl || !explicitAdminUrl) ? buildIssue(
      'medium',
      '前后台正式域名未显式配置',
      '设置 FRONTEND_URL 和 ADMIN_URL，避免 CORS 与回调地址依赖本地默认值。',
      '本地默认域名只适合开发和内测。'
    ) : null,
    settings.contentReviewRequired === false ? buildIssue(
      'medium',
      '内容发布审核未开启',
      '保持题目、AI 生成内容和运营内容先审核后发布。',
      '商业题库需要内容质量和合规审核。'
    ) : null,
  ].filter(Boolean)

  return {
    readiness: issues.some(issue => issue.level === 'high')
      ? 'blocked'
      : issues.length
        ? 'needs_hardening'
        : 'launch_ready',
    summary: {
      environment: env.TIXIAOZHU_ENV || env.NODE_ENV || 'development',
      questionPacks: Array.isArray(store.questionPacks) ? store.questionPacks.length : 0,
      questions: Array.isArray(store.questions) ? store.questions.length : 0,
      knowledgePoints: Array.isArray(store.knowledgePoints) ? store.knowledgePoints.length : 0,
      paymentMode,
      aiProvider,
      dataLayer,
      hasDatabase,
      hasStudentAuth,
      hasAdminPasswordHash,
      requireStudentAuth,
      paymentLaunchStrategy,
      paymentDeferred,
      ocrLaunchStrategy,
      ocrDeferred,
      hasPaymentWebhookSecret,
      hasProductionAiService,
      hasProductionOcrService,
      hasObjectStorage,
      hasMonitoring,
      explicitFrontendUrl,
      explicitAdminUrl,
    },
    issueCount: issues.length,
    deferredCount: deferredItems.length,
    deferredItems,
    issues,
  }
}
