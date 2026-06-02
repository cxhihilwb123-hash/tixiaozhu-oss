const PRIMARY_SUBJECTS = new Set(['数学', '语文', '英语'])
const PRIMARY_GRADES = new Set(['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'])
const USER_GENERATED_ROUND_TYPES = new Set(['uploaded', 'wrong', 'custom', 'manual'])
const UNCLASSIFIED_KNOWLEDGE_POINTS = new Set(['未归类知识点'])

const countBy = (items, getKey) => items.reduce((result, item) => {
  const key = getKey(item) || '未标注'
  result[key] = (result[key] || 0) + 1
  return result
}, {})

const normalizeName = (value) => String(value || '').trim()

const isPrimaryUser = (user) => PRIMARY_GRADES.has(user.grade) && PRIMARY_SUBJECTS.has(user.subject)

const isPrimaryGeneration = (item) => PRIMARY_GRADES.has(item.grade) && PRIMARY_SUBJECTS.has(item.subject)

const hasUserGeneratedPackId = (packId) => {
  const value = String(packId || '')
  return value.startsWith('upload-pack-') || value.startsWith('wrong-pack-') || value.startsWith('custom-pack-')
}

const isUserGeneratedLearningRecord = (record) => (
  USER_GENERATED_ROUND_TYPES.has(String(record.roundType || ''))
  || hasUserGeneratedPackId(record.packId)
)

const isUserGeneratedWrongQuestion = (item) => (
  String(item.questionId || '').startsWith('upl-')
  || String(item.id || '').includes('-upl-')
  || UNCLASSIFIED_KNOWLEDGE_POINTS.has(normalizeName(item.knowledgePoint))
)

