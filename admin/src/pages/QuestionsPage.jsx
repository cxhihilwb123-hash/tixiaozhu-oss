import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Plus, Edit, Trash2, Eye, MoreVertical, BookOpen, Filter, Upload } from 'lucide-react'
import { apiGet, apiPatch, apiPost } from '../utils/api'

// Mock question packs data
const mockQuestionPacks = import.meta.env.PROD ? [] : [
  { id: 1, name: '四年级数学上册第1单元同步练', subject: '数学', grade: '四年级', semester: '上册', unitIndex: 1, unitName: '大数的认识', series: 'textbook', questionCount: 8, difficulty: '中等', status: 'published', source: 'curriculum_seed', isMemberOnly: false, createdAt: '2026-04-27', usageCount: 1250, structure: '课前预习2题 · 课中巩固3题 · 课后提升2题 · 易错回收1题', coverage: '大数的认识' },
  { id: 2, name: '五年级语文阅读理解专项', subject: '语文', grade: '五年级', semester: '全册', unitName: '阅读理解专项', series: 'special', questionCount: 10, difficulty: '较难', status: 'published', source: 'curriculum_seed', isMemberOnly: true, createdAt: '2026-04-27', usageCount: 456, structure: '基础辨析3题 · 方法训练4题 · 变式提升2题 · 易错回收1题', coverage: '阅读理解专项' },
  { id: 3, name: '三年级英语上册期末卷', subject: '英语', grade: '三年级', semester: '上册', unitName: '上册期末卷', series: 'paper', questionCount: 12, difficulty: '基础', status: 'published', source: 'curriculum_seed', isMemberOnly: true, createdAt: '2026-04-27', usageCount: 220, structure: '基础题4题 · 能力题4题 · 综合题3题 · 压轴表达1题', coverage: '上册综合检测' },
]

const mockQuestions = import.meta.env.PROD ? [] : [
  { id: 1, content: '下列哪个数是质数？', type: '选择题', subject: '数学', knowledgePoint: '质数与合数', difficulty: '基础', source: 'manual', packId: 1 },
  { id: 2, content: '计算：125 × 8 = ?', type: '填空题', subject: '数学', knowledgePoint: '乘法运算', difficulty: '基础', source: 'manual', packId: 1 },
  { id: 3, content: '小明有36颗糖果，要平均分给6个小朋友...', type: '应用题', subject: '数学', knowledgePoint: '除法应用', difficulty: '中等', source: 'manual', packId: 1 },
]

