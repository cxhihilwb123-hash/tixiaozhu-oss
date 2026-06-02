import React, { useEffect, useMemo, useState } from 'react'
import { BookOpen, ChevronRight, Coins, Crown, Download, HelpCircle, Settings, Star, Target, TrendingUp, UserRound, WalletCards } from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'
import Modal from '../components/Modal'
import { useFavoriteQuestionStore, useUserStore } from '../stores'
import { GRADE_OPTIONS, SUBJECT_OPTIONS } from '../utils/constants'
import { apiGet, apiPost } from '../utils/api'

const ProfilePage = ({ onOpenMembership }) => {
  const {
    authToken,
    isLoggedIn,
    login,
    logout,
    studentProfile,
    membership,
    pointsAccount,
    stats,
    setGrade,
    setSubjectPreferences,
    setPointsAccount,
  } = useUserStore()
  const { favoriteQuestions, setFavoriteQuestions } = useFavoriteQuestionStore()
  const [showGradeModal, setShowGradeModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ phone: '', password: '', nickname: '' })
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [showFavoritesModal, setShowFavoritesModal] = useState(false)
  const [showRecordsModal, setShowRecordsModal] = useState(false)
  const [selectedGrade, setSelectedGrade] = useState(null)
  const [paymentVisible, setPaymentVisible] = useState(false)
  const [learningRecords, setLearningRecords] = useState([])
  const [wrongQuestions, setWrongQuestions] = useState([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [reportMessage, setReportMessage] = useState('')
  const [exportingPeriod, setExportingPeriod] = useState(null)

  const currentUser = studentProfile.nickname || '同学'
  const preferredSubject = SUBJECT_OPTIONS.find(subject => subject.value === studentProfile.subjectPreferences?.[0])?.label
    || studentProfile.subjectPreferences?.[0]
    || '数学'

  const openAuthModal = (mode) => {
    setAuthMode(mode)
    setAuthMessage('')
    setAuthForm((current) => ({
      ...current,
      nickname: current.nickname || studentProfile.nickname || '',
    }))
    setShowAuthModal(true)
  }

  const submitAuth = async () => {
    setAuthMessage('')
    setAuthSubmitting(true)
    const payload = authMode === 'register'
      ? {
          phone: authForm.phone,
          password: authForm.password,
          nickname: authForm.nickname || studentProfile.nickname || '同学',
          grade: studentProfile.gradeName || studentProfile.grade || '未设置',
          subject: preferredSubject,
        }
      : {
          phone: authForm.phone,
          password: authForm.password,
        }
    const result = await apiPost(authMode === 'register' ? '/auth/register' : '/auth/login', payload, null)
    setAuthSubmitting(false)

    if (!result?.token || !result?.user) {
      setAuthMessage(authMode === 'register' ? '注册失败，请检查手机号和密码。' : '登录失败，请检查账号或密码。')
      return
    }

    login(result)
    setShowAuthModal(false)
    setAuthForm({ phone: '', password: '', nickname: '' })
  }

  useEffect(() => {
    apiGet('/payment/config', { visible: false }).then((config) => {
      setPaymentVisible(Boolean(config?.visible || config?.pointsVisible))
    })
  }, [])

  useEffect(() => {
    if (!isLoggedIn) return
    apiGet(`/points/account?user=${encodeURIComponent(currentUser)}`, null).then((account) => {
      if (account) setPointsAccount(account)
    })
  }, [currentUser, isLoggedIn, setPointsAccount])

  const loadFavorites = () => {
    setFavoritesLoading(true)
    apiGet(`/favorite-questions?user=${encodeURIComponent(currentUser)}`, []).then((questions) => {
      setFavoriteQuestions(questions || [])
    }).finally(() => setFavoritesLoading(false))
  }

  const loadLearningRecords = () => {
    setRecordsLoading(true)
    Promise.all([
      apiGet(`/learning-records?user=${encodeURIComponent(currentUser)}`, []),
      apiGet('/wrong-questions', []),
    ]).then(([records, wrongItems]) => {
      setLearningRecords(records || [])
      setWrongQuestions((wrongItems || []).filter(item => !item.user || item.user === currentUser))
    }).finally(() => setRecordsLoading(false))
  }

  const openFavorites = () => {
    setShowFavoritesModal(true)
    loadFavorites()
  }

  const openRecords = () => {
    setShowRecordsModal(true)
    loadLearningRecords()
  }

  const exportLearningReport = async (period) => {
    setReportMessage('')
    setExportingPeriod(period)
    const report = await apiGet(`/learning-report?user=${encodeURIComponent(currentUser)}&period=${period}`, null)
    setExportingPeriod(null)
    if (!report?.content) {
      setReportMessage('报告暂时生成失败，请稍后重试。')
      return
    }

    const blob = new Blob([report.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `题小助-${currentUser}-${report.periodLabel || '学习报告'}-${report.range?.to || ''}.txt`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    setReportMessage(`${report.periodLabel || '学习报告'}已生成，可转发给家长查看。`)
  }

  const statsItems = [
    { label: '本周完成', value: stats.weeklyCompleted, icon: Target, color: 'bg-primary-50 text-primary-800' },
    { label: '正确率', value: `${stats.accuracyRate || 0}%`, icon: TrendingUp, color: 'bg-green-50 text-green-700' },
    { label: '累计完成', value: stats.totalCompleted, icon: BookOpen, color: 'bg-amber-50 text-amber-700' },
  ]

  const menuItems = [
    { title: '收藏题目', icon: Star, color: 'text-amber-600', onClick: openFavorites },
    { title: '学习记录', icon: BookOpen, color: 'text-primary-700', onClick: openRecords },
    { title: '设置', icon: Settings, color: 'text-neutral-600', onClick: () => setShowSettingsModal(true) },
    { title: '帮助反馈', icon: HelpCircle, color: 'text-neutral-600' },
  ]

  const formatDateTime = (value) => {
    if (!value) return ''
    if (typeof value === 'number') return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    return String(value)
  }

  const parentReport = useMemo(() => {
    const parseRecordTime = (value) => {
      if (!value) return null
      if (typeof value === 'number') return new Date(value)
      const normalized = String(value).replace(' ', 'T')
      const date = new Date(normalized)
      return Number.isNaN(date.getTime()) ? null : date
    }

    const now = Date.now()
    const inDays = (record, days) => {
      const date = parseRecordTime(record.completedAt)
      if (!date) return true
      return now - date.getTime() <= days * 24 * 60 * 60 * 1000
    }
    const summarize = (records) => {
      const total = records.reduce((sum, record) => sum + Number(record.total || 0), 0)
      const correct = records.reduce((sum, record) => sum + Number(record.correct || 0), 0)
      return {
        rounds: records.length,
        total,
        correct,
        accuracy: total ? Math.round((correct / total) * 100) : 0,
      }
    }

    const week = summarize(learningRecords.filter(record => inDays(record, 7)))
    const month = summarize(learningRecords.filter(record => inDays(record, 30)))
    const activeWrong = wrongQuestions.filter(item => item.status !== 'mastered' && !item.mastered)
    const masteredWrong = wrongQuestions.filter(item => item.status === 'mastered' || item.mastered)
    const wrongTotal = activeWrong.length + masteredWrong.length
    const recoveryRate = wrongTotal ? Math.round((masteredWrong.length / wrongTotal) * 100) : 0
    const weakPointCounts = new Map()
    learningRecords.forEach(record => {
      ;(record.weakKnowledgePoints || []).forEach(point => weakPointCounts.set(point, (weakPointCounts.get(point) || 0) + 1))
    })
    activeWrong.forEach(question => {
      if (question.knowledgePoint) weakPointCounts.set(question.knowledgePoint, (weakPointCounts.get(question.knowledgePoint) || 0) + 1)
    })
    const weakPoints = Array.from(weakPointCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
      .slice(0, 4)
    const subjectMap = new Map()
    learningRecords.forEach(record => {
      const subject = record.subject || '学科'
      const current = subjectMap.get(subject) || { subject, total: 0, correct: 0, rounds: 0 }
      current.total += Number(record.total || 0)
      current.correct += Number(record.correct || 0)
      current.rounds += 1
      subjectMap.set(subject, current)
    })
    const subjectSummary = Array.from(subjectMap.values()).map(item => ({
      ...item,
      accuracy: item.total ? Math.round((item.correct / item.total) * 100) : 0,
    }))
    const recentTrend = learningRecords
      .slice()
      .reverse()
      .slice(-6)
      .map((record) => {
        const total = Number(record.total || 0)
        const correct = Number(record.correct || 0)
        return {
          id: record.id,
          label: String(record.completedAt || '').slice(5, 10) || '练习',
          pack: record.pack || record.packName || '练习',
          accuracy: total ? Math.round((correct / total) * 100) : Number(record.score || 0),
        }
      })
    const nextAction = activeWrong.length > 0
      ? `先回收 ${activeWrong.slice(0, 3).map(item => item.knowledgePoint).filter(Boolean).join('、') || '错题本'}，再做同类题包。`
      : week.rounds === 0
        ? '本周还没有完成题包，建议先做一组年级推荐题包作为摸底。'
        : week.accuracy >= 85
          ? '本周掌握较稳，可以进入下一组教材同步或试卷检测。'
          : '本周正确率还需要巩固，建议优先做薄弱知识点专项。'

    return { week, month, activeWrong, masteredWrong, recoveryRate, weakPoints, subjectSummary, recentTrend, nextAction }
  }, [learningRecords, wrongQuestions])

  return (
    <div className="app-page">
      <main className="app-shell">
        <header className="mb-6">
          <div className="page-kicker mb-2">我的</div>
          <h1 className="text-display text-neutral-900">学习档案</h1>
        </header>

        <Card staticCard className="mb-4 bg-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-800">
              {studentProfile.avatar ? (
                <img src={studentProfile.avatar} alt="avatar" className="h-full w-full rounded-full object-cover" />
              ) : (
                <UserRound size={31} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-title-1 text-neutral-900">{studentProfile.nickname || '同学'}</h2>
              <p className="mt-1 text-caption-1 text-neutral-500">{studentProfile.gradeName || '未设置年级'}</p>
            </div>
            <button onClick={() => setShowGradeModal(true)} className="text-caption-1 font-semibold text-primary-700">
              编辑
            </button>
          </div>
        </Card>

        <Card staticCard className="mb-4 bg-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-caption-1 font-semibold text-neutral-500">账号状态</div>
              <h3 className="mt-1 text-title-2 text-neutral-900">
                {isLoggedIn ? '已登录正式账号' : '未登录正式账号'}
              </h3>
              <p className="mt-1 text-caption-1 text-neutral-500">
                {isLoggedIn
                  ? `学习记录已绑定到 ${studentProfile.nickname || '当前学生'}`
                  : '登录后练习、错题、购买和积分会绑定真实账号。'}
              </p>
            </div>
            {isLoggedIn ? (
              <button onClick={logout} className="shrink-0 text-caption-1 font-semibold text-red-600">
                退出
              </button>
            ) : (
              <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                <button onClick={() => openAuthModal('login')} className="rounded-full bg-neutral-900 px-4 py-2 text-caption-1 font-semibold text-white">
                  登录
                </button>
                <button onClick={() => openAuthModal('register')} className="rounded-full bg-primary-50 px-4 py-2 text-caption-1 font-semibold text-primary-800">
                  注册
                </button>
              </div>
            )}
          </div>
          {authToken && (
            <div className="mt-3 rounded-card bg-green-50 px-3 py-2 text-caption-1 font-semibold text-green-700">
              会话已加密保存，打开应用会自动校验。
            </div>
          )}
        </Card>

        {(paymentVisible || membership.isMember) && (
          <Card onClick={onOpenMembership} animate={false} className="mb-4 bg-neutral-900 text-white">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                  <Crown size={22} className="text-amber-200" />
                </div>
                <div>
                  <h3 className="text-title-2">{membership.isMember ? '会员已开通' : '题小助会员'}</h3>
                  <p className="mt-1 text-caption-1 text-white/64">
                    {membership.isMember ? `有效期至 ${membership.expireDate || '永久'}` : '无限拍题、讲解和学习报告'}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-white/50" />
            </div>
          </Card>
        )}

        {paymentVisible && (
          <Card onClick={onOpenMembership} animate={false} className="mb-4 bg-white">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                  <Coins size={22} />
                </div>
                <div>
                  <h3 className="text-title-2 text-neutral-900">积分余额 {pointsAccount.balance || 0}</h3>
                  <p className="mt-1 text-caption-1 text-neutral-500">
                    积分只用于解锁题包，拍题、提示、批改和学习报告不扣积分
                  </p>
                </div>
              </div>
              <WalletCards size={19} className="text-neutral-400" />
            </div>
          </Card>
        )}

        <section className="mb-4">
          <h2 className="section-title mb-3">学习统计</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {statsItems.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="surface-line rounded-card bg-white p-3">
                  <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-full ${item.color}`}>
                    <Icon size={18} />
                  </div>
                  <div className="text-title-2 text-neutral-900">{item.value}</div>
                  <div className="mt-1 text-caption-1 text-neutral-500">{item.label}</div>
                </div>
              )
            })}
          </div>
        </section>

        <section>
          <h2 className="section-title mb-3">账户与记录</h2>
          <div className="surface-line overflow-hidden rounded-card bg-white">
            {menuItems.map((item, index) => {
              const Icon = item.icon
              return (
                <button
                  key={item.title}
                  onClick={item.onClick}
                  className={`flex min-h-[58px] w-full items-center gap-3 px-4 text-left ${
                    index > 0 ? 'border-t border-neutral-100' : ''
                  }`}
                >
                  <Icon size={20} className={item.color} />
                  <span className="flex-1 text-body text-neutral-900">{item.title}</span>
                  <ChevronRight size={18} className="text-neutral-400" />
                </button>
              )
            })}
          </div>
        </section>
      </main>

      <Modal isOpen={showGradeModal} onClose={() => setShowGradeModal(false)} title="修改年级">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {GRADE_OPTIONS.map((grade) => {
            const active = selectedGrade?.value === grade.value || (!selectedGrade && studentProfile.grade === grade.value)
            return (
              <button
                key={grade.value}
                onClick={() => setSelectedGrade(grade)}
                className={`surface-line min-h-[58px] rounded-card text-title-3 ${
                  active ? 'border-primary-600 bg-primary-50 text-primary-900' : 'bg-white text-neutral-700'
                }`}
              >
                {grade.shortLabel}
              </button>
            )
          })}
        </div>
        <div className="mt-5">
          <Button
            fullWidth
            onClick={() => {
              if (selectedGrade) setGrade(selectedGrade.value, selectedGrade.label)
              setShowGradeModal(false)
            }}
          >
            保存
          </Button>
        </div>
      </Modal>

      <Modal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} title={authMode === 'register' ? '注册学生账号' : '登录学生账号'}>
        <div className="grid gap-4">
          <div className="rounded-card bg-primary-50 p-3 text-caption-1 font-semibold text-primary-900">
            {authMode === 'register'
              ? '建议使用家长或学生手机号作为账号，后续可接入短信验证码或微信登录。'
              : '登录后会把本机学习档案同步到正式账号。'}
          </div>

          {authMode === 'register' && (
            <label className="block">
              <span className="mb-2 block text-caption-1 text-neutral-500">学生昵称</span>
              <input
                className="input-field w-full"
                value={authForm.nickname}
                onChange={(event) => setAuthForm((current) => ({ ...current, nickname: event.target.value }))}
                placeholder="例如：小宇"
                maxLength={12}
              />
            </label>
          )}

          <label className="block">
            <span className="mb-2 block text-caption-1 text-neutral-500">手机号 / 登录账号</span>
            <input
              className="input-field w-full"
              value={authForm.phone}
              onChange={(event) => setAuthForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="请输入手机号"
              inputMode="tel"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-caption-1 text-neutral-500">密码</span>
            <input
              className="input-field w-full"
              type="password"
              value={authForm.password}
              onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="至少 8 位"
            />
          </label>

          {authMessage && (
            <div className="rounded-card bg-red-50 p-3 text-caption-1 font-semibold text-red-700">
              {authMessage}
            </div>
          )}

          <Button fullWidth loading={authSubmitting} onClick={submitAuth}>
            {authMode === 'register' ? '创建账号并登录' : '登录'}
          </Button>

          <button
            onClick={() => {
              setAuthMode(authMode === 'register' ? 'login' : 'register')
              setAuthMessage('')
            }}
            className="text-caption-1 font-semibold text-primary-700"
          >
            {authMode === 'register' ? '已有账号，去登录' : '还没有账号，立即注册'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="设置">
        <div>
          <h3 className="mb-3 text-title-3 text-neutral-900">学科偏好</h3>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_OPTIONS.map((subject) => {
              const selected = studentProfile.subjectPreferences?.includes(subject.value)
              return (
                <button
                  key={subject.value}
                  onClick={() => {
                    const current = studentProfile.subjectPreferences || []
                    setSubjectPreferences(selected ? current.filter(s => s !== subject.value) : [...current, subject.value])
                  }}
                  className={`rounded-full px-4 py-2 text-caption-1 ${
                    selected ? 'bg-primary-600 text-white' : 'surface-line bg-white text-neutral-600'
                  }`}
                >
                  {subject.label}
                </button>
              )
            })}
          </div>
          <div className="mt-6 border-t border-neutral-100 pt-4">
            <Button variant="ghost" fullWidth>清除学习数据</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showFavoritesModal} onClose={() => setShowFavoritesModal(false)} title="收藏题目">
        <div className="grid gap-3">
          {favoritesLoading && (
            <div className="rounded-card bg-neutral-50 p-5 text-center text-subhead text-neutral-500">正在同步收藏题...</div>
          )}

          {!favoritesLoading && favoriteQuestions.length === 0 && (
            <div className="surface-line rounded-card bg-white p-8 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                <Star size={22} />
              </div>
              <div className="text-title-3 text-neutral-900">还没有收藏题目</div>
              <p className="mt-2 text-subhead text-neutral-500">练习时点题目右上角星标，重点题会沉淀在这里。</p>
            </div>
          )}

          {!favoritesLoading && favoriteQuestions.map((question) => (
            <article key={question.id || question.questionId} className="surface-line rounded-card bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="badge badge-warning">{question.subject || '学科'}</span>
                {question.knowledgePoint && <span className="badge badge-primary">{question.knowledgePoint}</span>}
                {question.packName && <span className="badge badge-success">{question.packName}</span>}
              </div>
              <div className="text-body text-neutral-900">{question.content}</div>
              <div className="mt-3 rounded-card bg-neutral-50 p-3 text-caption-1 text-neutral-600">
                <div>答案：{question.answer || question.correctAnswer || '暂无'}</div>
                {question.explanation && <div className="mt-1">讲解：{question.explanation}</div>}
              </div>
              <div className="mt-3 text-caption-1 text-neutral-400">{formatDateTime(question.createdAt)}</div>
            </article>
          ))}
        </div>
      </Modal>

      <Modal isOpen={showRecordsModal} onClose={() => setShowRecordsModal(false)} title="学习记录">
        <div className="grid gap-3">
          {recordsLoading && (
            <div className="rounded-card bg-neutral-50 p-5 text-center text-subhead text-neutral-500">正在整理学习记录...</div>
          )}

          {!recordsLoading && (
            <section className="surface-line rounded-card bg-white p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-caption-1 font-semibold text-neutral-500">家长报告汇总</div>
                  <h3 className="mt-1 text-title-2 text-neutral-900">近阶段学习状态</h3>
                </div>
                <span className={`badge ${parentReport.week.accuracy >= 80 ? 'badge-success' : parentReport.week.rounds > 0 ? 'badge-warning' : 'badge-primary'}`}>
                  {parentReport.week.rounds > 0 ? `${parentReport.week.accuracy}%` : '待开始'}
                </span>
              </div>

              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button variant="secondary" loading={exportingPeriod === 'week'} onClick={() => exportLearningReport('week')}>
                  <span className="inline-flex items-center justify-center gap-2">
                    <Download size={16} />
                    导出周报
                  </span>
                </Button>
                <Button variant="secondary" loading={exportingPeriod === 'month'} onClick={() => exportLearningReport('month')}>
                  <span className="inline-flex items-center justify-center gap-2">
                    <Download size={16} />
                    导出月报
                  </span>
                </Button>
              </div>

              {reportMessage && (
                <div className="mb-3 rounded-card bg-green-50 p-3 text-caption-1 font-semibold text-green-700">
                  {reportMessage}
                </div>
              )}

              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['近7天', `${parentReport.week.rounds}轮`],
                  ['近30天', `${parentReport.month.total}题`],
                  ['待回收', `${parentReport.activeWrong.length}题`],
                  ['回收率', `${parentReport.recoveryRate}%`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-card bg-neutral-50 p-2 text-center">
                    <div className="text-title-3 text-neutral-900">{value}</div>
                    <div className="mt-1 text-caption-1 text-neutral-500">{label}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-card bg-primary-50 p-3 text-subhead text-primary-900">
                {parentReport.nextAction}
              </div>

              {parentReport.recentTrend.length > 0 && (
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-caption-1 font-semibold text-neutral-500">正确率趋势</div>
                    <div className="text-caption-1 text-neutral-400">最近 {parentReport.recentTrend.length} 轮</div>
                  </div>
                  <div className="grid gap-2">
                    {parentReport.recentTrend.map((item) => (
                      <div key={item.id} className="grid grid-cols-[44px_1fr_42px] items-center gap-2 sm:grid-cols-[48px_1fr_42px]">
                        <div className="text-caption-1 text-neutral-500">{item.label}</div>
                        <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className={`h-full rounded-full ${item.accuracy >= 80 ? 'bg-green-500' : item.accuracy >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.max(6, Math.min(100, item.accuracy))}%` }}
                          />
                        </div>
                        <div className="text-right text-caption-1 font-semibold text-neutral-700">{item.accuracy}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {parentReport.weakPoints.length > 0 && (
                <div className="mt-3">
                  <div className="mb-2 text-caption-1 font-semibold text-neutral-500">重点关注</div>
                  <div className="flex flex-wrap gap-2">
                    {parentReport.weakPoints.map((point) => (
                      <span key={point.name} className="rounded-full bg-red-50 px-3 py-1 text-caption-1 font-semibold text-red-700">
                        {point.name} · {point.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {parentReport.subjectSummary.length > 0 && (
                <div className="mt-3">
                  <div className="mb-2 text-caption-1 font-semibold text-neutral-500">学科表现</div>
                  <div className="grid gap-2">
                    {parentReport.subjectSummary.map((subject) => (
                      <div key={subject.subject} className="flex items-center justify-between rounded-card bg-neutral-50 px-3 py-2">
                        <span className="text-subhead text-neutral-900">{subject.subject}</span>
                        <span className="text-caption-1 font-semibold text-neutral-600">{subject.rounds}轮 · {subject.accuracy}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {!recordsLoading && learningRecords.length === 0 && (
            <div className="surface-line rounded-card bg-white p-8 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-50 text-primary-800">
                <BookOpen size={22} />
              </div>
              <div className="text-title-3 text-neutral-900">还没有学习记录</div>
              <p className="mt-2 text-subhead text-neutral-500">完成一组题包后，会自动生成家长可看的练习报告。</p>
            </div>
          )}

          {!recordsLoading && learningRecords.map((record) => (
            <article key={record.id} className="surface-line rounded-card bg-white p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="line-clamp-1 text-title-3 text-neutral-900">{record.pack || record.packName || '自主练习'}</div>
                  <div className="mt-1 text-caption-1 text-neutral-500">{formatDateTime(record.completedAt)}</div>
                </div>
                <span className={`badge ${Number(record.score || 0) >= 75 ? 'badge-success' : 'badge-error'}`}>
                  {record.rating || '已完成'}
                </span>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['得分', record.score ?? record.accuracy ?? 0],
                  ['总题', record.total || 0],
                  ['正确', record.correct || 0],
                  ['错题', record.wrong ?? Math.max(0, Number(record.total || 0) - Number(record.correct || 0))],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-card bg-neutral-50 p-2 text-center">
                    <div className="text-title-3 text-neutral-900">{value}</div>
                    <div className="mt-1 text-caption-1 text-neutral-500">{label}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-card bg-amber-50 p-3 text-subhead text-amber-900">
                {record.parentSummary || '本轮练习已完成，建议继续保持学习节奏。'}
              </div>

              {record.nextAction && (
                <div className="mt-2 text-caption-1 font-semibold text-primary-700">{record.nextAction}</div>
              )}

              {record.weakKnowledgePoints?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {record.weakKnowledgePoints.map((point) => (
                    <span key={point} className="rounded-full bg-red-50 px-3 py-1 text-caption-1 font-semibold text-red-700">{point}</span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </Modal>
    </div>
  )
}

export default ProfilePage
