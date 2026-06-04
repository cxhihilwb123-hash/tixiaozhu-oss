import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, BookOpen, CheckCircle2, Clock3, Download, FileText, Filter, Search, ShieldCheck, ShoppingBag, Sparkles, Target } from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'
import Modal from '../components/Modal'
import { apiGet, apiPost, openAuthorizedResource } from '../utils/api'
import { GRADE_OPTIONS, SUBJECT_OPTIONS, formatTime } from '../utils/constants'
import { useUserStore } from '../stores'

const roundTypes = [
  { value: 'all', label: '全部' },
  { value: 'textbook', label: '教材同步' },
  { value: 'special', label: '专项训练' },
  { value: 'paper', label: '试卷' },
]

const semesterOptions = ['上册', '下册']

const storeScopes = [
  { value: 'recommend', label: '我的年级推荐' },
  { value: 'owned', label: '已入库' },
  { value: 'free', label: '免费可练' },
  { value: 'paid', label: '积分解锁' },
  { value: 'all', label: '全部' },
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

const packKnowledgeHint = (pack) => (
  pack.coverage ||
  pack.unitName ||
  pack.structure ||
  (pack.series === 'textbook' ? '教材同步知识点' : '主科训练知识点')
)

const packFitHint = (pack) => {
  if (pack.recommendation?.reasons?.length > 0) return pack.recommendation.reasons[0]
  if (pack.series === 'textbook') return '适合同步巩固课堂单元'
  if (pack.series === 'special') return '适合集中处理薄弱能力'
  if (pack.series === 'paper') return '适合阶段检测和考前复盘'
  return '适合按今天练习目标补题'
}

const normalizePack = (pack) => ({
  ...pack,
  subjectValue: subjectValueByName[pack.subject] || pack.subject || 'math',
  subjectLabel: subjectNameByValue[pack.subject] || pack.subject || '数学',
  series: pack.series || (pack.roundType === 'daily' ? 'textbook' : pack.roundType) || 'textbook',
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

const QuestionStorePage = ({ onBack, onRequireLogin, onStartPractice }) => {
  const {
    studentProfile,
    pointsAccount,
    contentPurchases,
    setPointsAccount,
    setContentPurchases,
    addContentPurchase,
    applyPointTransaction,
    isLoggedIn,
  } = useUserStore()
  const [packs, setPacks] = useState([])
  const [subject, setSubject] = useState('all')
  const [grade, setGrade] = useState('all')
  const [scope, setScope] = useState('recommend')
  const [roundType, setRoundType] = useState('all')
  const [semester, setSemester] = useState('all')
  const [unitName, setUnitName] = useState('all')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [loadingPackId, setLoadingPackId] = useState(null)
  const [buyingPackId, setBuyingPackId] = useState(null)
  const [detailPack, setDetailPack] = useState(null)
  const [detailQuestions, setDetailQuestions] = useState([])
  const [loadingDetailPackId, setLoadingDetailPackId] = useState(null)

  useEffect(() => {
    if (!isLoggedIn) {
      setPacks([])
      setContentPurchases([])
      return
    }
    const user = encodeURIComponent(studentProfile.nickname || '同学')
    apiGet(`/question-packs?user=${user}`, []).then((items) => {
      setPacks((items || []).map(normalizePack).filter((pack) => pack.status === 'published'))
    })
    apiGet(`/content-purchases?user=${user}`, []).then(setContentPurchases)
    apiGet(`/points/account?user=${user}`, null).then((account) => {
      if (account) setPointsAccount(account)
    })
  }, [isLoggedIn, studentProfile.nickname, setContentPurchases, setPointsAccount])

  const ownedPackIds = useMemo(() => new Set(contentPurchases.map(item => item.packId)), [contentPurchases])

  const enrichedPacks = useMemo(() => packs.map(pack => ({
    ...pack,
    owned: pack.owned || ownedPackIds.has(pack.id) || Number(pack.pointCost || 0) <= 0,
  })), [packs, ownedPackIds])

  const studentGradeName = studentProfile.gradeName || GRADE_OPTIONS.find(item => item.value === studentProfile.grade)?.label || ''
  const recommendationGradeName = grade !== 'all' ? grade : studentGradeName

  const gradeOptions = useMemo(() => {
    const grades = Array.from(new Set(enrichedPacks.map(pack => pack.grade).filter(Boolean)))
    return grades.sort((a, b) => String(a).localeCompare(String(b), 'zh-Hans-CN', { numeric: true }))
  }, [enrichedPacks])

  const unitOptions = useMemo(() => {
    if (roundType !== 'textbook') return []
    const units = enrichedPacks
      .filter((pack) => {
        if (pack.series !== 'textbook') return false
        if (grade !== 'all' && pack.grade !== grade) return false
        if (subject !== 'all' && pack.subjectValue !== subject && pack.subject !== subjectNameByValue[subject]) return false
        if (semester !== 'all' && pack.semester !== semester) return false
        return Boolean(pack.unitName)
      })
      .map(pack => pack.unitName)
    return Array.from(new Set(units))
  }, [enrichedPacks, grade, roundType, semester, subject])

  useEffect(() => {
    setSemester('all')
    setUnitName('all')
  }, [roundType, grade, subject])

  useEffect(() => {
    setUnitName('all')
  }, [semester])

  const baseFilteredPacks = useMemo(() => {
    return enrichedPacks.filter((pack) => {
      if (subject !== 'all' && pack.subjectValue !== subject && pack.subject !== subjectNameByValue[subject]) return false
      if (grade !== 'all' && pack.grade !== grade) return false
      if (roundType !== 'all' && pack.series !== roundType && pack.roundType !== roundType) return false
      if (roundType === 'textbook' && semester !== 'all' && pack.semester !== semester) return false
      if (roundType === 'textbook' && unitName !== 'all' && pack.unitName !== unitName) return false
      if (search.trim() && !`${pack.name}${pack.subjectLabel}${pack.grade}${pack.structure || ''}${pack.description || ''}`.includes(search.trim())) return false
      return true
    })
  }, [enrichedPacks, grade, subject, roundType, semester, unitName, search])

  const recommendedPacks = useMemo(() => {
    if (!recommendationGradeName) return []
    return baseFilteredPacks.filter(pack => pack.grade === recommendationGradeName)
  }, [baseFilteredPacks, recommendationGradeName])

  const filteredPacks = useMemo(() => {
    if (scope === 'recommend') return recommendationGradeName ? recommendedPacks : baseFilteredPacks
    if (scope === 'owned') return baseFilteredPacks.filter(pack => pack.owned)
    if (scope === 'free') return baseFilteredPacks.filter(pack => Number(pack.pointCost || 0) <= 0)
    if (scope === 'paid') return baseFilteredPacks.filter(pack => Number(pack.pointCost || 0) > 0 && !pack.owned)
    return baseFilteredPacks
  }, [baseFilteredPacks, recommendedPacks, recommendationGradeName, scope])

  const packSections = useMemo(() => {
    const build = (key, title, description, items) => ({
      key,
      title,
      description,
      items,
    })

    if (scope !== 'all') {
      const title = storeScopes.find(item => item.value === scope)?.label || '题包'
      const description = scope === 'recommend'
        ? (recommendationGradeName ? `优先展示适合 ${recommendationGradeName} 的主科题包。` : '设置年级后会自动推荐对应题包。')
        : scope === 'owned'
          ? '这些题包已经在你的题库里，可以直接开始练习。'
          : scope === 'free'
            ? '免费题包可以直接练，适合作为同步练习入口。'
            : '积分题包购买后会永久进入“我的题库”。'
      return [build(scope, title, description, filteredPacks)]
    }

    const usedIds = new Set()
    const take = (items) => items.filter((pack) => {
      if (usedIds.has(pack.id)) return false
      usedIds.add(pack.id)
      return true
    })

    const sections = []
    if (recommendationGradeName) sections.push(build('recommend', `${recommendationGradeName}推荐`, '按当前年级优先排教材同步、专项训练和试卷。', take(recommendedPacks)))
    sections.push(build('owned', '已入库', '已经解锁的题包可以直接练习。', take(baseFilteredPacks.filter(pack => pack.owned))))
    sections.push(build('free', '免费可练', '免费同步题包适合先试练。', take(baseFilteredPacks.filter(pack => Number(pack.pointCost || 0) <= 0))))
    sections.push(build('paid', '积分解锁', '专项训练和试卷购买后进入我的题库。', take(baseFilteredPacks.filter(pack => Number(pack.pointCost || 0) > 0 && !pack.owned))))
    return sections.filter(section => section.items.length > 0)
  }, [baseFilteredPacks, filteredPacks, recommendedPacks, recommendationGradeName, scope])

  const ownedCount = enrichedPacks.filter(pack => pack.owned).length
  const paidCount = enrichedPacks.filter(pack => Number(pack.pointCost || 0) > 0).length
  const recommendCount = recommendationGradeName ? enrichedPacks.filter(pack => pack.grade === recommendationGradeName).length : 0
  const seriesCounts = useMemo(() => roundTypes.slice(1).map(item => ({
    ...item,
    count: enrichedPacks.filter(pack => pack.series === item.value || pack.roundType === item.value).length,
  })), [enrichedPacks])

  const startPack = async (pack) => {
    setMessage('')
    if (!pack.owned && Number(pack.pointCost || 0) > 0) {
      setMessage(`${pack.name} 需要先用 ${pack.pointCost} 积分解锁。`)
      return
    }

    setLoadingPackId(pack.id)
    const questions = await apiGet(`/questions?packId=${encodeURIComponent(pack.id)}`, () => pack.questions || [])
    setLoadingPackId(null)

    const normalizedQuestions = (questions || []).map(normalizeQuestion)
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

  const buyPack = async (pack) => {
    setMessage('')
    setBuyingPackId(pack.id)
    const result = await apiPost('/content-purchases/buy', {
      user: studentProfile.nickname || '同学',
      packId: pack.id,
    }, null)
    setBuyingPackId(null)

    if (!result) {
      setMessage(`积分不足，${pack.name} 需要 ${pack.pointCost} 积分。可以先到“我的”页面购买积分包。`)
      return
    }

    if (result.account) setPointsAccount(result.account)
    if (result.transaction) applyPointTransaction(result.transaction)
    if (result.purchase) addContentPurchase(result.purchase)

    setPacks(current => current.map(item => (
      item.id === pack.id ? normalizePack({ ...item, owned: true }) : item
    )))
    setDetailPack(current => current?.id === pack.id ? normalizePack({ ...current, owned: true }) : current)
    setMessage(result.alreadyOwned ? `${pack.name} 已经在你的题库里。` : `已用 ${pack.pointCost} 积分购买 ${pack.name}，现在可以开始练习。`)
  }

  const openPackDetail = async (pack) => {
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

  if (!isLoggedIn) {
    return (
      <div className="app-page pb-8">
        <main className="app-shell">
          <header className="mb-5">
            <button onClick={onBack} className="mb-4 flex items-center gap-2 text-subhead font-semibold text-neutral-600">
              <ArrowLeft size={18} />
              返回练习中心
            </button>
            <div className="page-kicker mb-2">题库商城</div>
            <h1 className="mb-3 text-display text-neutral-900">登录后查看你的题包和积分</h1>
            <p className="text-body text-neutral-500">题包、积分和打印权限会绑定到学生账号，避免换设备后学习记录丢失。</p>
          </header>

          <section className="mb-5 rounded-card bg-neutral-900 p-5 text-white">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <ShieldCheck size={24} className="text-primary-100" />
            </div>
            <h2 className="text-title-1">先完成登录，再解锁题库</h2>
            <p className="mt-2 text-subhead text-white/68">
              登录后可查看 252 个主科题包，免费题包直接练，积分题包购买后永久进入“我的题库”。
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {[
                ['内容', '教材同步 / 专项 / 试卷'],
                ['账号', '题包与积分绑定'],
                ['打印', '已入库题包可导出 PDF'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-card bg-white/10 p-3">
                  <div className="text-caption-1 text-white/52">{label}</div>
                  <div className="mt-1 text-title-3 text-white">{value}</div>
                </div>
              ))}
            </div>
          </section>

          <Button fullWidth onClick={onRequireLogin}>
            去登录 / 注册
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="app-page pb-8">
      <main className="app-shell">
        <header className="mb-5">
          <button onClick={onBack} className="mb-4 flex items-center gap-2 text-subhead font-semibold text-neutral-600">
            <ArrowLeft size={18} />
            返回练习中心
          </button>
          <div className="page-kicker mb-2">题库商城</div>
          <h1 className="mb-3 text-display text-neutral-900">按教材、专项和试卷解锁题包</h1>
          <p className="text-body text-neutral-500">只保留小学考试主科：语文、数学、英语。购买后题包会进入“我的题库”。</p>
        </header>

        <section className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            [recommendationGradeName ? `${recommendationGradeName}推荐` : '年级推荐', recommendCount],
            ['已入库', ownedCount],
            ['积分余额', pointsAccount.balance || 0],
          ].map(([label, value]) => (
            <div key={label} className="surface-line rounded-card bg-white p-3 text-center">
              <div className="text-title-2 text-neutral-900">
                {label === '积分余额' ? `${value} 积分` : `${value} 个题包`}
              </div>
              <div className="mt-1 text-caption-1 text-neutral-500">{label}</div>
            </div>
          ))}
        </section>

        <section className="mb-5 grid gap-3">
          <div className="rounded-card bg-primary-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-title-3 text-primary-900">
              <ShieldCheck size={18} />
              家长为什么放心买
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                ['体系完整', '按教材同步、专项训练、试卷三条线组织。'],
                ['结果明确', '每包标注知识点、用时、训练结构和适合场景。'],
                ['可打印复习', '已入库题包可导出 PDF，方便线下订正。'],
                ['积分透明', '只为解锁题包扣积分，练习和批改不扣。'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-card bg-white/72 p-3">
                  <div className="mb-1 flex items-center gap-1 text-caption-1 font-semibold text-primary-800">
                    <CheckCircle2 size={14} />
                    {title}
                  </div>
                  <div className="text-caption-1 text-neutral-600">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-line rounded-card bg-white p-3">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-title-3 text-neutral-900">题包分组</div>
                <div className="mt-1 text-caption-1 text-neutral-500">
                  {recommendationGradeName ? `已按 ${recommendationGradeName} 优先推荐，可切换看已购、免费或积分题包。` : '选择年级后会自动生成你的年级推荐。'}
                </div>
              </div>
              <div className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-caption-1 font-semibold text-amber-700">
                {paidCount} 个积分题包
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {storeScopes.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setScope(item.value)}
                  className={`shrink-0 rounded-full px-4 py-2 text-caption-1 font-semibold ${
                    scope === item.value ? 'bg-neutral-900 text-white' : 'bg-neutral-50 text-neutral-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="surface-line flex items-center gap-3 rounded-card bg-white px-4 py-3">
            <Search size={18} className="text-neutral-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-subhead outline-none"
              placeholder="搜索题包、知识点或年级"
            />
          </div>

          <div>
            <div className="mb-2 text-caption-1 font-semibold text-neutral-500">先选年级</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setGrade('all')}
                className={`shrink-0 rounded-full px-4 py-2 text-caption-1 font-semibold ${
                  grade === 'all' ? 'bg-primary-600 text-white' : 'surface-line bg-white text-neutral-600'
                }`}
              >
                全部年级
              </button>
              {gradeOptions.map((item) => (
                <button
                  key={item}
                  onClick={() => setGrade(item)}
                  className={`shrink-0 rounded-full px-4 py-2 text-caption-1 font-semibold ${
                    grade === item ? 'bg-primary-600 text-white' : 'surface-line bg-white text-neutral-600'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-caption-1 font-semibold text-neutral-500">再选主科</div>
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
          </div>

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

          {roundType !== 'all' && (
            <div className="surface-line rounded-card bg-white p-3">
              <div className="mb-2 text-caption-1 font-semibold text-neutral-500">
                {roundType === 'textbook' ? '教材层级' : '当前体系'}
              </div>
              {roundType === 'textbook' ? (
                <div className="grid gap-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      onClick={() => setSemester('all')}
                      className={`min-h-[38px] rounded-card px-2 text-caption-1 font-semibold ${
                        semester === 'all' ? 'bg-neutral-900 text-white' : 'bg-neutral-50 text-neutral-600'
                      }`}
                    >
                      全部册次
                    </button>
                    {semesterOptions.map((item) => (
                      <button
                        key={item}
                        onClick={() => setSemester(item)}
                        className={`min-h-[38px] rounded-card px-2 text-caption-1 font-semibold ${
                          semester === item ? 'bg-neutral-900 text-white' : 'bg-neutral-50 text-neutral-600'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    <button
                      onClick={() => setUnitName('all')}
                      className={`shrink-0 rounded-full px-3 py-2 text-caption-1 font-semibold ${
                        unitName === 'all' ? 'bg-primary-600 text-white' : 'bg-neutral-50 text-neutral-600'
                      }`}
                    >
                      全部单元
                    </button>
                    {unitOptions.map((item) => (
                      <button
                        key={item}
                        onClick={() => setUnitName(item)}
                        className={`shrink-0 rounded-full px-3 py-2 text-caption-1 font-semibold ${
                          unitName === item ? 'bg-primary-600 text-white' : 'bg-neutral-50 text-neutral-600'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {seriesCounts.map((item) => (
                    <div key={item.value} className="rounded-card bg-neutral-50 p-3">
                      <div className="text-title-3 text-neutral-900">{item.count}</div>
                      <div className="mt-1 text-caption-1 text-neutral-500">{item.label}题包</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {message && (
          <div className="mb-4 rounded-card bg-amber-50 p-4 text-subhead text-amber-800">{message}</div>
        )}

        <section className="grid gap-5">
          {packSections.map((section) => (
            <div key={section.key} className="grid gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="section-title">{section.title}</h2>
                  <p className="mt-1 text-caption-1 text-neutral-500">{section.description}</p>
                </div>
                <div className="shrink-0 text-caption-1 font-semibold text-neutral-400">{section.items.length} 个题包</div>
              </div>
              <div className="student-card-grid">
              {section.items.map((pack, index) => {
                const paidPack = Number(pack.pointCost || 0) > 0
                return (
                  <motion.div
                    key={`${section.key}-${pack.id}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <Card animate={false} className="bg-white">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            {recommendationGradeName && pack.grade === recommendationGradeName && (
                              <span className="badge badge-warning">年级推荐</span>
                            )}
                            <span className="badge badge-primary">{roundTypes.find(item => item.value === pack.series)?.label || '训练'}</span>
                            <span className="badge badge-primary">{pack.subjectLabel}</span>
                            <span className="badge badge-success">{pack.grade}</span>
                            {paidPack ? (
                              <span className={pack.owned ? 'badge badge-success' : 'badge badge-warning'}>
                                {pack.owned ? '已入库' : `${pack.pointCost}积分`}
                              </span>
                            ) : (
                              <span className="badge badge-success">免费</span>
                            )}
                          </div>
                          <h3 className="text-title-2 text-neutral-900">{pack.name}</h3>
                          <p className="mt-2 text-caption-1 text-neutral-500">
                            {pack.series === 'textbook' ? `${pack.semester || ''}${pack.unitName ? ` · ${pack.unitName}` : ''}` : pack.coverage || pack.unitName || '按训练目标组织'}
                          </p>
                          <p className="mt-1 text-caption-1 text-neutral-500">{pack.structure || pack.description || '按题包顺序完成一轮训练。'}</p>
                          <div className="mt-3 grid gap-2 text-caption-1 text-neutral-600">
                            <div className="rounded-card bg-primary-50 p-2">
                              <span className="font-semibold text-primary-800">覆盖知识点：</span>
                              {packKnowledgeHint(pack)}
                            </div>
                            <div className="rounded-card bg-neutral-50 p-2">
                              <span className="font-semibold text-neutral-700">适合情况：</span>
                              {packFitHint(pack)}
                            </div>
                          </div>
                          {pack.recommendation?.reasons?.length > 0 && (
                            <div className="mt-3 rounded-card bg-amber-50 p-3">
                              <div className="mb-2 flex items-center gap-2 text-caption-1 font-semibold text-amber-800">
                                <Sparkles size={14} />
                                <span>{recommendationBadge(pack.recommendation.level)}</span>
                              </div>
                              <div className="grid gap-1 text-caption-1 text-amber-800">
                                {pack.recommendation.reasons.map((reason) => (
                                  <div key={reason}>· {reason}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {pack.owned && (
                          <button
                            type="button"
                            title="导出PDF打印版"
                            aria-label={`导出${pack.name}PDF打印版`}
                            onClick={() => openPackPdf(pack)}
                            className="surface-line flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-neutral-700 shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                          >
                            <Download size={18} />
                          </button>
                        )}
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
                          <div className="mt-1 text-title-3 text-neutral-900">{roundTypes.find(item => item.value === pack.series)?.label || '训练'}</div>
                        </div>
                      </div>

                      {pack.owned ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.25fr]">
                          <Button variant="secondary" fullWidth loading={loadingDetailPackId === pack.id} onClick={() => openPackDetail(pack)}>
                            题目预览
                          </Button>
                          <Button fullWidth loading={loadingPackId === pack.id} onClick={() => startPack(pack)}>
                            开始练习
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.25fr]">
                          <Button variant="secondary" fullWidth loading={loadingDetailPackId === pack.id} onClick={() => openPackDetail(pack)}>
                            题目预览
                          </Button>
                          <Button fullWidth loading={buyingPackId === pack.id} onClick={() => buyPack(pack)}>
                            购买题包
                          </Button>
                        </div>
                      )}
                    </Card>
                  </motion.div>
                )
              })}
              </div>
            </div>
          ))}

          {filteredPacks.length === 0 && (
            <div className="surface-line rounded-card bg-white p-8 text-center">
              <div className="mb-2 text-title-2 text-neutral-900">没有匹配的题包</div>
              <div className="text-subhead text-neutral-500">换个学科或训练类型看看。</div>
            </div>
          )}
        </section>
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
              <span className="badge badge-primary">{roundTypes.find(item => item.value === detailPack.series)?.label || '训练'}</span>
              <span className="badge badge-primary">{detailPack.subjectLabel}</span>
              <span className="badge badge-success">{detailPack.grade}</span>
              {Number(detailPack.pointCost || 0) > 0 ? (
                <span className={detailPack.owned ? 'badge badge-success' : 'badge badge-warning'}>
                  {detailPack.owned ? '已入库' : `${detailPack.pointCost}积分`}
                </span>
              ) : (
                <span className="badge badge-success">免费</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                ['题量', `${detailPack.questionCount || detailQuestions.length}题`],
                ['用时', formatTime(detailPack.estimatedTime || 15)],
                ['价格', Number(detailPack.pointCost || 0) > 0 ? `${detailPack.pointCost}积分` : '免费'],
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
              <div className="rounded-card bg-amber-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-caption-1 font-semibold text-amber-800">
                  <Sparkles size={14} />
                  <span>推荐理由 · {recommendationBadge(detailPack.recommendation.level)}</span>
                </div>
                <div className="grid gap-1 text-subhead text-amber-900">
                  {detailPack.recommendation.reasons.map((reason) => (
                    <div key={reason}>· {reason}</div>
                  ))}
                </div>
              </div>
            )}

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
                    <div className="mt-1 text-caption-1 text-neutral-500">能力：{question.ability || '-'} · 易错：{question.commonMistake || '-'}</div>
                  </div>
                ))}
                {!loadingDetailPackId && detailQuestions.length === 0 && (
                  <div className="surface-line rounded-card bg-white p-4 text-center text-subhead text-neutral-500">
                    暂无可预览题目，等后台补题后再开放。
                  </div>
                )}
              </div>
            </div>

            {detailPack.owned ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.2fr]">
                <Button variant="secondary" fullWidth onClick={() => setDetailPack(null)}>
                  关闭
                </Button>
                <Button fullWidth className="flex items-center justify-center gap-2" onClick={() => openPackPdf(detailPack)}>
                  <Download size={16} />
                  导出PDF打印版
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="rounded-card bg-amber-50 p-3 text-subhead text-amber-800">
                  购买后可导出PDF打印版，免费题包和已入库题包无需额外付费。
                </div>
                <Button variant="secondary" fullWidth onClick={() => setDetailPack(null)}>
                  关闭
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default QuestionStorePage
