import { seedData } from '../src/seed-data.js'

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

const requiredPackFields = [
  'name',
  'subject',
  'grade',
  'series',
  'questionCount',
  'structure',
  'coverage',
  'productPositioning',
  'suitableScene',
  'diagnosticFocus',
  'prerequisite',
  'learningObjectives',
  'targetAbility',
  'curriculumTags',
  'qualityTier',
  'sourcePolicy',
]

const groupBy = (items, getKey) => items.reduce((result, item) => {
  const key = getKey(item)
  result[key] = (result[key] || 0) + 1
  return result
}, {})

const missingFields = (item, fields) => fields.filter(field => {
  const value = item[field]
  return value === undefined || value === null || value === ''
})

const packs = seedData.questionPacks
const questions = seedData.questions
const packIds = new Set(packs.map(pack => pack.id))
const orphanQuestions = questions.filter(question => !packIds.has(question.packId))
const packIssues = packs
  .map(pack => ({ id: pack.id, missing: missingFields(pack, requiredPackFields) }))
  .filter(item => item.missing.length > 0)
const questionIssues = questions
  .map(question => ({ id: question.id, missing: missingFields(question, requiredQuestionFields) }))
  .filter(item => item.missing.length > 0)
const actualCountMismatch = packs
  .map(pack => ({
    id: pack.id,
    expected: Number(pack.questionCount || 0),
    actual: questions.filter(question => question.packId === pack.id).length,
  }))
  .filter(item => item.expected !== item.actual)
const duplicateContent = Object.entries(questions.reduce((result, question) => {
  const key = String(question.content || '').replace(/\s+/g, '')
  if (key) result[key] = (result[key] || 0) + 1
  return result
}, {})).filter(([, count]) => count > 1)
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
  !String(question.content || '').includes('题组角色') && !String(question.content || '').includes('Item role')
))
const mechanicalOriginalStem = questions.filter(question => /^(计算：|解方程：|.*练习题\s*\d+$)/.test(String(question.originalStem || '').trim()))

const summary = {
  packs: packs.length,
  questions: questions.length,
  knowledgePoints: seedData.knowledgePoints.length,
  bySeries: groupBy(packs, pack => pack.series || 'unknown'),
  bySubject: groupBy(packs, pack => pack.subject || 'unknown'),
  questionsBySubject: groupBy(questions, question => question.subject || 'unknown'),
  questionsByDomain: groupBy(questions, question => question.domain || 'unknown'),
  difficultyTiers: groupBy(questions, question => question.difficultyTier || 'unknown'),
  masteryStages: groupBy(questions, question => question.masteryStage || 'unknown'),
  cognitiveLevels: groupBy(questions, question => question.cognitiveLevel || 'unknown'),
  scenarioTypes: groupBy(questions, question => question.scenarioType || 'unknown'),
  contentQualityLevels: groupBy(questions, question => question.contentQualityLevel || 'unknown'),
  variantFamilies: groupBy(questions, question => question.variantFamily || 'unknown'),
  averageQuestionsPerPack: Math.round((questions.length / Math.max(1, packs.length)) * 10) / 10,
  sourceLabels: groupBy(packs, pack => pack.sourceLabel || pack.source || 'unknown'),
  qualityTiers: groupBy(packs, pack => pack.qualityTier || 'unknown'),
  orphanQuestions: orphanQuestions.length,
  packIssues: packIssues.length,
  questionIssues: questionIssues.length,
  countMismatches: actualCountMismatch.length,
  duplicateContentGroups: duplicateContent.length,
  weakExpertDesign: weakExpertDesign.length,
  thinQuestionBody: thinQuestionBody.length,
  mechanicalOriginalStem: mechanicalOriginalStem.length,
}

console.log(JSON.stringify(summary, null, 2))

if (orphanQuestions.length || packIssues.length || questionIssues.length || actualCountMismatch.length || duplicateContent.length || weakExpertDesign.length || thinQuestionBody.length || mechanicalOriginalStem.length) {
  console.error(JSON.stringify({
    orphanQuestions: orphanQuestions.slice(0, 10).map(question => question.id),
    packIssues: packIssues.slice(0, 10),
    questionIssues: questionIssues.slice(0, 10),
    actualCountMismatch: actualCountMismatch.slice(0, 10),
    duplicateContent: duplicateContent.slice(0, 10).map(([contentKey, count]) => ({ contentKey, count })),
    weakExpertDesign: weakExpertDesign.slice(0, 10).map(question => ({ id: question.id, content: question.content })),
    thinQuestionBody: thinQuestionBody.slice(0, 10).map(question => ({ id: question.id, content: question.content })),
    mechanicalOriginalStem: mechanicalOriginalStem.slice(0, 10).map(question => ({ id: question.id, originalStem: question.originalStem })),
  }, null, 2))
  process.exit(1)
}
