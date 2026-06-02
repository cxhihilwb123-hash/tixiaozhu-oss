import { seedData } from '../src/seed-data.js'
import { buildProductReadinessReport } from '../src/product-readiness.js'

const buildRegressionStore = () => {
  const store = structuredClone(seedData)
  const testUser = store.users.find(user => user.grade === '一年级' && user.subject === '数学') || store.users[0]
  store.learningRecords.unshift({
    id: 'lr-uploaded-regression',
    userId: testUser.id,
    user: testUser.nickname,
    packId: 'upload-pack-regression',
    pack: '拍题单题订正',
    subject: '数学',
    roundType: 'uploaded',
    completedAt: '2026-05-14 10:00',
    total: 1,
    correct: 0,
    wrong: 1,
    weakKnowledgePoints: ['未归类知识点'],
  })
  store.wrongQuestions.unshift({
    id: 'wq-regression-upl-1',
    questionId: 'upl-regression-1',
    userId: testUser.id,
    user: testUser.nickname,
    subject: '数学',
    knowledgePoint: '未归类知识点',
    content: '计算 12 + 7 = ?',
    wrongAnswer: '18',
    correctAnswer: '19',
    practiceCount: 1,
    mastered: false,
    status: 'new',
    statusLabel: '新错题',
  })
  return store
}

const report = buildProductReadinessReport(buildRegressionStore())

console.log(JSON.stringify({
  readiness: report.readiness,
  summary: report.summary,
  issueCount: report.issues.length,
  issues: report.issues,
}, null, 2))

if (report.issues.length > 0) {
  console.error(JSON.stringify(report.samples, null, 2))
  process.exit(1)
}
