import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  Layers,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  Target,
  Trash2,
  X,
} from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'
import Modal from '../components/Modal'
import { useWrongQuestionStore } from '../stores'
import { SUBJECT_OPTIONS } from '../utils/constants'
import { apiGet, apiPatch, openAuthorizedResource } from '../utils/api'

const subjectValueByName = SUBJECT_OPTIONS.reduce((map, subject) => {
  map[subject.label] = subject.value
  return map
}, {})
const subjectNameByValue = SUBJECT_OPTIONS.reduce((map, subject) => {
  map[subject.value] = subject.label
  return map
}, {})
const subjectValue = (subject) => subjectValueByName[subject] || subject || 'math'
const subjectName = (subject) => subjectNameByValue[subject] || subject || '题目'
const wrongStatusMeta = {
  new: { label: '新错题', className: 'badge-error' },
  corrected: { label: '已订正', className: 'badge-warning' },
  reviewing: { label: '复练中', className: 'badge-primary' },
  mastered: { label: '已掌握', className: 'badge-success' },
}
const wrongStatus = (question) => question.status || (question.mastered ? 'mastered' : Number(question.practiceCount || 0) > 0 ? 'reviewing' : 'new')
const isActiveWrong = (question) => wrongStatus(question) !== 'mastered'

const sortQuestions = (items, sortMode) => {
  const sorted = [...items]
  if (sortMode === 'oldest') return sorted.sort((a, b) => Number(a.addedAt || 0) - Number(b.addedAt || 0))
  if (sortMode === 'practice') return sorted.sort((a, b) => Number(b.practiceCount || 0) - Number(a.practiceCount || 0))
  return sorted.sort((a, b) => Number(b.addedAt || 0) - Number(a.addedAt || 0))
}