export const buildProductReadinessReport = (store) => {
  const users = Array.isArray(store.users) ? store.users : []
  const questionPacks = Array.isArray(store.questionPacks) ? store.questionPacks : []
  const questions = Array.isArray(store.questions) ? store.questions : []
  const knowledgePoints = Array.isArray(store.knowledgePoints) ? store.knowledgePoints : []
  const learningRecords = Array.isArray(store.learningRecords) ? store.learningRecords : []
  const wrongQuestions = Array.isArray(store.wrongQuestions) ? store.wrongQuestions : []
  const aiGenerationHistory = Array.isArray(store.aiGenerationHistory) ? store.aiGenerationHistory : []
  const contentPurchases = Array.isArray(store.contentPurchases) ? store.contentPurchases : []
  const pointTransactions = Array.isArray(store.pointTransactions) ? store.pointTransactions : []

  const userMap = new Map(users.map(user => [normalizeName(user.nickname), user]))
  const packIdMap = new Map(questionPacks.map(pack => [String(pack.id), pack]))
  const packNameMap = new Map(questionPacks.map(pack => [normalizeName(pack.name), pack]))
  const knowledgePointNames = new Set(knowledgePoints.map(point => normalizeName(point.name)).filter(Boolean))
  const contentPurchaseIds = new Set(contentPurchases.map(item => String(item.id)))
  const hasContentPurchaseForTransaction = (transaction) => contentPurchases.some((purchase) => (
    normalizeName(purchase.user) === normalizeName(transaction.user)
    && (
      String(purchase.id) === String(transaction.relatedId)
      || String(purchase.packId) === String(transaction.relatedId)
    )
  ))

  const nonPrimaryUsers = users.filter(user => !isPrimaryUser(user))
  const invalidLearningRecords = learningRecords.filter((record) => {
    const user = userMap.get(normalizeName(record.user))
    const pack = packIdMap.get(String(record.packId)) || packNameMap.get(normalizeName(record.pack))
    return !user
      || !PRIMARY_SUBJECTS.has(record.subject)
      || (!pack && !isUserGeneratedLearningRecord(record))
      || (pack && record.subject && pack.subject !== record.subject)
      || (user && record.userId && Number(user.id) !== Number(record.userId))
  })
  const invalidWrongQuestions = wrongQuestions.filter((item) => {
    const user = userMap.get(normalizeName(item.user))
    return !user
      || !PRIMARY_SUBJECTS.has(item.subject)
      || (!knowledgePointNames.has(normalizeName(item.knowledgePoint)) && !isUserGeneratedWrongQuestion(item))
  })
  const invalidAiGenerationHistory = aiGenerationHistory.filter(item => !isPrimaryGeneration(item))
  const invalidContentPurchases = contentPurchases.filter((item) => {
    const user = userMap.get(normalizeName(item.user))
    const pack = packIdMap.get(String(item.packId))
    return !user
      || !pack
      || Number(pack.pointCost || 0) <= 0
      || normalizeName(item.title) !== normalizeName(pack.name)
  })
  const invalidPointTransactions = pointTransactions.filter((item) => {
    if (!userMap.has(normalizeName(item.user))) return true
    if (item.action === 'content_purchase' && item.relatedId && !contentPurchaseIds.has(String(item.relatedId)) && !hasContentPurchaseForTransaction(item)) return true
    return false
  })

  const issues = [
    nonPrimaryUsers.length ? {
      level: 'high',
      title: '存在非小学主科用户样本',
      count: nonPrimaryUsers.length,
      action: '用户与运营样本统一回到一年级到六年级的数学、语文、英语口径',
    } : null,
    invalidLearningRecords.length ? {
      level: 'high',
      title: '学习记录引用了无效题包或错误用户',
      count: invalidLearningRecords.length,
      action: '修正学习记录中的用户、题包和学科关联，确保仪表盘统计可信',
    } : null,
    invalidContentPurchases.length ? {
      level: 'high',
      title: '内容购买记录指向无效题包',
      count: invalidContentPurchases.length,
      action: '将购买流水绑定到真实在售题包，避免题库商城和积分流水失真',
    } : null,
    invalidWrongQuestions.length ? {
      level: 'medium',
      title: '错题样本与当前知识点体系不一致',
      count: invalidWrongQuestions.length,
      action: '让错题回收、知识点榜单和推荐逻辑使用同一套小学主科知识点',
    } : null,
    invalidAiGenerationHistory.length ? {
      level: 'medium',
      title: 'AI出题历史仍含非目标学段',
      count: invalidAiGenerationHistory.length,
      action: '生成历史只保留小学主科样本，避免后台运营误判产品方向',
    } : null,
    invalidPointTransactions.length ? {
      level: 'medium',
      title: '积分流水与用户或购买记录不一致',
      count: invalidPointTransactions.length,
      action: '检查积分流水关联关系，保证积分审计链路可追溯',
    } : null,
  ].filter(Boolean)

  return {
    readiness: issues.some(issue => issue.level === 'high') ? 'needs_fix' : issues.length ? 'watch' : 'ready',
    summary: {
      users: users.length,
      primaryUsers: users.filter(isPrimaryUser).length,
      learningRecords: learningRecords.length,
      wrongQuestions: wrongQuestions.length,
      aiGenerationJobs: aiGenerationHistory.length,
      contentPurchases: contentPurchases.length,
      questionPacks: questionPacks.length,
      questions: questions.length,
      gradeCoverage: countBy(users.filter(isPrimaryUser), user => user.grade),
      subjectCoverage: countBy(users.filter(isPrimaryUser), user => user.subject),
    },
    issues,
    samples: {
      nonPrimaryUsers: nonPrimaryUsers.slice(0, 5).map(user => ({
        nickname: user.nickname,
        grade: user.grade,
        subject: user.subject,
      })),
      invalidLearningRecords: invalidLearningRecords.slice(0, 5).map(record => ({
        id: record.id,
        user: record.user,
        pack: record.pack,
        subject: record.subject,
      })),
      invalidWrongQuestions: invalidWrongQuestions.slice(0, 5).map(item => ({
        id: item.id,
        user: item.user,
        subject: item.subject,
        knowledgePoint: item.knowledgePoint,
      })),
      invalidAiGenerationHistory: invalidAiGenerationHistory.slice(0, 5).map(item => ({
        id: item.id,
        subject: item.subject,
        grade: item.grade,
      })),
      invalidContentPurchases: invalidContentPurchases.slice(0, 5).map(item => ({
        id: item.id,
        user: item.user,
        packId: item.packId,
        title: item.title,
      })),
      invalidPointTransactions: invalidPointTransactions.slice(0, 5).map(item => ({
        id: item.id,
        user: item.user,
        action: item.action,
        relatedId: item.relatedId,
      })),
    },
  }
}
