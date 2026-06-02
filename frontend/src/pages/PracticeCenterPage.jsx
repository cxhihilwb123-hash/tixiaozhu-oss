import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, BookOpen, Camera, CheckCircle2, Clock3, Download, FileText, Filter, Library, Search, ShoppingBag, Sparkles, Target } from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'
import Modal from '../components/Modal'
import { apiGet, openAuthorizedResource } from '../utils/api'
import { SUBJECT_OPTIONS, formatTime } from '../utils/constants'
import { useUploadStore, useUserStore, useWrongQuestionStore } from '../stores'

const roundTypes = [
  { value: 'all', label: '全部' },
  { value: 'daily', label: '教材同步' },
  { value: 'special', label: '专项训练' },
  { value: 'paper', label: '试卷' },
]

const subjectNameByValue = SUBJECT_OPTIONS.reduce((map, subject) => {
  map[subject.value] = subject.label
  return map
}, {})

const subjectValueByName = SUBJECT_OPTIONS.reduce((map, subject) => {
  map[subject.label] = subject.value
  return map
}, {})

const typeMap = {
  选择题: 'choice',
  填空题: 'fill',
  应用题: 'application',
  简答题: 'short_answer',
  判断题: 'judgment',
}

const difficultyMap = {
  基础: 1,
  中等: 2,
  较难: 3,
  困难: 4,
}

const recommendationBadge = (level) => ({
  high: '强推荐',
  medium: '适合练',
  normal: '可选练',
}[level] || '可选练')

const normalizePack = (pack) => ({
  ...pack,
  subjectValue: subjectValueByName[pack.subject] || pack.subject || 'math',
  subjectLabel: subjectNameByValue[pack.subject] || pack.subject || '数学',
  roundType: pack.roundType || 'daily',
  accessType: pack.accessType || (pack.isMemberOnly ? 'points' : 'free'),
  pointCost: Number(pack.pointCost || 0),
  owned: Boolean(pack.owned || pack.accessType === 'free' || Number(pack.pointCost || 0) <= 0),
})

const normalizeQuestion = (question) => ({
  ...question,
  type: typeMap[question.type] || question.type,
  subject: subjectValueByName[question.subject] || question.subject || 'math',
  difficulty: difficultyMap[question.difficulty] || question.difficulty || 2,
  answer: question.answer || question.correctAnswer,
})