const WrongQuestionPage = ({ onPracticeWrong }) => {
  const {
    wrongQuestions,
    customPracticePacks,
    setWrongQuestions,
    markAsMastered,
    markManyAsMastered,
    markAsCorrected,
    markManyAsCorrected,
    removeFromWrongSet,
    removeManyFromWrongSet,
    getTotalWrongCount,
    incrementPracticeCount,
    incrementManyPracticeCount,
    createWrongPracticePack,
  } = useWrongQuestionStore()

  const [selectedSubject, setSelectedSubject] = useState('all')
  const [selectedKnowledge, setSelectedKnowledge] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [sortMode, setSortMode] = useState('recent')
  const [searchTerm, setSearchTerm] = useState('')
  const [message, setMessage] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [selectedQuestion, setSelectedQuestion] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    if (wrongQuestions.length > 0) return
    apiGet('/wrong-questions', []).then((items) => {
      if (items?.length) setWrongQuestions(items)
    })
  }, [wrongQuestions.length, setWrongQuestions])

  const activeQuestions = wrongQuestions.filter(isActiveWrong)
  const newQuestions = wrongQuestions.filter(item => wrongStatus(item) === 'new')
  const correctedQuestions = wrongQuestions.filter(item => wrongStatus(item) === 'corrected')
  const reviewingQuestions = wrongQuestions.filter(item => wrongStatus(item) === 'reviewing')
  const masteredQuestions = wrongQuestions.filter(item => wrongStatus(item) === 'mastered')
  const totalWrong = getTotalWrongCount()

  const subjectGroups = useMemo(() => {
    return SUBJECT_OPTIONS
      .map(subject => ({
        ...subject,
        count: activeQuestions.filter(item => subjectValue(item.subject) === subject.value).length,
      }))
      .filter(item => item.count > 0)
  }, [activeQuestions])

  const knowledgeGroups = useMemo(() => {
    const map = new Map()
    activeQuestions.forEach(question => {
      const key = question.knowledgePoint || '未归类知识点'
      map.set(key, (map.get(key) || 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [activeQuestions])

  const filteredQuestions = useMemo(() => {
    const pool = statusFilter === 'all'
      ? wrongQuestions
      : statusFilter === 'active'
        ? activeQuestions
        : wrongQuestions.filter(question => wrongStatus(question) === statusFilter)

    const filtered = pool.filter(question => {
      if (selectedSubject !== 'all' && subjectValue(question.subject) !== selectedSubject) return false
      if (selectedKnowledge !== 'all' && (question.knowledgePoint || '未归类知识点') !== selectedKnowledge) return false
      if (searchTerm.trim()) {
        const keyword = searchTerm.trim()
        return [question.content, question.knowledgePoint, question.answer, question.userAnswer]
          .some(value => String(value || '').includes(keyword))
      }
      return true
    })

    return sortQuestions(filtered, sortMode)
  }, [activeQuestions, wrongQuestions, selectedSubject, selectedKnowledge, statusFilter, searchTerm, sortMode])

  const selectedQuestions = useMemo(
    () => wrongQuestions.filter(question => selectedIds.includes(question.id)),
    [wrongQuestions, selectedIds]
  )

  const focusKnowledge = knowledgeGroups[0]
  const repeatCount = activeQuestions.filter(item => Number(item.practiceCount || 0) >= 2).length

  const toggleSelected = (questionId) => {
    setSelectedIds(current => current.includes(questionId)
      ? current.filter(id => id !== questionId)
      : [...current, questionId]
    )
  }

  const clearSelection = () => setSelectedIds([])

  const handleViewDetail = (question) => {
    setSelectedQuestion(question)
    setShowDetailModal(true)
  }

  const handlePracticeAgain = (question) => {
    incrementPracticeCount(question.id)
    apiPatch(`/wrong-questions/${encodeURIComponent(question.id)}`, { status: 'reviewing' }, null)
    setShowDetailModal(false)
    onPracticeWrong(question)
  }

  const startPracticePack = (questions, name) => {
    if (!questions.length) return
    const pack = createWrongPracticePack(questions, name)
    incrementManyPracticeCount(questions.map(question => question.id))
    questions.forEach(question => {
      apiPatch(`/wrong-questions/${encodeURIComponent(question.id)}`, { status: 'reviewing' }, null)
    })
    clearSelection()
    onPracticeWrong(pack)
  }

  const handleMarkCorrected = (questionId) => {
    markAsCorrected(questionId)
    apiPatch(`/wrong-questions/${encodeURIComponent(questionId)}`, { status: 'corrected' }, null)
  }

  const handleMarkManyCorrected = (questionIds) => {
    markManyAsCorrected(questionIds)
    questionIds.forEach(questionId => {
      apiPatch(`/wrong-questions/${encodeURIComponent(questionId)}`, { status: 'corrected' }, null)
    })
  }

  const handleMarkMastered = (questionId) => {
    markAsMastered(questionId)
    apiPatch(`/wrong-questions/${encodeURIComponent(questionId)}`, { status: 'mastered' }, null)
  }

  const handleMarkManyMastered = (questionIds) => {
    markManyAsMastered(questionIds)
    questionIds.forEach(questionId => {
      apiPatch(`/wrong-questions/${encodeURIComponent(questionId)}`, { status: 'mastered' }, null)
    })
  }

  const handleStartSelectedPack = () => {
    startPracticePack(selectedQuestions, `自选错题小卷 ${selectedQuestions.length}题`)
  }

  const handleStartKnowledgePack = (knowledge) => {
    const questions = activeQuestions.filter(question => (question.knowledgePoint || '未归类知识点') === knowledge)
    startPracticePack(questions, `${knowledge} 专项错题`)
  }

  const exportWrongQuestions = async (questions, title) => {
    const ids = questions.map(question => question.id).filter(Boolean)
    if (ids.length === 0) return
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

  const exportCurrentQuestions = () => {
    const scopeName = statusFilter === 'active'
      ? '待处理错题'
      : statusFilter === 'all'
        ? '全部错题'
        : wrongStatusMeta[statusFilter]?.label || '错题'
    const subjectLabel = selectedSubject === 'all' ? '' : subjectName(selectedSubject)
    const knowledgeLabel = selectedKnowledge === 'all' ? '' : selectedKnowledge
    const title = [subjectLabel, knowledgeLabel, scopeName].filter(Boolean).join(' · ') || '错题打印练习'
    exportWrongQuestions(filteredQuestions, `${title} ${filteredQuestions.length}题`)
  }

  const exportKnowledgeQuestions = (knowledge) => {
    const questions = activeQuestions.filter(question => (question.knowledgePoint || '未归类知识点') === knowledge)
    exportWrongQuestions(questions, `${knowledge} 错题专项 ${questions.length}题`)
  }

  const renderSummary = () => (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { label: '新错题', value: newQuestions.length, icon: BookOpenCheck, tone: 'bg-red-50 text-red-600' },
        { label: '已订正', value: correctedQuestions.length, icon: CheckCircle2, tone: 'bg-amber-50 text-amber-700' },
        { label: '复练中', value: reviewingQuestions.length, icon: RefreshCw, tone: 'bg-primary-50 text-primary-800' },
        { label: '已掌握', value: masteredQuestions.length, icon: Layers, tone: 'bg-green-50 text-green-700' },
      ].map((item) => {
        const Icon = item.icon
        return (
          <div key={item.label} className="surface-line rounded-card bg-white p-3">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full ${item.tone}`}>
              <Icon size={18} />
            </div>
            <div className="text-title-2 text-neutral-900">{item.value}</div>
            <div className="mt-1 text-caption-1 text-neutral-500">{item.label}</div>
          </div>
        )
      })}
    </div>
  )

  const renderFilter = () => (
    <section className="mb-5">
      <div className="mb-3 flex items-center gap-2 rounded-card bg-white p-3 surface-line">
        <Search size={17} className="text-neutral-400" />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-subhead text-neutral-900 outline-none"
          placeholder="搜索题干、答案或知识点"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
            <X size={15} />
          </button>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'active', label: `待处理 ${totalWrong}` },
          { id: 'new', label: `新错题 ${newQuestions.length}` },
          { id: 'corrected', label: `已订正 ${correctedQuestions.length}` },
          { id: 'reviewing', label: `复练中 ${reviewingQuestions.length}` },
          { id: 'mastered', label: `已掌握 ${masteredQuestions.length}` },
          { id: 'all', label: `全部 ${wrongQuestions.length}` },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => {
              setStatusFilter(item.id)
              clearSelection()
            }}
            className={`h-10 shrink-0 rounded-full px-4 text-caption-1 transition-colors ${
              statusFilter === item.id ? 'bg-neutral-900 text-white' : 'surface-line bg-white text-neutral-600'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedSubject('all')}
          className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-caption-1 transition-colors ${
            selectedSubject === 'all' ? 'bg-primary-600 text-white' : 'surface-line bg-white text-neutral-600'
          }`}
        >
          <Filter size={14} />
          全部学科
        </button>
        {subjectGroups.map(subject => (
          <button
            key={subject.value}
            onClick={() => setSelectedSubject(subject.value)}
            className={`h-10 shrink-0 rounded-full px-4 text-caption-1 transition-colors ${
              selectedSubject === subject.value ? 'bg-primary-600 text-white' : 'surface-line bg-white text-neutral-600'
            }`}
          >
            {subject.label} {subject.count}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedKnowledge('all')}
          className={`h-10 shrink-0 rounded-full px-4 text-caption-1 transition-colors ${
            selectedKnowledge === 'all' ? 'bg-amber-600 text-white' : 'surface-line bg-white text-neutral-600'
          }`}
        >
          全部知识点
        </button>
        {knowledgeGroups.map(group => (
          <button
            key={group.name}
            onClick={() => setSelectedKnowledge(group.name)}
            className={`h-10 shrink-0 rounded-full px-4 text-caption-1 transition-colors ${
              selectedKnowledge === group.name ? 'bg-amber-600 text-white' : 'surface-line bg-white text-neutral-600'
            }`}
          >
            {group.name} {group.count}
          </button>
        ))}
      </div>
    </section>
  )

  const renderActions = () => (
    <section className="mb-5 grid gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={`surface-line min-h-[82px] rounded-card bg-white p-4 ${focusKnowledge ? '' : 'opacity-45'}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-title-3 text-neutral-900">
                <Target size={18} className="text-primary-700" />
                高频专项
              </div>
              <div className="line-clamp-1 text-caption-1 text-neutral-500">{focusKnowledge?.name || '暂无知识点'}</div>
            </div>
            {focusKnowledge && (
              <button
                type="button"
                title="导出专项错题"
                aria-label={`导出${focusKnowledge.name}专项错题`}
                onClick={() => exportKnowledgeQuestions(focusKnowledge.name)}
                className="surface-line flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-neutral-700"
              >
                <Download size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => focusKnowledge && handleStartKnowledgePack(focusKnowledge.name)}
            disabled={!focusKnowledge}
            className="text-caption-1 font-semibold text-primary-700 disabled:text-neutral-400"
          >
            生成专项练习
          </button>
        </div>
        <button
          onClick={() => startPracticePack(filteredQuestions.filter(isActiveWrong).slice(0, 10), '错题快练')}
          disabled={filteredQuestions.filter(isActiveWrong).length === 0}
          className="surface-line min-h-[82px] rounded-card bg-white p-4 text-left disabled:opacity-45"
        >
          <div className="mb-2 flex items-center gap-2 text-title-3 text-neutral-900">
            <ListChecks size={18} className="text-green-700" />
            错题快练
          </div>
          <div className="text-caption-1 text-neutral-500">最多10题</div>
        </button>
      </div>

      {customPracticePacks.length > 0 && (
        <div className="surface-line rounded-card bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">最近组卷</h2>
            <span className="text-caption-1 text-neutral-400">{customPracticePacks.length} 套</span>
          </div>
          <div className="grid gap-2">
            {customPracticePacks.slice(0, 3).map(pack => (
              <div key={pack.id} className="flex min-h-[48px] items-center justify-between gap-2 rounded-card bg-neutral-50 px-3">
                <button onClick={() => onPracticeWrong(pack)} className="min-w-0 flex-1 text-left">
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
    </section>
  )

  const renderSelectionBar = () => selectedIds.length > 0 && (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="fixed bottom-[92px] left-4 right-4 z-40 mx-auto max-w-[92vw] rounded-card bg-neutral-900 p-3 text-white shadow-xl sm:max-w-[720px] lg:max-w-[960px]"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-title-3">已选择 {selectedIds.length} 题</span>
        <button onClick={clearSelection} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <button onClick={() => exportWrongQuestions(selectedQuestions, `自选错题打印 ${selectedQuestions.length}题`)} className="rounded-card bg-white px-3 py-2 text-caption-1 font-semibold text-neutral-900">
          导出所选
        </button>
        <button onClick={handleStartSelectedPack} className="rounded-card bg-white px-3 py-2 text-caption-1 font-semibold text-neutral-900">
          生成小卷
        </button>
        <button onClick={() => {
          handleMarkManyCorrected(selectedIds)
          clearSelection()
        }} className="rounded-card bg-white/10 px-3 py-2 text-caption-1 font-semibold text-white">
          标记订正
        </button>
        <button onClick={() => {
          handleMarkManyMastered(selectedIds)
          clearSelection()
        }} className="rounded-card bg-white/10 px-3 py-2 text-caption-1 font-semibold text-white">
          标记掌握
        </button>
        <button onClick={() => {
          removeManyFromWrongSet(selectedIds)
          clearSelection()
        }} className="rounded-card bg-red-500 px-3 py-2 text-caption-1 font-semibold text-white">
          移除
        </button>
      </div>
    </motion.div>
  )

  const renderEmptyState = () => (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface-line flex min-h-[320px] flex-col items-center justify-center rounded-card bg-white px-8 text-center"
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-700">
        <BookOpenCheck size={31} />
      </div>
      <h2 className="mb-2 text-title-1 text-neutral-900">暂无待强化错题</h2>
      <p className="text-subhead text-neutral-500">完成练习后，答错的题会自动进入这里。</p>
    </motion.div>
  )

  const renderList = () => (
    <div className="student-card-grid">
      <div className="flex items-center justify-between">
        <span className="text-caption-1 text-neutral-500">当前 {filteredQuestions.length} 题</span>
        <select value={sortMode} onChange={(event) => setSortMode(event.target.value)} className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-caption-1 text-neutral-600">
          <option value="recent">最近加入</option>
          <option value="oldest">最早加入</option>
          <option value="practice">练习次数</option>
        </select>
      </div>

      {filteredQuestions.map((question, index) => {
        const selected = selectedIds.includes(question.id)
        return (
          <motion.div
            key={question.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <Card animate={false} onClick={() => handleViewDetail(question)} className={`bg-white ${selected ? 'border-primary-600 bg-primary-50' : ''}`}>
              <div className="flex items-start gap-3">
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleSelected(question.id)
                  }}
                  className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                    selected ? 'border-primary-600 bg-primary-600 text-white' : 'border-neutral-200 bg-white text-neutral-400'
                  }`}
                >
                  {selected ? <CheckCircle2 size={17} /> : <Plus size={16} />}
                </button>
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full bg-red-50 text-red-600">
                  <span className="text-title-3">{Number(question.practiceCount || 0)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="badge badge-error">{subjectName(question.subject)}</span>
                    {question.knowledgePoint && (
                      <span className="badge badge-warning">{question.knowledgePoint}</span>
                    )}
                    <span className={`badge ${wrongStatusMeta[wrongStatus(question)]?.className || 'badge-error'}`}>
                      {wrongStatusMeta[wrongStatus(question)]?.label || '新错题'}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-subhead text-neutral-900">{question.content}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-caption-1 text-neutral-500">
                    <span className="flex items-center gap-1"><Clock3 size={13} />{question.practiceCount || 0}次复练</span>
                    <span>答案 {question.answer || question.correctAnswer || '-'}</span>
                  </div>
                </div>
                <ChevronRight size={18} className="mt-1 shrink-0 text-neutral-400" />
              </div>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )

  const renderDetailModal = () => (
    <Modal
      isOpen={showDetailModal}
      onClose={() => setShowDetailModal(false)}
      title="错题详情"
      fullScreen
    >
      {selectedQuestion && (
        <div className="space-y-4 p-4">
          <section className="rounded-card border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="badge badge-error">{subjectName(selectedQuestion.subject)}</span>
              {selectedQuestion.knowledgePoint && <span className="badge badge-warning">{selectedQuestion.knowledgePoint}</span>}
              <span className={`badge ${wrongStatusMeta[wrongStatus(selectedQuestion)]?.className || 'badge-error'}`}>
                {wrongStatusMeta[wrongStatus(selectedQuestion)]?.label || '新错题'}
              </span>
            </div>
            <div className="mb-2 text-caption-1 text-neutral-500">题目</div>
            <div className="text-body text-neutral-900">{selectedQuestion.content}</div>
          </section>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <section className="rounded-card bg-red-50 p-4">
              <div className="text-caption-1 text-neutral-500">你的答案</div>
              <div className="mt-1 text-title-2 text-red-600">{selectedQuestion.userAnswer || selectedQuestion.wrongAnswer || '未作答'}</div>
            </section>
            <section className="rounded-card bg-green-50 p-4">
              <div className="text-caption-1 text-neutral-500">正确答案</div>
              <div className="mt-1 text-title-2 text-green-700">{selectedQuestion.answer || selectedQuestion.correctAnswer}</div>
            </section>
          </div>

          <section className="rounded-card border border-neutral-200 bg-white p-4">
            <div className="mb-2 text-caption-1 text-neutral-500">讲解</div>
            <div className="whitespace-pre-line text-subhead text-neutral-700">{selectedQuestion.explanation || '先回到题干条件，再复盘当时出错的步骤。'}</div>
          </section>

          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <Button fullWidth onClick={() => handlePracticeAgain(selectedQuestion)}>
              <RefreshCw size={18} className="mr-2" />
              再练一次
            </Button>
            <Button variant="secondary" fullWidth onClick={() => {
              startPracticePack([selectedQuestion], '单题订正')
              setShowDetailModal(false)
            }}>
              <ListChecks size={18} className="mr-2" />
              加入单题小卷
            </Button>
            {wrongStatus(selectedQuestion) !== 'mastered' && (
              <Button variant="secondary" fullWidth onClick={() => {
                handleMarkCorrected(selectedQuestion.id)
                setShowDetailModal(false)
              }}>
                <CheckCircle2 size={18} className="mr-2" />
                标记已订正
              </Button>
            )}
            {wrongStatus(selectedQuestion) !== 'mastered' && (
              <Button variant="secondary" fullWidth onClick={() => {
                handleMarkMastered(selectedQuestion.id)
                setShowDetailModal(false)
              }}>
                <CheckCircle2 size={18} className="mr-2" />
                标记已掌握
              </Button>
            )}
            <Button variant="ghost" fullWidth onClick={() => {
              removeFromWrongSet(selectedQuestion.id)
              setShowDetailModal(false)
            }}>
              <Trash2 size={18} className="mr-2" />
              移除错题
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )

  return (
    <div className="app-page">
      <main className="app-shell">
        <header className="mb-6">
          <div className="page-kicker mb-2">错题强化</div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="mb-3 text-display text-neutral-900">{totalWrong} 道待回收</h1>
              <p className="text-body text-neutral-500">按学科、知识点和掌握状态组织错题。</p>
            </div>
            {filteredQuestions.length > 0 && (
              <button
                type="button"
                title="导出当前错题"
                aria-label="导出当前错题"
                onClick={exportCurrentQuestions}
                className="surface-line flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-neutral-700 shadow-sm"
              >
                <Download size={18} />
              </button>
            )}
          </div>
        </header>

        {message && (
          <div className="mb-4 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-subhead text-amber-800">
            {message}
          </div>
        )}

        {renderSummary()}
        {wrongQuestions.length > 0 ? (
          <>
            {renderFilter()}
            {renderActions()}
            {filteredQuestions.length > 0 ? renderList() : renderEmptyState()}
          </>
        ) : renderEmptyState()}
      </main>

      <AnimatePresence>{renderSelectionBar()}</AnimatePresence>
      <AnimatePresence>{renderDetailModal()}</AnimatePresence>
    </div>
  )
}

export default WrongQuestionPage