const QuestionsPage = () => {
  const [activeTab, setActiveTab] = useState('packs') // 'packs' | 'questions'
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('all')
  const [selectedSeries, setSelectedSeries] = useState('textbook')
  const [selectedGrade, setSelectedGrade] = useState('all')
  const [selectedSemester, setSelectedSemester] = useState('all')
  const [selectedUnit, setSelectedUnit] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedPackId, setSelectedPackId] = useState(null)
  const [pointCostDraft, setPointCostDraft] = useState('')
  const [showAllQuestions, setShowAllQuestions] = useState(false)
  const [adjustmentSearch, setAdjustmentSearch] = useState('')
  const [operationMessage, setOperationMessage] = useState('')
  const [questionPacks, setQuestionPacks] = useState(import.meta.env.PROD ? [] : mockQuestionPacks)
  const [questions, setQuestions] = useState(import.meta.env.PROD ? [] : mockQuestions)
  const [uploadedQuestions, setUploadedQuestions] = useState([])
  const [selectedCurrentQuestionIds, setSelectedCurrentQuestionIds] = useState([])
  const [selectedCandidateQuestionIds, setSelectedCandidateQuestionIds] = useState([])
  const [packVersions, setPackVersions] = useState([])
  const [qualityReport, setQualityReport] = useState(null)

  useEffect(() => {
    apiGet('/question-packs', mockQuestionPacks).then(items => setQuestionPacks(items || []))
    apiGet('/questions', mockQuestions).then(items => setQuestions(items || []))
    apiGet('/uploaded-questions', []).then(items => setUploadedQuestions(items || []))
    apiGet('/question-bank-quality', null).then(setQualityReport)
  }, [])

  const subjectOptions = Array.from(new Set([
    ...questionPacks.map(pack => pack.subject),
    ...questions.map(question => question.subject),
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))

  const gradeOptions = Array.from(new Set(questionPacks.map(pack => pack.grade).filter(Boolean)))
    .sort((a, b) => String(a).localeCompare(String(b), 'zh-Hans-CN', { numeric: true }))

  const getPackSeries = (pack) => pack.series || (pack.roundType === 'daily' ? 'textbook' : pack.roundType) || 'textbook'

  const seriesDefinitions = [
    { value: 'textbook', label: '教材同步', description: '按年级、册次、单元推进课堂同步练' },
    { value: 'special', label: '专项训练', description: '按能力模块集中补短板' },
    { value: 'paper', label: '试卷', description: '单元卷和期末卷用于阶段检测' },
  ]

  const seriesOverview = seriesDefinitions.map((item) => {
    const packs = questionPacks.filter(pack => getPackSeries(pack) === item.value)
    return {
      ...item,
      packs,
      questionCount: packs.reduce((sum, pack) => sum + Number(pack.questionCount || 0), 0),
      publishedCount: packs.filter(pack => pack.status === 'published').length,
    }
  })

  const unitOptions = Array.from(new Set(questionPacks.filter((pack) => {
    if (getPackSeries(pack) !== 'textbook') return false
    if (selectedSubject !== 'all' && pack.subject !== selectedSubject) return false
    if (selectedGrade !== 'all' && pack.grade !== selectedGrade) return false
    if (selectedSemester !== 'all' && pack.semester !== selectedSemester) return false
    return Boolean(pack.unitName)
  }).map(pack => pack.unitName)))
  
  const filteredPacks = questionPacks.filter(pack => {
    if (searchTerm && !`${pack.name}${pack.coverage || ''}${pack.unitName || ''}`.includes(searchTerm)) return false
    if (selectedSubject !== 'all' && pack.subject !== selectedSubject) return false
    if (selectedSeries !== 'all' && getPackSeries(pack) !== selectedSeries) return false
    if (selectedGrade !== 'all' && pack.grade !== selectedGrade) return false
    if (selectedSeries === 'textbook' && selectedSemester !== 'all' && pack.semester !== selectedSemester) return false
    if (selectedSeries === 'textbook' && selectedUnit !== 'all' && pack.unitName !== selectedUnit) return false
    if (selectedStatus !== 'all' && pack.status !== selectedStatus) return false
    return true
  })

  const activePack = useMemo(() => {
    const selected = questionPacks.find(pack => String(pack.id) === String(selectedPackId))
    if (selected && filteredPacks.some(pack => String(pack.id) === String(selected.id))) return selected
    return filteredPacks[0] || null
  }, [filteredPacks, questionPacks, selectedPackId])

  useEffect(() => {
    if (activePack) setPointCostDraft(String(activePack.pointCost || 0))
  }, [activePack])

  useEffect(() => {
    setShowAllQuestions(false)
    setAdjustmentSearch('')
    setOperationMessage('')
    setSelectedCurrentQuestionIds([])
    setSelectedCandidateQuestionIds([])
  }, [activePack?.id])

  useEffect(() => {
    if (!activePack?.id) {
      setPackVersions([])
      return
    }
    apiGet(`/question-packs/${encodeURIComponent(activePack.id)}/versions`, []).then(setPackVersions)
  }, [activePack?.id])

  const activePackQuestions = useMemo(() => {
    if (!activePack) return []
    return questions
      .filter(question => String(question.packId) === String(activePack.id))
      .sort((a, b) => Number(a.sortOrder ?? a.order ?? 9999) - Number(b.sortOrder ?? b.order ?? 9999))
  }, [activePack, questions])

  const activePackKnowledgePoints = useMemo(() => {
    if (!activePack) return []
    return Array.from(new Set([
      activePack.unitName,
      ...(String(activePack.coverage || '').split('、')),
      ...activePackQuestions.map(question => question.knowledgePoint),
    ].filter(Boolean))).slice(0, 12)
  }, [activePack, activePackQuestions])

  const activePackTypeCounts = useMemo(() => {
    return activePackQuestions.reduce((result, question) => {
      const type = question.type || '未分类'
      result[type] = (result[type] || 0) + 1
      return result
    }, {})
  }, [activePackQuestions])

  const candidateQuestions = useMemo(() => {
    if (!activePack) return []
    const search = adjustmentSearch.trim()
    return questions
      .filter((question) => String(question.packId) !== String(activePack.id))
      .filter((question) => question.subject === activePack.subject && question.grade === activePack.grade)
      .filter((question) => {
        if (!search) return true
        return `${question.content}${question.knowledgePoint || ''}${question.type || ''}`.includes(search)
      })
      .slice(0, 10)
  }, [activePack, adjustmentSearch, questions])

  const updatePackState = (updatedPack) => {
    if (!updatedPack) return
    setQuestionPacks(current => current.map(pack => (
      String(pack.id) === String(updatedPack.id) ? { ...pack, ...updatedPack } : pack
    )))
    setSelectedPackId(updatedPack.id)
  }

  const prependVersion = (version) => {
    if (!version) return
    setPackVersions(current => [version, ...current.filter(item => item.id !== version.id)])
  }

  const patchActivePack = async (changes, successMessage) => {
    if (!activePack) return
    const fallback = () => ({ ...activePack, ...changes })
    const updated = await apiPatch(`/question-packs/${encodeURIComponent(activePack.id)}`, changes, fallback)
    updatePackState(updated)
    apiGet(`/question-packs/${encodeURIComponent(activePack.id)}/versions`, []).then(setPackVersions)
    setOperationMessage(successMessage)
  }

  const patchQuestionAssignment = async (question, nextPackId) => {
    if (!activePack) return
    const result = await apiPatch(`/questions/${encodeURIComponent(question.id)}`, { packId: nextPackId }, () => ({
      question: { ...question, packId: nextPackId },
      affectedPacks: [],
    }))

    if (!result) return
    setQuestions(current => current.map(item => (
      String(item.id) === String(result.question.id) ? { ...item, ...result.question } : item
    )))

    if (Array.isArray(result.affectedPacks) && result.affectedPacks.length > 0) {
      setQuestionPacks(current => current.map(pack => {
        const affected = result.affectedPacks.find(item => String(item.id) === String(pack.id))
        return affected ? { ...pack, ...affected } : pack
      }))
    } else {
      setQuestionPacks(current => current.map(pack => {
        if (String(pack.id) === String(activePack.id)) {
          const delta = nextPackId ? 1 : -1
          return { ...pack, questionCount: Math.max(0, Number(pack.questionCount || 0) + delta) }
        }
        return pack
      }))
    }

    prependVersion(result.version)
    setOperationMessage(nextPackId ? '已调入当前题包。' : '已从当前题包移出。')
  }

  const patchBulkAssignment = async (action, questionIds) => {
    if (!activePack || questionIds.length === 0) return
    const result = await apiPost(`/question-packs/${encodeURIComponent(activePack.id)}/questions/bulk`, {
      action,
      questionIds,
    }, null)
    if (!result) return
    const updatedById = new Map((result.questions || []).map(question => [String(question.id), question]))
    setQuestions(current => current.map(question => updatedById.get(String(question.id)) || question))
    if (Array.isArray(result.affectedPacks)) {
      setQuestionPacks(current => current.map(pack => {
        const affected = result.affectedPacks.find(item => String(item.id) === String(pack.id))
        return affected ? { ...pack, ...affected } : pack
      }))
    }
    prependVersion(result.version)
    if (action === 'remove') setSelectedCurrentQuestionIds([])
    if (action === 'add') setSelectedCandidateQuestionIds([])
    setOperationMessage(action === 'remove' ? `已批量移出 ${questionIds.length} 道题。` : `已批量调入 ${questionIds.length} 道题。`)
  }

  const reorderQuestion = async (questionId, direction) => {
    if (!activePack) return
    const currentIndex = activePackQuestions.findIndex(question => String(question.id) === String(questionId))
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= activePackQuestions.length) return
    const nextOrder = activePackQuestions.map(question => String(question.id))
    const [target] = nextOrder.splice(currentIndex, 1)
    nextOrder.splice(nextIndex, 0, target)
    const result = await apiPatch(`/question-packs/${encodeURIComponent(activePack.id)}/questions/reorder`, {
      questionIds: nextOrder,
    }, null)
    if (!result) return
    const updatedById = new Map((result.questions || []).map(question => [String(question.id), question]))
    setQuestions(current => current.map(question => updatedById.get(String(question.id)) || question))
    if (result.pack) updatePackState(result.pack)
    prependVersion(result.version)
    setOperationMessage('已调整题目顺序。')
  }

  const toggleSelected = (questionId, selectedIds, setSelectedIds) => {
    const id = String(questionId)
    setSelectedIds(selectedIds.includes(id)
      ? selectedIds.filter(item => item !== id)
      : [...selectedIds, id]
    )
  }

  const readinessMap = {
    ready: ['可运营', 'badge-admin badge-success'],
    watch: ['需关注', 'badge-admin badge-warning'],
    needs_fix: ['需修复', 'badge-admin badge-error'],
  }
  
  const getStatusBadge = (status) => {
    switch (status) {
      case 'published':
        return <span className="badge-admin badge-success">已发布</span>
      case 'draft':
        return <span className="badge-admin badge-warning">草稿</span>
      case 'review':
        return <span className="badge-admin badge-info">待审核</span>
      default:
        return <span className="badge-admin badge-info">{status}</span>
    }
  }
  
  const getDifficultyBadge = (difficulty) => {
    switch (difficulty) {
      case '基础':
        return <span className="badge-admin badge-success">{difficulty}</span>
      case '中等':
        return <span className="badge-admin badge-info">{difficulty}</span>
      case '较难':
        return <span className="badge-admin badge-warning">{difficulty}</span>
      case '困难':
        return <span className="badge-admin badge-error">{difficulty}</span>
      default:
        return <span className="badge-admin badge-info">{difficulty}</span>
    }
  }

  const getSourceBadge = (source) => {
    const sourceMap = {
      manual: ['人工录入', 'badge-admin badge-success'],
      imported: ['批量导入', 'badge-admin badge-info'],
      ai_generated: ['AI生成', 'badge-admin badge-warning'],
      curriculum_seed: ['课程种子库', 'badge-admin badge-info'],
      in_house_curated: ['自研精品题库', 'badge-admin badge-success'],
      uploaded: ['拍题识别', 'badge-admin badge-info'],
      wrong_recovery: ['错题回收', 'badge-admin badge-error'],
    }
    const [label, className] = sourceMap[source] || ['人工录入', 'badge-admin badge-success']
    return <span className={className}>{label}</span>
  }

  const getSeriesBadge = (pack) => {
    const series = pack.series || pack.roundType
    const map = {
      textbook: ['教材同步', 'badge-admin badge-success'],
      daily: ['教材同步', 'badge-admin badge-success'],
      special: ['专项训练', 'badge-admin badge-warning'],
      paper: ['试卷', 'badge-admin badge-info'],
    }
    const [label, className] = map[series] || [pack.seriesName || '训练题包', 'badge-admin badge-info']
    return <span className={className}>{label}</span>
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-800">习题内容中心</h1>
          <p className="text-sm text-neutral-500 mt-1">单题库负责内容资产，题包负责训练产品，拍题沉淀负责用户个人题库</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-admin btn-admin-secondary flex items-center gap-2">
            <Upload size={16} />
            批量导入
          </button>
          <button className="btn-admin btn-admin-primary flex items-center gap-2">
            <Plus size={16} />
            新建题包
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary-600">
            <BookOpen size={18} />
            单题库
          </div>
          <div className="text-2xl font-semibold text-neutral-800">{questions.length}</div>
          <div className="mt-1 text-sm text-neutral-500">按学科、年级、知识点维护原子题</div>
        </div>
        <div className="stat-card">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-green-600">
            <Filter size={18} />
            训练题包
          </div>
          <div className="text-2xl font-semibold text-neutral-800">{questionPacks.length}</div>
          <div className="mt-1 text-sm text-neutral-500">由单题按训练目标编排成每日练、专项和小卷</div>
        </div>
        <div className="stat-card">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-orange-600">
            <Upload size={18} />
            拍题沉淀
          </div>
          <div className="text-2xl font-semibold text-neutral-800">{uploadedQuestions.length}</div>
          <div className="mt-1 text-sm text-neutral-500">来自学生拍照/手动输入，默认进入个人拍题本</div>
        </div>
      </div>

      {qualityReport && (
        <div className="stat-card">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                <Filter size={18} />
                题库质检
                <span className={readinessMap[qualityReport.readiness]?.[1] || 'badge-admin badge-info'}>
                  {readinessMap[qualityReport.readiness]?.[0] || '检查中'}
                </span>
              </div>
              <div className="mt-1 text-xs text-neutral-500">自动检查题量、来源、质量字段、重复题干、审核状态和低覆盖题包。</div>
            </div>
            <div className="text-right text-xs text-neutral-500">
              平均质量分
              <div className="text-2xl font-semibold text-neutral-800">{qualityReport.summary?.avgQualityScore || 0}</div>
            </div>
          </div>

          <div className="grid grid-cols-8 gap-3">
            {[
              ['题包', qualityReport.summary?.packs || 0],
              ['题目', qualityReport.summary?.questions || 0],
              ['知识点', qualityReport.summary?.knowledgePoints || 0],
              ['难度梯度', qualityReport.summary?.difficultyTierCount || 0],
              ['认知层级', qualityReport.summary?.cognitiveLevelCount || 0],
              ['内容层级', qualityReport.summary?.contentQualityLevelCount || 0],
              ['题组角色', qualityReport.summary?.variantFamilyCount || 0],
              ['问题项', qualityReport.issues?.length || 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-neutral-50 p-3">
                <div className="text-xs text-neutral-500">{label}</div>
                <div className="mt-1 text-lg font-semibold text-neutral-800">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-[1fr_1.2fr] gap-4">
            <div className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="mb-2 text-xs font-semibold text-neutral-500">内容结构</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(qualityReport.bySeries || {}).map(([label, count]) => (
                  <span key={label} className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">{label} {count}</span>
                ))}
                {Object.entries(qualityReport.bySource || {}).map(([label, count]) => (
                  <span key={label} className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">{label} {count}</span>
                ))}
              </div>
              <div className="mt-3 border-t border-neutral-100 pt-3">
                <div className="mb-2 text-xs font-semibold text-neutral-500">专业维度</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(qualityReport.byCognitiveLevel || {}).map(([label, count]) => (
                    <span key={label} className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">{label} {count}</span>
                  ))}
                  {Object.entries(qualityReport.byDifficultyTier || {}).map(([label, count]) => (
                    <span key={label} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">{label} {count}</span>
                  ))}
                  {Object.entries(qualityReport.byScenarioType || {}).slice(0, 4).map(([label, count]) => (
                    <span key={label} className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">{label} {count}</span>
                  ))}
                  {Object.entries(qualityReport.byContentQualityLevel || {}).map(([label, count]) => (
                    <span key={label} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">{label} {count}</span>
                  ))}
                  {Object.entries(qualityReport.byVariantFamily || {}).map(([label, count]) => (
                    <span key={label} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">{label} {count}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="mb-2 text-xs font-semibold text-neutral-500">质检提醒</div>
              <div className="grid gap-2">
                {(qualityReport.issues || []).slice(0, 4).map((issue) => (
                  <div key={issue.title} className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-neutral-800">{issue.title} · {issue.count}</div>
                      <div className="mt-1 text-xs text-neutral-500">{issue.action}</div>
                    </div>
                    <span className={issue.level === 'high' ? 'badge-admin badge-error' : issue.level === 'medium' ? 'badge-admin badge-warning' : 'badge-admin badge-info'}>
                      {issue.level === 'high' ? '高' : issue.level === 'medium' ? '中' : '低'}
                    </span>
                  </div>
                ))}
                {(!qualityReport.issues || qualityReport.issues.length === 0) && (
                  <div className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                    当前题库质检通过，可以继续扩充和上架。
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Tabs */}
      <div className="flex gap-4 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('packs')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'packs'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          题包管理
        </button>
        <button
          onClick={() => setActiveTab('questions')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'questions'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          单题管理
        </button>
        <button
          onClick={() => setActiveTab('uploads')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'uploads'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          拍题沉淀
        </button>
      </div>
      
      {activeTab === 'packs' && (
        <div className="grid grid-cols-[240px_280px_minmax(0,1fr)] gap-4">
          <div className="stat-card space-y-3">
            <div>
              <div className="text-sm font-semibold text-neutral-800">题库体系</div>
              <div className="mt-1 text-xs text-neutral-500">先看产品线，不先钻表格</div>
            </div>
            {seriesOverview.map((item) => (
              <button
                key={item.value}
                onClick={() => {
                  setSelectedSeries(item.value)
                  setSelectedSemester('all')
                  setSelectedUnit('all')
                }}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  selectedSeries === item.value ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-neutral-800">{item.label}</span>
                  <span className="badge-admin badge-info">{item.packs.length}包</span>
                </div>
                <div className="mt-1 text-xs text-neutral-500">{item.description}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-500">
                  <div>题量 <span className="font-semibold text-neutral-800">{item.questionCount}</span></div>
                  <div>发布 <span className="font-semibold text-neutral-800">{item.publishedCount}</span></div>
                </div>
              </button>
            ))}
          </div>

          <div className="stat-card space-y-4">
            <div>
              <div className="text-sm font-semibold text-neutral-800">年级与学科</div>
              <div className="mt-1 text-xs text-neutral-500">当前只保留小学考试主科</div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold text-neutral-500">年级</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setSelectedGrade('all')
                    setSelectedUnit('all')
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${selectedGrade === 'all' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'}`}
                >
                  全部
                </button>
                {gradeOptions.map((grade) => (
                  <button
                    key={grade}
                    onClick={() => {
                      setSelectedGrade(grade)
                      setSelectedUnit('all')
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium ${selectedGrade === grade ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'}`}
                  >
                    {grade}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold text-neutral-500">学科</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setSelectedSubject('all')
                    setSelectedUnit('all')
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${selectedSubject === 'all' ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-700'}`}
                >
                  全部
                </button>
                {subjectOptions.map(subject => (
                  <button
                    key={subject}
                    onClick={() => {
                      setSelectedSubject(subject)
                      setSelectedUnit('all')
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium ${selectedSubject === subject ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-700'}`}
                  >
                    {subject}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-neutral-800">
                  {seriesDefinitions.find(item => item.value === selectedSeries)?.label || '全部体系'}
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {selectedSeries === 'textbook' ? '按册次和单元定位同步练' : '按覆盖范围定位训练产品'}
                </div>
              </div>
              <span className="badge-admin badge-success">{filteredPacks.length} 个题包</span>
            </div>

            {selectedSeries === 'textbook' ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {['all', '上册', '下册'].map((semester) => (
                    <button
                      key={semester}
                      onClick={() => {
                        setSelectedSemester(semester)
                        setSelectedUnit('all')
                      }}
                      className={`rounded-lg px-4 py-2 text-sm font-medium ${selectedSemester === semester ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'}`}
                    >
                      {semester === 'all' ? '全部册次' : semester}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                  <button
                    onClick={() => setSelectedUnit('all')}
                    className={`rounded-lg border px-3 py-3 text-left text-sm ${selectedUnit === 'all' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-neutral-200 bg-white text-neutral-700'}`}
                  >
                    全部单元
                  </button>
                  {unitOptions.map((unit) => (
                    <button
                      key={unit}
                      onClick={() => setSelectedUnit(unit)}
                      className={`rounded-lg border px-3 py-3 text-left text-sm ${selectedUnit === unit ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-neutral-200 bg-white text-neutral-700'}`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                {filteredPacks.slice(0, 9).map((pack) => (
                  <button
                    key={pack.id}
                    onClick={() => setSelectedPackId(pack.id)}
                    className={`rounded-lg border p-3 text-left hover:bg-neutral-50 ${
                      String(activePack?.id) === String(pack.id) ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <div className="text-sm font-semibold text-neutral-800">{pack.unitName || pack.coverage}</div>
                    <div className="mt-1 text-xs text-neutral-500">{pack.grade} · {pack.subject}</div>
                    <div className="mt-2 text-xs text-neutral-500">{pack.questionCount}题 · {pack.pointCost || 0}积分</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="stat-card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="搜索题包名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-admin pl-10 w-full"
            />
          </div>
          
          <select
            value={selectedSubject}
            onChange={(e) => {
              setSelectedSubject(e.target.value)
              setSelectedUnit('all')
            }}
            className="input-admin"
          >
            <option value="all">全部学科</option>
            {subjectOptions.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>

          <select
            value={selectedSeries}
            onChange={(e) => {
              setSelectedSeries(e.target.value)
              setSelectedSemester('all')
              setSelectedUnit('all')
            }}
            className="input-admin"
          >
            <option value="all">全部体系</option>
            <option value="textbook">教材同步</option>
            <option value="special">专项训练</option>
            <option value="paper">试卷</option>
          </select>

          <select
            value={selectedGrade}
            onChange={(e) => {
              setSelectedGrade(e.target.value)
              setSelectedUnit('all')
            }}
            className="input-admin"
          >
            <option value="all">全部年级</option>
            {gradeOptions.map(grade => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
          
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="input-admin"
          >
            <option value="all">全部状态</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
            <option value="review">待审核</option>
          </select>
        </div>
      </div>

      {activeTab === 'packs' && activePack && (
        <div className="stat-card">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {getSeriesBadge(activePack)}
                {getStatusBadge(activePack.status)}
                {getSourceBadge(activePack.source)}
              </div>
              <h2 className="text-xl font-semibold text-neutral-800">{activePack.name}</h2>
              <p className="mt-1 text-sm text-neutral-500">
                {activePack.grade} · {activePack.subject} · {activePack.semester || '全册'}{activePack.unitIndex ? ` · 第${activePack.unitIndex}单元` : ''}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() => patchActivePack(
                  { status: activePack.status === 'published' ? 'draft' : 'published' },
                  activePack.status === 'published' ? '已下架题包。' : '已发布题包。'
                )}
                className={activePack.status === 'published' ? 'btn-admin btn-admin-secondary' : 'btn-admin btn-admin-primary'}
              >
                {activePack.status === 'published' ? '下架' : '发布'}
              </button>
              <button
                onClick={() => setShowAllQuestions(value => !value)}
                className="btn-admin btn-admin-secondary"
              >
                {showAllQuestions ? '收起题目' : '查看全部题目'}
              </button>
            </div>
          </div>

          <div className="mb-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-500">积分价格</label>
                <input
                  type="number"
                  min="0"
                  value={pointCostDraft}
                  onChange={(event) => setPointCostDraft(event.target.value)}
                  className="input-admin w-32 bg-white"
                />
              </div>
              <button
                onClick={() => patchActivePack(
                  { pointCost: Number(pointCostDraft || 0) },
                  Number(pointCostDraft || 0) > 0 ? '已更新积分价格。' : '已改为免费题包。'
                )}
                className="btn-admin btn-admin-primary"
              >
                保存价格
              </button>
              <div className="text-sm text-neutral-500">
                价格为 0 时自动进入免费题包；大于 0 时按积分解锁。
              </div>
              {operationMessage && (
                <div className="ml-auto rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                  {operationMessage}
                </div>
              )}
            </div>
          </div>

          <div className="mb-5 grid grid-cols-5 gap-3">
            {[
              ['题量', `${activePack.questionCount || activePackQuestions.length}题`],
              ['积分价格', Number(activePack.pointCost || 0) > 0 ? `${activePack.pointCost}积分` : '免费'],
              ['访问方式', (activePack.accessType || (activePack.isMemberOnly ? 'points' : 'free')) === 'points' ? '积分解锁' : '免费'],
              ['质量等级', activePack.qualityTier || '标准'],
              ['完成率', activePack.completionRate ? `${activePack.completionRate}%` : '-'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-neutral-50 p-3">
                <div className="text-xs text-neutral-500">{label}</div>
                <div className="mt-1 text-lg font-semibold text-neutral-800">{value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] gap-5">
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-sm font-semibold text-neutral-800">训练结构</div>
                <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-600">
                  {activePack.structure || '尚未配置训练结构'}
                </div>
                {activePack.sourcePolicy && (
                  <div className="mt-2 rounded-lg border border-green-100 bg-green-50 p-3 text-xs text-green-700">
                    {activePack.sourcePolicy}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-neutral-800">产品定位与适用场景</div>
                <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-600">
                  <div className="font-medium text-neutral-800">{activePack.productPositioning || '未配置定位'}</div>
                  <div className="mt-2">{activePack.suitableScene || '未配置场景'}</div>
                  <div className="mt-2 text-xs text-neutral-500">诊断重点：{activePack.diagnosticFocus || '-'}</div>
                  <div className="mt-1 text-xs text-neutral-500">前置建议：{activePack.prerequisite || '-'}</div>
                  {activePack.series === 'special' && (
                    <div className="mt-2 text-xs text-neutral-500">
                      专题焦点：{activePack.specialThemeFocus || activePack.coverage || '-'} · {activePack.coverageDepthLabel || '专题训练'}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-neutral-800">教学目标与能力标签</div>
                <div className="rounded-lg border border-neutral-200 bg-white p-3">
                  <div className="flex flex-wrap gap-2">
                    {(activePack.curriculumTags || []).map((tag) => (
                      <span key={tag} className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                        {tag}
                      </span>
                    ))}
                    {(activePack.targetAbility || []).map((tag) => (
                      <span key={tag} className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2">
                    {(activePack.learningObjectives || []).map((item) => (
                      <div key={item} className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                        {item}
                      </div>
                    ))}
                  </div>
                  {(activePack.editorialHighlights || []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activePack.editorialHighlights.map((item) => (
                        <span key={item} className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-neutral-800">知识点覆盖</div>
                <div className="flex flex-wrap gap-2">
                  {activePackKnowledgePoints.map((point) => (
                    <span key={point} className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
                      {point}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-neutral-800">题型分布</div>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(activePackTypeCounts).map(([type, count]) => (
                    <div key={type} className="rounded-lg border border-neutral-200 bg-white p-3">
                      <div className="text-xs text-neutral-500">{type}</div>
                      <div className="mt-1 text-lg font-semibold text-neutral-800">{count}</div>
                    </div>
                  ))}
                  {Object.keys(activePackTypeCounts).length === 0 && (
                    <div className="col-span-4 rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-500">
                      暂无可预览题目
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-neutral-800">题目预览</div>
                <span className="text-xs text-neutral-500">{activePackQuestions.length} 题</span>
              </div>
              <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                {(showAllQuestions ? activePackQuestions : activePackQuestions.slice(0, 8)).map((question, index) => (
                  <div key={question.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-neutral-500">第 {index + 1} 题 · {question.type}</span>
                      {getDifficultyBadge(question.difficulty)}
                    </div>
                    <div className="line-clamp-4 whitespace-pre-line text-sm leading-6 text-neutral-800">{question.content}</div>
                    <div className="mt-2 text-xs text-neutral-500">知识点：{question.knowledgePoint || '-'}</div>
                    <div className="mt-1 text-xs text-neutral-500">领域：{question.domain || '-'} · 认知：{question.cognitiveLevel || '-'} · 场景：{question.scenarioType || '-'}</div>
                    <div className="mt-1 text-xs text-neutral-500">梯度：{question.difficultyTier || '-'} · 阶段：{question.masteryStage || '-'} · 变式：{question.variantType || '-'}</div>
                    <div className="mt-1 text-xs text-neutral-500">能力：{question.ability || '-'} · 素养：{question.literacyDimension || '-'} · 易错：{question.commonMistake || '-'}</div>
                    <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      <div className="font-semibold">{question.contentQualityLevel || '高标准原创题'} · {question.teachingIntent || '未配置命题意图'}</div>
                      <div className="mt-1">{question.stemDesign || '-'}</div>
                    </div>
                    <div className="mt-2 text-xs text-neutral-500">题组：{question.variantFamily || '-'} · {question.tierTaskPrompt || '-'}</div>
                    {(question.solutionSteps || []).length > 0 && (
                      <div className="mt-2 text-xs text-neutral-500">步骤：{question.solutionSteps.slice(0, 4).join(' / ')}</div>
                    )}
                    <div className="mt-1 text-xs text-neutral-500">错因诊断：{question.misconceptionDiagnosis || '-'}</div>
                    <div className="mt-1 text-xs text-neutral-500">变式价值：{question.variantIntent || '-'}</div>
                    <div className="mt-1 text-xs text-neutral-500">答案：{question.answer || '-'}</div>
                  </div>
                ))}
                {activePackQuestions.length === 0 && (
                  <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
                    这个题包还没有题目明细。
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-neutral-800">调题工作台</div>
                <div className="mt-1 text-xs text-neutral-500">可把题目从当前题包移出，也可从同年级同学科题库调入。</div>
              </div>
              <div className="relative w-full max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  value={adjustmentSearch}
                  onChange={(event) => setAdjustmentSearch(event.target.value)}
                  className="input-admin w-full bg-neutral-50 pl-9"
                  placeholder="搜索可调入题目"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-neutral-500">当前题包题目</div>
                    {selectedCurrentQuestionIds.length > 0 && (
                      <button
                        onClick={() => patchBulkAssignment('remove', selectedCurrentQuestionIds)}
                        className="mt-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600"
                      >
                        批量移出 {selectedCurrentQuestionIds.length} 题
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedCurrentQuestionIds(
                      selectedCurrentQuestionIds.length === activePackQuestions.length
                        ? []
                        : activePackQuestions.map(question => String(question.id))
                    )}
                    className="text-xs font-semibold text-primary-700"
                  >
                    {selectedCurrentQuestionIds.length === activePackQuestions.length && activePackQuestions.length > 0 ? '取消全选' : `${activePackQuestions.length} 题`}
                  </button>
                </div>
                <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
                  {activePackQuestions.map((question, index) => (
                    <div key={question.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedCurrentQuestionIds.includes(String(question.id))}
                          onChange={() => toggleSelected(question.id, selectedCurrentQuestionIds, setSelectedCurrentQuestionIds)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 text-xs font-semibold text-neutral-400">第 {index + 1} 题</div>
                          <div className="line-clamp-2 text-sm text-neutral-800">{question.content}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-xs text-neutral-500">{question.type} · {question.knowledgePoint || '-'}</span>
                        <div className="flex items-center gap-1">
                          <button
                            disabled={index === 0}
                            onClick={() => reorderQuestion(question.id, -1)}
                            className="rounded-lg bg-white px-2 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            上移
                          </button>
                          <button
                            disabled={index === activePackQuestions.length - 1}
                            onClick={() => reorderQuestion(question.id, 1)}
                            className="rounded-lg bg-white px-2 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            下移
                          </button>
                          <button
                            onClick={() => patchQuestionAssignment(question, null)}
                            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            移出
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-neutral-500">可调入题目</div>
                    {selectedCandidateQuestionIds.length > 0 && (
                      <button
                        onClick={() => patchBulkAssignment('add', selectedCandidateQuestionIds)}
                        className="mt-1 rounded-lg bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700"
                      >
                        批量调入 {selectedCandidateQuestionIds.length} 题
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedCandidateQuestionIds(
                      selectedCandidateQuestionIds.length === candidateQuestions.length
                        ? []
                        : candidateQuestions.map(question => String(question.id))
                    )}
                    className="text-xs font-semibold text-primary-700"
                  >
                    {selectedCandidateQuestionIds.length === candidateQuestions.length && candidateQuestions.length > 0 ? '取消全选' : `${candidateQuestions.length} 题`}
                  </button>
                </div>
                <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
                  {candidateQuestions.map((question) => (
                    <div key={question.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedCandidateQuestionIds.includes(String(question.id))}
                          onChange={() => toggleSelected(question.id, selectedCandidateQuestionIds, setSelectedCandidateQuestionIds)}
                          className="mt-1"
                        />
                        <div className="line-clamp-2 min-w-0 flex-1 text-sm text-neutral-800">{question.content}</div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-xs text-neutral-500">{question.type} · {question.knowledgePoint || '-'}</span>
                        <button
                          onClick={() => patchQuestionAssignment(question, activePack.id)}
                          className="rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
                        >
                          调入
                        </button>
                      </div>
                    </div>
                  ))}
                  {candidateQuestions.length === 0 && (
                    <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
                      暂无同年级同学科可调入题目。
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-neutral-800">题包版本记录</div>
                <div className="mt-1 text-xs text-neutral-500">发布、调题、排序和价格变化会留下运营痕迹。</div>
              </div>
              <span className="badge-admin badge-info">{packVersions.length} 条</span>
            </div>
            <div className="grid gap-2">
              {packVersions.slice(0, 6).map((version) => (
                <div key={version.id} className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-neutral-800">V{version.versionNo} · {version.summary}</div>
                    <div className="mt-1 text-xs text-neutral-500">{version.createdAt} · {version.operator || 'admin'}</div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-neutral-500">{version.questionCount}题</span>
                </div>
              ))}
              {packVersions.length === 0 && (
                <div className="rounded-lg border border-dashed border-neutral-300 p-5 text-center text-sm text-neutral-500">
                  暂无版本记录，发布、调题或排序后会自动生成。
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Content */}
      {activeTab === 'packs' ? (
        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>题包名称</th>
                <th>体系</th>
                <th>学科</th>
                <th>年级</th>
                <th>册/单元</th>
                <th>题量</th>
                <th>训练结构</th>
                <th>覆盖范围</th>
                <th>来源</th>
                <th>难度</th>
                <th>状态</th>
                <th>会员专属</th>
                <th>使用次数</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredPacks.map((pack) => (
                <motion.tr
                  key={pack.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-neutral-50"
                >
                  <td className="font-medium text-neutral-800">{pack.name}</td>
                  <td>{getSeriesBadge(pack)}</td>
                  <td className="text-neutral-600">{pack.subject}</td>
                  <td className="text-neutral-600">{pack.grade}</td>
                  <td className="text-neutral-600">{pack.semester || '-'}{pack.unitIndex ? ` · 第${pack.unitIndex}单元` : ''}</td>
                  <td className="text-neutral-600">{pack.questionCount}题</td>
                  <td className="max-w-xs text-neutral-600">{pack.structure || '-'}</td>
                  <td className="max-w-xs text-neutral-600">{pack.coverage || pack.unitName || '-'}</td>
                  <td>{getSourceBadge(pack.source)}</td>
                  <td>{getDifficultyBadge(pack.difficulty)}</td>
                  <td>{getStatusBadge(pack.status)}</td>
                  <td>
                    {pack.isMemberOnly ? (
                      <span className="text-primary-600">是</span>
                    ) : (
                      <span className="text-neutral-400">否</span>
                    )}
                  </td>
                  <td className="text-neutral-600">{pack.usageCount}</td>
                  <td className="text-neutral-500">{pack.createdAt}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedPackId(pack.id)}
                        className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500"
                        title="查看题包详情"
                      >
                        <Eye size={16} />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500">
                        <Edit size={16} />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'questions' ? (
        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>题目内容</th>
                <th>题型</th>
                <th>学科</th>
                <th>知识点</th>
                <th>领域</th>
                <th>能力</th>
                <th>梯度</th>
                <th>认知层级</th>
                <th>难度</th>
                <th>来源</th>
                <th>所属题包</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((question) => (
                <motion.tr
                  key={question.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-neutral-50"
                >
                  <td className="max-w-xs truncate text-neutral-800">{question.content}</td>
                  <td className="text-neutral-600">{question.type}</td>
                  <td className="text-neutral-600">{question.subject}</td>
                  <td className="text-neutral-600">{question.knowledgePoint}</td>
                  <td className="text-neutral-600">{question.domain || '-'}</td>
                  <td className="text-neutral-600">{question.ability || '-'}</td>
                  <td className="text-neutral-600">{question.difficultyTier || '-'}</td>
                  <td className="text-neutral-600">{question.cognitiveLevel || '-'}</td>
                  <td>{getDifficultyBadge(question.difficulty)}</td>
                  <td>{getSourceBadge(question.source)}</td>
                  <td className="text-neutral-600">题包#{question.packId}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500">
                        <Eye size={16} />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500">
                        <Edit size={16} />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-neutral-100 text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>题目内容</th>
                <th>用户</th>
                <th>学科</th>
                <th>知识点</th>
                <th>批改状态</th>
                <th>来源</th>
                <th>上传时间</th>
                <th>运营去向</th>
              </tr>
            </thead>
            <tbody>
              {uploadedQuestions.map((question) => (
                <motion.tr
                  key={question.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-neutral-50"
                >
                  <td className="max-w-xs truncate text-neutral-800">{question.content}</td>
                  <td className="text-neutral-600">{question.user || '-'}</td>
                  <td className="text-neutral-600">{question.subject}</td>
                  <td className="text-neutral-600">{question.knowledgePoint || '-'}</td>
                  <td>
                    <span className={question.correctionStatus === 'wrong' ? 'badge-admin badge-error' : question.correctionStatus === 'correct' ? 'badge-admin badge-success' : 'badge-admin badge-warning'}>
                      {question.correctionStatus === 'wrong' ? '待订正' : question.correctionStatus === 'correct' ? '已批改' : '待作答'}
                    </span>
                  </td>
                  <td>{getSourceBadge('uploaded')}</td>
                  <td className="text-neutral-500">{question.uploadedAt}</td>
                  <td className="text-neutral-600">个人拍题本 · 可转正式题库</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-500">
          共 {activeTab === 'packs' ? filteredPacks.length : activeTab === 'questions' ? questions.length : uploadedQuestions.length} 条记录
        </div>
        <div className="flex gap-2">
          <button className="btn-admin btn-admin-secondary">上一页</button>
          <button className="btn-admin btn-admin-primary">1</button>
          <button className="btn-admin btn-admin-secondary">下一页</button>
        </div>
      </div>
    </motion.div>
  )
}

export default QuestionsPage