const PracticeCenterPage = ({ onStartPractice, onOpenQuestionStore, initialLibraryMode = 'platform' }) => {
  const { isLoggedIn, studentProfile } = useUserStore()
  const {
    uploadedQuestions,
    uploadPracticePacks,
    setUploadedQuestions,
    createUploadPracticePack,
    incrementUploadedPracticeCount,
  } = useUploadStore()
  const {
    wrongQuestions,
    customPracticePacks,
    createWrongPracticePack,
    incrementManyPracticeCount,
  } = useWrongQuestionStore()
  const [packs, setPacks] = useState([])
  const [libraryMode, setLibraryMode] = useState('platform')
  const [subject, setSubject] = useState('all')
  const [roundType, setRoundType] = useState('all')
  const [search, setSearch] = useState('')
  const [loadingPackId, setLoadingPackId] = useState(null)
  const [message, setMessage] = useState('')
  const [selectedUploadIds, setSelectedUploadIds] = useState([])
  const [detailPack, setDetailPack] = useState(null)
  const [detailQuestions, setDetailQuestions] = useState([])
  const [loadingDetailPackId, setLoadingDetailPackId] = useState(null)

  useEffect(() => {
    if (!['platform', 'uploads', 'wrong'].includes(initialLibraryMode)) return
    setLibraryMode(initialLibraryMode)
    setSubject('all')
    setSearch('')
    setSelectedUploadIds([])
  }, [initialLibraryMode])

  useEffect(() => {
    if (!isLoggedIn) {
      setPacks([])
      return
    }
    apiGet(`/question-packs?user=${encodeURIComponent(studentProfile.nickname || '同学')}`, []).then((items) => {
      setPacks((items || []).map(normalizePack).filter((pack) => pack.status === 'published'))
    })
  }, [isLoggedIn, studentProfile.nickname])

  useEffect(() => {
    if (!isLoggedIn) return
    apiGet(`/uploaded-questions?user=${encodeURIComponent(studentProfile.nickname || '同学')}`, []).then((items) => {
      if (items?.length) setUploadedQuestions(items.map(normalizeQuestion))
    })
  }, [isLoggedIn, studentProfile.nickname, setUploadedQuestions])

  const filteredPacks = useMemo(() => {
    return packs.filter((pack) => {
      if (!pack.owned && Number(pack.pointCost || 0) > 0) return false
      if (subject !== 'all' && pack.subjectValue !== subject && pack.subject !== subjectNameByValue[subject]) return false
      if (roundType !== 'all' && pack.roundType !== roundType) return false
      if (search.trim() && !`${pack.name}${pack.subjectLabel}${pack.grade}${pack.structure || ''}`.includes(search.trim())) return false
      return true
    })
  }, [packs, subject, roundType, search])

  const ownedPlatformPackCount = packs.filter(pack => pack.owned || Number(pack.pointCost || 0) <= 0).length

  const activeWrongQuestions = wrongQuestions.filter(question => !question.mastered)

  const filteredUploadedQuestions = useMemo(() => {
    return uploadedQuestions.filter((question) => {
      const questionSubject = subjectValueByName[question.subject] || question.subject || 'math'
      if (subject !== 'all' && questionSubject !== subject) return false
      if (search.trim() && !`${question.content}${question.knowledgePoint || ''}${question.answer || ''}`.includes(search.trim())) return false
      return true
    })
  }, [uploadedQuestions, subject, search])

  const wrongKnowledgeGroups = useMemo(() => {
    const groups = new Map()
    activeWrongQuestions.forEach(question => {
      const key = question.knowledgePoint || '未归类知识点'
      const items = groups.get(key) || []
      items.push(question)
      groups.set(key, items)
    })
    return Array.from(groups.entries()).map(([name, questions]) => ({ name, questions }))
  }, [activeWrongQuestions])

  const startPack = async (pack) => {
    setMessage('')
    if (!pack.owned && Number(pack.pointCost || 0) > 0) {
      setMessage(`${pack.name} 需要 ${pack.pointCost} 积分购买后才能练习。`)
      return
    }
    setLoadingPackId(pack.id)
    const questions = await apiGet(`/questions?packId=${encodeURIComponent(pack.id)}`, () => pack.questions || [])
    const normalizedQuestions = (questions || []).map(normalizeQuestion)
    setLoadingPackId(null)

    if (normalizedQuestions.length === 0) {
      setMessage(`${pack.name} 暂无可练习题目，等后台补题后再开放。`)
      return
    }

    onStartPractice({
      ...pack,
      subject: pack.subjectValue,
      questions: normalizedQuestions,
    })
  }

  const openPackPreview = async (pack) => {
    setMessage('')
    setDetailPack(pack)
    setDetailQuestions([])
    setLoadingDetailPackId(pack.id)
    const questions = await apiGet(`/questions?packId=${encodeURIComponent(pack.id)}`, () => pack.questions || [])
    setDetailQuestions((questions || []).map(normalizeQuestion))
    setLoadingDetailPackId(null)
  }

  const openPackPdf = async (pack) => {
    setMessage('')
    if (!pack.owned && Number(pack.pointCost || 0) > 0) {
      setMessage(`${pack.name} 需要先购买后才能导出PDF打印版。`)
      return
    }
    const user = encodeURIComponent(studentProfile.nickname || '同学')
    const packId = encodeURIComponent(pack.id)
    try {
      await openAuthorizedResource(`/question-packs/${packId}/export?user=${user}`)
    } catch {
      setMessage('导出失败，请确认已登录并拥有该题包。')
    }
  }

  const detailKnowledgePoints = useMemo(() => {
    if (!detailPack) return []
    return Array.from(new Set([
      detailPack.unitName,
      ...(String(detailPack.coverage || '').split('、')),
      ...detailQuestions.map(question => question.knowledgePoint),
    ].filter(Boolean))).slice(0, 10)
  }, [detailPack, detailQuestions])

  const detailTypeCounts = useMemo(() => {
    return detailQuestions.reduce((result, question) => {
      const type = question.type || '未分类'
      result[type] = (result[type] || 0) + 1
      return result
    }, {})
  }, [detailQuestions])

  const startQuestionList = (questions, name, source) => {
    const normalizedQuestions = questions.map(normalizeQuestion).filter(question => question.content)
    if (normalizedQuestions.length === 0) {
      setMessage('当前没有可练习题目。')
      return
    }
    onStartPractice({
      id: `${source}-${Date.now()}`,
      name,
      subject: normalizedQuestions[0]?.subject || 'math',
      roundType: source,
      estimatedTime: Math.max(5, normalizedQuestions.length * 3),
      questions: normalizedQuestions,
    })
  }

  const startUploadedPack = (questions, name) => {
    const pack = createUploadPracticePack(questions, name)
    incrementUploadedPracticeCount(questions.map(question => question.id))
    setSelectedUploadIds([])
    startQuestionList(pack.questions, pack.name, 'uploaded')
  }

  const startWrongPack = (questions, name) => {
    const pack = createWrongPracticePack(questions, name)
    incrementManyPracticeCount(questions.map(question => question.id))
    startQuestionList(pack.questions, pack.name, 'wrong')
  }

  const exportWrongQuestions = async (questions, title) => {
    const ids = questions.map(question => question.id).filter(Boolean)
    if (ids.length === 0) {
      setMessage('当前没有可导出的错题。')
      return
    }
    const params = new URLSearchParams({
      ids: ids.join(','),
      title,
    })
    try {
      await openAuthorizedResource(`/wrong-questions/export.pdf?${params.toString()}`)
    } catch {
      setMessage('错题导出失败，请确认已登录后重试。')
    }
  }

  const selectedUploadedQuestions = uploadedQuestions.filter(question => selectedUploadIds.includes(question.id))

  const toggleUploadSelection = (questionId) => {
    setSelectedUploadIds(current => current.includes(questionId)
      ? current.filter(id => id !== questionId)
      : [...current, questionId]
    )
  }

  const renderLibraryTabs = () => (
    <section className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {[
        { id: 'platform', label: '我的题库', count: ownedPlatformPackCount, icon: Library },
        { id: 'uploads', label: '拍题本', count: uploadedQuestions.length, icon: Camera },
        { id: 'wrong', label: '错题回收', count: activeWrongQuestions.length, icon: CheckCircle2 },
      ].map(item => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            onClick={() => {
              setLibraryMode(item.id)
              setSelectedUploadIds([])
              setSubject('all')
              setSearch('')
            }}
            className={`surface-line min-h-[72px] rounded-card p-3 text-left ${
              libraryMode === item.id ? 'border-primary-600 bg-primary-50 text-primary-900' : 'bg-white text-neutral-700'
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <Icon size={18} />
              <span className="text-title-3">{item.count}</span>
            </div>
            <div className="text-caption-1 font-semibold">{item.label}</div>
          </button>
        )
      })}
    </section>
  )

  const renderUploadedLibrary = () => (
    <section className="student-card-grid">
      {selectedUploadIds.length > 0 && (
        <div className="rounded-card bg-neutral-900 p-3 text-white">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-title-3">已选择 {selectedUploadIds.length} 题</span>
            <button onClick={() => setSelectedUploadIds([])} className="text-caption-1 text-white/70">清空</button>
          </div>
          <Button fullWidth onClick={() => startUploadedPack(selectedUploadedQuestions, `拍题自选小卷 ${selectedUploadedQuestions.length}题`)}>
            生成拍题小卷
          </Button>
        </div>
      )}

      {uploadPracticePacks.length > 0 && (
        <div className="surface-line rounded-card bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">最近拍题小卷</h2>
            <span className="text-caption-1 text-neutral-400">{uploadPracticePacks.length} 套</span>
          </div>
          <div className="grid gap-2">
            {uploadPracticePacks.slice(0, 3).map(pack => (
              <button key={pack.id} onClick={() => startQuestionList(pack.questions, pack.name, 'uploaded')} className="flex min-h-[48px] items-center justify-between rounded-card bg-neutral-50 px-3 text-left">
                <span className="text-subhead text-neutral-900">{pack.name}</span>
                <span className="text-caption-1 text-neutral-500">{pack.questions.length}题</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {filteredUploadedQuestions.map((question, index) => {
        const selected = selectedUploadIds.includes(question.id)
        return (
          <motion.div key={question.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
            <Card animate={false} className={`bg-white ${selected ? 'border-primary-600 bg-primary-50' : ''}`}>
              <div className="mb-4 flex items-start gap-3">
                <button
                  onClick={() => toggleUploadSelection(question.id)}
                  className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                    selected ? 'border-primary-600 bg-primary-600 text-white' : 'border-neutral-200 bg-white text-neutral-400'
                  }`}
                >
                  {selected ? <CheckCircle2 size={17} /> : <Camera size={16} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="badge badge-primary">{subjectNameByValue[subjectValueByName[question.subject] || question.subject] || question.subject || '数学'}</span>
                    <span className={question.correctionStatus === 'wrong' ? 'badge badge-error' : question.correctionStatus === 'correct' ? 'badge badge-success' : 'badge badge-warning'}>
                      {question.correctionStatus === 'wrong' ? '待订正' : question.correctionStatus === 'correct' ? '已批改' : '待作答'}
                    </span>
                    {question.knowledgePoint && <span className="badge badge-warning">{question.knowledgePoint}</span>}
                  </div>
                  <h3 className="line-clamp-2 text-title-3 text-neutral-900">{question.content}</h3>
                  <p className="mt-2 text-caption-1 text-neutral-500">答案 {question.answer || '待确认'} · 已练 {question.practiceCount || 0} 次</p>
                </div>
              </div>
              <Button fullWidth onClick={() => startUploadedPack([question], '拍题单题订正')}>
                练这道题
              </Button>
            </Card>
          </motion.div>
        )
      })}

      {filteredUploadedQuestions.length === 0 && (
        <div className="surface-line rounded-card bg-white p-8 text-center">
          <div className="mb-2 text-title-2 text-neutral-900">
            {uploadedQuestions.length > 0 ? '当前筛选下没有拍题' : '拍题本还没有题'}
          </div>
          <div className="text-subhead text-neutral-500">
            {uploadedQuestions.length > 0 ? '已清空筛选后可以看到全部拍题，或换个关键词再试。' : '手动输入并完成后，会沉淀到这里。'}
          </div>
        </div>
      )}
    </section>
  )

  const renderWrongLibrary = () => (
    <section className="student-card-grid">
      {customPracticePacks.length > 0 && (
        <div className="surface-line rounded-card bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">最近错题小卷</h2>
            <span className="text-caption-1 text-neutral-400">{customPracticePacks.length} 套</span>
          </div>
          <div className="grid gap-2">
            {customPracticePacks.slice(0, 3).map(pack => (
              <div key={pack.id} className="flex min-h-[48px] items-center justify-between gap-2 rounded-card bg-neutral-50 px-3">
                <button onClick={() => startQuestionList(pack.questions, pack.name, 'wrong')} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-subhead text-neutral-900">{pack.name}</span>
                  <span className="text-caption-1 text-neutral-500">{pack.questions.length}题</span>
                </button>
                <button
                  type="button"
                  title="导出错题小卷"
                  aria-label={`导出${pack.name}`}
                  onClick={() => exportWrongQuestions(pack.questions, pack.name)}
                  className="surface-line flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-neutral-700"
                >
                  <Download size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {wrongKnowledgeGroups.map(group => (
        <Card key={group.name} animate={false} className="bg-white">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-title-2 text-neutral-900">{group.name}</h3>
              <p className="mt-1 text-caption-1 text-neutral-500">{group.questions.length} 道待回收</p>
            </div>
            <button
              type="button"
              title="导出专项错题"
              aria-label={`导出${group.name}专项错题`}
              onClick={() => exportWrongQuestions(group.questions, `${group.name} 错题专项 ${group.questions.length}题`)}
              className="surface-line flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-neutral-700"
            >
              <Download size={16} />
            </button>
          </div>
          <Button fullWidth onClick={() => startWrongPack(group.questions, `${group.name} 错题专项`)}>
            生成专项小卷
          </Button>
        </Card>
      ))}

      {wrongKnowledgeGroups.length === 0 && (
        <div className="surface-line rounded-card bg-white p-8 text-center">
          <div className="mb-2 text-title-2 text-neutral-900">暂无待回收错题</div>
          <div className="text-subhead text-neutral-500">练习答错后会进入错题本，再从这里组卷。</div>
        </div>
      )}
    </section>
  )

  return (
    <div className="app-page">
      <main className="app-shell">
        <header className="mb-6">
          <div className="page-kicker mb-2">练习中心</div>
          <h1 className="mb-3 text-display text-neutral-900">从题库、拍题本和错题本组练习</h1>
          <p className="text-body text-neutral-500">平台题库按教材同步、专项训练、试卷三条线组织；拍题本和错题本负责个人练习沉淀。</p>
        </header>

        {!isLoggedIn && (
          <section className="mb-5 rounded-card bg-amber-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-title-3 text-amber-900">
              <CheckCircle2 size={18} />
              登录后同步题库、错题和积分
            </div>
            <p className="mb-4 text-subhead text-amber-800">
              平台题包需要绑定学生账号后展示，避免购买记录和练习进度只留在当前设备。
            </p>
            <Button onClick={onOpenQuestionStore}>去登录 / 查看题库商城</Button>
          </section>
        )}

        {renderLibraryTabs()}

        <section className="mb-5 rounded-card bg-neutral-900 p-5 text-white">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-caption-1 text-white/60">题库结构</div>
              <h2 className="mt-1 text-title-1">
                {libraryMode === 'platform' ? '主科题库按教材、专项和试卷训练' : libraryMode === 'uploads' ? '拍题本沉淀个人题目' : '错题回收生成专项小卷'}
              </h2>
            </div>
            <FileText size={27} className="text-primary-200" />
          </div>
          <div className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
            {[
              ['平台题包', packs.length],
              ['拍题本', uploadedQuestions.length],
              ['错题本', activeWrongQuestions.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-card bg-white/10 px-2 py-3">
                <div className="text-title-2">{value}</div>
                <div className="mt-1 text-caption-1 text-white/64">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-5 grid gap-3">
          <div className="surface-line flex items-center gap-3 rounded-card bg-white px-4 py-3">
            <Search size={18} className="text-neutral-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-subhead outline-none"
              placeholder={libraryMode === 'platform' ? '搜索题包、知识点或年级' : libraryMode === 'uploads' ? '搜索拍题内容或知识点' : '搜索错题知识点'}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {SUBJECT_OPTIONS.map((item) => (
              <button
                key={item.value}
                onClick={() => setSubject(subject === item.value ? 'all' : item.value)}
                className={`shrink-0 rounded-full px-4 py-2 text-caption-1 font-semibold ${
                  subject === item.value ? 'bg-primary-600 text-white' : 'surface-line bg-white text-neutral-600'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {libraryMode === 'platform' && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {roundTypes.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setRoundType(item.value)}
                  className={`min-h-[44px] rounded-card px-2 text-caption-1 font-semibold ${
                    roundType === item.value ? 'bg-neutral-900 text-white' : 'surface-line bg-white text-neutral-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </section>

        {message && (
          <div className="mb-4 rounded-card bg-amber-50 p-4 text-subhead text-amber-800">{message}</div>
        )}

        {libraryMode === 'uploads' && renderUploadedLibrary()}
        {libraryMode === 'wrong' && renderWrongLibrary()}

        {libraryMode === 'platform' && (
          <section className="student-card-grid">
            <button
              onClick={onOpenQuestionStore}
              className="surface-line flex min-h-[88px] items-center justify-between gap-4 rounded-card bg-white p-4 text-left lg:col-span-2"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                  <ShoppingBag size={21} />
                </div>
                <div className="min-w-0">
                  <h2 className="section-title">去题库商城买新题包</h2>
                  <p className="mt-1 text-caption-1 text-neutral-500">这里仅显示已解锁内容，商城里按教材同步、专项训练和试卷购买。</p>
                </div>
              </div>
              <ArrowRight size={20} className="shrink-0 text-neutral-400" />
            </button>

            {filteredPacks.map((pack, index) => (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card animate={false} className="bg-white">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="badge badge-primary">{pack.subjectLabel}</span>
                        <span className="badge badge-success">{pack.grade}</span>
                        <span className="badge badge-success">{Number(pack.pointCost || 0) > 0 ? '已购买' : '免费'}</span>
                      </div>
                      <h3 className="text-title-2 text-neutral-900">{pack.name}</h3>
                      <p className="mt-2 text-caption-1 text-neutral-500">{pack.structure || pack.description || '按题包顺序完成一轮训练。'}</p>
                      {pack.recommendation?.reasons?.length > 0 && (
                        <div className="mt-3 rounded-card bg-primary-50 p-3">
                          <div className="mb-2 flex items-center gap-2 text-caption-1 font-semibold text-primary-800">
                            <Sparkles size={14} />
                            <span>{recommendationBadge(pack.recommendation.level)}</span>
                          </div>
                          <div className="grid gap-1 text-caption-1 text-primary-900">
                            {pack.recommendation.reasons.map((reason) => (
                              <div key={reason}>· {reason}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      title="导出PDF打印版"
                      aria-label={`导出${pack.name}PDF打印版`}
                      onClick={() => openPackPdf(pack)}
                      className="surface-line flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-neutral-700 shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                    >
                      <Download size={18} />
                    </button>
                  </div>

                  <div className="mb-4 grid grid-cols-1 gap-2 text-caption-1 text-neutral-500 sm:grid-cols-3">
                    <div className="surface-line rounded-card p-2">
                      <div className="flex items-center gap-1"><Filter size={14} />题量</div>
                      <div className="mt-1 text-title-3 text-neutral-900">{pack.questionCount || pack.questions?.length || 0}题</div>
                    </div>
                    <div className="surface-line rounded-card p-2">
                      <div className="flex items-center gap-1"><Clock3 size={14} />用时</div>
                      <div className="mt-1 text-title-3 text-neutral-900">{formatTime(pack.estimatedTime || 15)}</div>
                    </div>
                    <div className="surface-line rounded-card p-2">
                      <div className="flex items-center gap-1"><Sparkles size={14} />形式</div>
                      <div className="mt-1 text-title-3 text-neutral-900">{roundTypes.find(item => item.value === pack.roundType)?.label || '训练'}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.25fr]">
                    <Button variant="secondary" fullWidth loading={loadingDetailPackId === pack.id} onClick={() => openPackPreview(pack)}>
                      题目预览
                    </Button>
                    <Button fullWidth loading={loadingPackId === pack.id} onClick={() => startPack(pack)}>
                      开始练习
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}

            {filteredPacks.length === 0 && (
              <div className="surface-line rounded-card bg-white p-8 text-center">
                <div className="mb-2 text-title-2 text-neutral-900">当前没有可练题包</div>
                <div className="mb-4 text-subhead text-neutral-500">去题库商城用积分解锁后，会回到这里。</div>
                <Button onClick={onOpenQuestionStore}>去题库商城</Button>
              </div>
            )}
          </section>
        )}
      </main>

      <Modal
        isOpen={Boolean(detailPack)}
        onClose={() => {
          setDetailPack(null)
          setDetailQuestions([])
        }}
        title={detailPack?.name}
      >
        {detailPack && (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-primary">{detailPack.subjectLabel}</span>
              <span className="badge badge-success">{detailPack.grade}</span>
              <span className="badge badge-success">{Number(detailPack.pointCost || 0) > 0 ? '已购买' : '免费'}</span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                ['题量', `${detailPack.questionCount || detailQuestions.length}题`],
                ['用时', formatTime(detailPack.estimatedTime || 15)],
                ['形式', roundTypes.find(item => item.value === detailPack.roundType)?.label || '训练'],
              ].map(([label, value]) => (
                <div key={label} className="surface-line rounded-card bg-neutral-50 p-3">
                  <div className="text-caption-1 text-neutral-500">{label}</div>
                  <div className="mt-1 text-title-3 text-neutral-900">{value}</div>
                </div>
              ))}
            </div>

            <div className="surface-line rounded-card bg-white p-3">
              <div className="mb-2 text-caption-1 font-semibold text-neutral-500">训练结构</div>
              <div className="text-subhead text-neutral-800">{detailPack.structure || detailPack.description || '按题包顺序完成一轮训练。'}</div>
            </div>

            {detailPack.recommendation?.reasons?.length > 0 && (
              <div className="rounded-card bg-primary-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-caption-1 font-semibold text-primary-800">
                  <Sparkles size={14} />
                  <span>推荐理由 · {recommendationBadge(detailPack.recommendation.level)}</span>
                </div>
                <div className="grid gap-1 text-subhead text-primary-900">
                  {detailPack.recommendation.reasons.map((reason) => (
                    <div key={reason}>· {reason}</div>
                  ))}
                </div>
              </div>
            )}

            {detailKnowledgePoints.length > 0 && (
              <div>
                <div className="mb-2 text-caption-1 font-semibold text-neutral-500">知识点覆盖</div>
                <div className="flex flex-wrap gap-2">
                  {detailKnowledgePoints.map((point) => (
                    <span key={point} className="rounded-full bg-primary-50 px-3 py-1 text-caption-1 font-semibold text-primary-700">
                      {point}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 text-caption-1 font-semibold text-neutral-500">题型分布</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {Object.entries(detailTypeCounts).map(([type, count]) => (
                  <div key={type} className="surface-line rounded-card bg-white p-3">
                    <div className="text-caption-1 text-neutral-500">{type}</div>
                    <div className="mt-1 text-title-3 text-neutral-900">{count}</div>
                  </div>
                ))}
                {loadingDetailPackId === detailPack.id && (
                  <div className="col-span-3 surface-line rounded-card bg-white p-3 text-center text-subhead text-neutral-500">加载题目中...</div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-caption-1 font-semibold text-neutral-500">题目预览</div>
                <div className="text-caption-1 text-neutral-400">{detailQuestions.length} 题</div>
              </div>
              <div className="grid max-h-[320px] gap-2 overflow-auto pr-1">
                {detailQuestions.map((question, index) => (
                  <div key={question.id} className="surface-line rounded-card bg-white p-3">
                    <div className="mb-1 text-caption-1 font-semibold text-neutral-500">第 {index + 1} 题 · {question.type}</div>
                    <div className="text-subhead text-neutral-900">{question.content}</div>
                    <div className="mt-2 text-caption-1 text-neutral-500">知识点：{question.knowledgePoint || '-'}</div>
                  </div>
                ))}
                {!loadingDetailPackId && detailQuestions.length === 0 && (
                  <div className="surface-line rounded-card bg-white p-4 text-center text-subhead text-neutral-500">
                    暂无可预览题目，等后台补题后再开放。
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.2fr]">
              <Button variant="secondary" fullWidth onClick={() => setDetailPack(null)}>
                关闭
              </Button>
              <Button fullWidth className="flex items-center justify-center gap-2" onClick={() => openPackPdf(detailPack)}>
                <Download size={16} />
                导出PDF打印版
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default PracticeCenterPage
