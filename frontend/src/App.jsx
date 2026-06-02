import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUserStore, usePracticeStore } from './stores'
import TabBar from './components/TabBar'
import GradeSelectionPage from './pages/GradeSelectionPage'
import HomePage from './pages/HomePage'
import CapturePage from './pages/CapturePage'
import PracticeCenterPage from './pages/PracticeCenterPage'
import QuestionStorePage from './pages/QuestionStorePage'
import WrongQuestionPage from './pages/WrongQuestionPage'
import ProfilePage from './pages/ProfilePage'
import PracticePage from './pages/PracticePage'
import MembershipPage from './pages/MembershipPage'
import { API_BASE } from './utils/api'

function App() {
  const { authToken, isFirstVisit, logout, syncAuthenticatedUser } = useUserStore()
  const { startPractice, currentPractice } = usePracticeStore()
  
  const [showGradeSelection, setShowGradeSelection] = useState(false)
  const [activeTab, setActiveTab] = useState('home')
  const [showPractice, setShowPractice] = useState(false)
  const [currentPack, setCurrentPack] = useState(null)
  const [showMembership, setShowMembership] = useState(false)
  const [showQuestionStore, setShowQuestionStore] = useState(false)
  const [showCompletion, setShowCompletion] = useState(false)
  const [completionResult, setCompletionResult] = useState(null)
  const [captureFlowActive, setCaptureFlowActive] = useState(false)
  const [practiceInitialMode, setPracticeInitialMode] = useState('platform')
  
  // 检查是否首次进入
  useEffect(() => {
    if (isFirstVisit()) {
      setShowGradeSelection(true)
    }
  }, [])

  useEffect(() => {
    if (!authToken) return
    fetch(`${API_BASE}/auth/session`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then((payload) => {
        if (payload?.data) syncAuthenticatedUser(payload.data)
      })
      .catch(() => {
        logout()
      })
  }, [authToken, logout, syncAuthenticatedUser])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [activeTab, showPractice, showMembership, showQuestionStore, showCompletion])
  
  // 年级选择完成
  const handleGradeSelectionComplete = () => {
    setShowGradeSelection(false)
  }
  
  // 开始练习
  const handleStartPractice = (pack) => {
    setCurrentPack(pack)
    startPractice(pack)
    setShowQuestionStore(false)
    setShowPractice(true)
  }
  
  // 继续练习
  const handleContinuePractice = (session) => {
    const pack = {
      id: session.packId,
      name: session.packName,
      questions: session.questions || [],
      estimatedTime: session.estimatedTime || 15,
    }
    if (pack) {
      setCurrentPack(pack)
      setShowPractice(true)
    }
  }
  
  // 错题强化练习
  const handleStartWrongPractice = (target) => {
    if (target) {
      const questions = Array.isArray(target) ? target : target.questions || [target]
      setCurrentPack({
        id: target.id || 'wrong-practice',
        name: target.name || (questions.length > 1 ? `错题小卷 ${questions.length}题` : '错题强化'),
        questions,
        estimatedTime: target.estimatedTime || Math.max(5, questions.length * 3),
        subject: target.subject || questions[0]?.subject || 'math',
        roundType: 'wrong',
      })
      setShowPractice(true)
    }
  }
  
  // 练习完成
  const handlePracticeComplete = (result) => {
    setShowPractice(false)
    if (result) {
      setCompletionResult(result)
      setShowCompletion(true)
    }
  }
  
  // 打开会员页面
  const handleOpenMembership = () => {
    setShowMembership(true)
  }

  const handleOpenPracticeCenter = (mode = 'platform') => {
    setPracticeInitialMode(mode)
    setActiveTab('practice')
  }

  const handleOpenQuestionStore = () => {
    setShowQuestionStore(true)
  }
  
  // 渲染练习完成页面
  const renderCompletionPage = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="app-page min-h-screen px-4 py-6 sm:px-6"
    >
      <div className="mx-auto w-full max-w-[980px]">
        <header className="mb-5">
          <div className="page-kicker mb-2">练习报告</div>
          <h1 className="text-display text-neutral-900">本轮结果</h1>
          <p className="mt-2 text-body text-neutral-500">{completionResult?.packName || currentPack?.name || '本次练习'}</p>
        </header>

        <section className="surface-line mb-4 rounded-card bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-caption-1 text-neutral-500">综合评价</div>
              <div className="mt-1 text-display text-neutral-900">{completionResult?.rating || '完成'}</div>
            </div>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 text-display text-primary-800">
              {completionResult?.score ?? 0}
            </div>
          </div>
          <p className="mt-4 text-subhead text-neutral-600">{completionResult?.parentSummary || '本次练习已完成。'}</p>
        </section>

        <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['总题数', completionResult?.total || 0],
            ['正确', completionResult?.correct || 0],
            ['错题', completionResult?.wrong ?? Math.max(0, (completionResult?.total || 0) - (completionResult?.correct || 0))],
            ['用时', `${completionResult?.duration || currentPack?.estimatedTime || 0}分`],
          ].map(([label, value]) => (
            <div key={label} className="surface-line rounded-card bg-white p-3 text-center">
              <div className="text-title-2 text-neutral-900">{value}</div>
              <div className="mt-1 text-caption-1 text-neutral-500">{label}</div>
            </div>
          ))}
        </section>

        <section className="surface-line mb-4 rounded-card bg-white p-4">
          <div className="mb-2 text-title-3 text-neutral-900">家长关注</div>
          <div className="rounded-card bg-amber-50 p-3 text-subhead text-amber-900">
            {completionResult?.nextAction || '继续完成下一组练习，保持学习节奏。'}
          </div>
          {completionResult?.weakKnowledgePoints?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {completionResult.weakKnowledgePoints.map((point) => (
                <span key={point} className="rounded-full bg-red-50 px-3 py-1 text-caption-1 font-semibold text-red-700">
                  {point}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="surface-line mb-5 rounded-card bg-white p-4">
          <div className="mb-3 text-title-3 text-neutral-900">答题明细</div>
          <div className="grid max-h-[280px] gap-2 overflow-auto pr-1">
            {(completionResult?.answers || []).map((answer, index) => (
              <div key={`${answer.questionId}-${index}`} className="rounded-card bg-neutral-50 p-3">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-caption-1 font-semibold text-neutral-500">第 {index + 1} 题 · {answer.knowledgePoint || '知识点'}</span>
                  <span className={`badge ${answer.isCorrect ? 'badge-success' : 'badge-error'}`}>{answer.isCorrect ? '正确' : '需订正'}</span>
                </div>
                <div className="line-clamp-2 text-subhead text-neutral-900">{answer.content}</div>
                {!answer.isCorrect && (
                  <div className="mt-2 text-caption-1 text-neutral-500">正确答案：{answer.correctAnswer}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowCompletion(false)
              setActiveTab('home')
            }}
            className="btn-secondary flex-1"
          >
            返回首页
          </button>
          <button
            onClick={() => {
              setShowCompletion(false)
              // 可以继续练习
              if (currentPack) {
                handleStartPractice(currentPack)
              }
            }}
            className="btn-primary flex-1"
          >
            继续练习
          </button>
        </div>
      </div>
    </motion.div>
  )
  
  // 渲染主页面内容
  const renderMainContent = () => {
    if (showPractice) {
      return (
        <PracticePage
          pack={currentPack}
          onComplete={handlePracticeComplete}
        />
      )
    }
    
    if (showMembership) {
      return (
        <MembershipPage onClose={() => setShowMembership(false)} />
      )
    }

    if (showQuestionStore) {
      return (
          <QuestionStorePage
            onBack={() => setShowQuestionStore(false)}
            onRequireLogin={() => {
              setShowQuestionStore(false)
              setActiveTab('profile')
            }}
            onStartPractice={handleStartPractice}
          />
      )
    }
    
    switch (activeTab) {
      case 'home':
        return (
          <HomePage
            onStartPractice={handleStartPractice}
            onContinuePractice={handleContinuePractice}
            onStartWrongPractice={handleStartWrongPractice}
            onOpenCapture={() => setActiveTab('capture')}
            onOpenPracticeCenter={handleOpenPracticeCenter}
            onOpenQuestionStore={handleOpenQuestionStore}
          />
        )
      case 'capture':
        return <CapturePage onFlowStateChange={setCaptureFlowActive} onOpenPracticeCenter={handleOpenPracticeCenter} />
      case 'practice':
        return (
          <PracticeCenterPage
            onStartPractice={handleStartPractice}
            onOpenQuestionStore={() => setShowQuestionStore(true)}
            initialLibraryMode={practiceInitialMode}
          />
        )
      case 'wrong':
        return (
          <WrongQuestionPage onPracticeWrong={handleStartWrongPractice} />
        )
      case 'profile':
        return (
          <ProfilePage onOpenMembership={handleOpenMembership} />
        )
      default:
        return (
          <HomePage
            onStartPractice={handleStartPractice}
            onContinuePractice={handleContinuePractice}
            onStartWrongPractice={handleStartWrongPractice}
            onOpenCapture={() => setActiveTab('capture')}
            onOpenPracticeCenter={handleOpenPracticeCenter}
            onOpenQuestionStore={handleOpenQuestionStore}
          />
        )
    }
  }
  
  return (
    <div className="min-h-screen bg-neutral-50">
      <AnimatePresence mode="wait">
        {/* 年级选择页面 */}
        {showGradeSelection && (
          <GradeSelectionPage onComplete={handleGradeSelectionComplete} />
        )}
        
        {/* 练习完成页面 */}
        {showCompletion && renderCompletionPage()}
        
        {/* 主页面 */}
        {!showGradeSelection && !showCompletion && (
          <motion.div
            key={`${activeTab}-${showQuestionStore ? 'store' : 'main'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {renderMainContent()}
            
            {/* 底部导航栏 */}
            {!showPractice && !showMembership && !showQuestionStore && !captureFlowActive && (
              <TabBar
                activeTab={activeTab}
                onTabChange={(tab) => {
                  setCaptureFlowActive(false)
                  if (tab === 'practice') setPracticeInitialMode('platform')
                  setActiveTab(tab)
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
