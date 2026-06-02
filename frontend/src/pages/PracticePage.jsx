import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ChevronLeft, Clock3, Lightbulb, Loader2, Star, XCircle } from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'
import Modal from '../components/Modal'
import { useFavoriteQuestionStore, usePracticeStore, useUserStore, useWrongQuestionStore } from '../stores'
import { apiPost } from '../utils/api'

const subjectLabels = {
  math: '数学',
  chinese: '语文',
  english: '英语',
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  history: '历史',
  geography: '地理',
  politics: '政治',
}

const PracticePage = ({ pack, onComplete }) => {
  const { completePractice, currentPractice } = usePracticeStore()
  const { studentProfile, stats, updateStats, applyPointTransaction } = useUserStore()
  const { addWrongQuestion } = useWrongQuestionStore()
  const { addFavoriteQuestion, isFavorite } = useFavoriteQuestionStore()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [answers, setAnswers] = useState([])
  const [favoriteMessage, setFavoriteMessage] = useState('')

  useEffect(() => {
    if (pack?.questions?.length > 0) {
      setCurrentQuestion(pack.questions[0])
      setCurrentIndex(0)
      setUserAnswer('')
      setResult(null)
      setShowResult(false)
      setShowExplanation(false)
      setAnswers([])
      setFavoriteMessage('')
    }
  }, [pack])

  const progress = {
    current: currentIndex + 1,
    total: pack?.questions?.length || 0,
    percentage: pack?.questions?.length > 0 ? ((currentIndex + 1) / pack.questions.length) * 100 : 0,
  }

  const handleSubmitAnswer = () => {
    if (!userAnswer.trim() || !currentQuestion) return
    setIsLoading(true)

    apiPost('/answers/grade', {
      questionId: currentQuestion.id,
      answer: userAnswer.trim(),
      question: currentQuestion,
    }, () => {
      const answerIsCorrect = userAnswer.trim() === currentQuestion.answer
      return {
        isCorrect: answerIsCorrect,
        userAnswer: userAnswer.trim(),
        correctAnswer: currentQuestion.answer,
        explanation: currentQuestion.explanation,
      }
    }).then(async (nextResult) => {
      const answerIsCorrect = nextResult.isCorrect
      setResult(nextResult)
      setShowResult(true)
      setIsLoading(false)
      setAnswers((prev) => [...prev, {
        questionId: currentQuestion.id,
        answer: userAnswer.trim(),
        isCorrect: answerIsCorrect,
        content: currentQuestion.content,
        type: currentQuestion.type,
        knowledgePoint: currentQuestion.knowledgePoint,
        correctAnswer: nextResult.correctAnswer || currentQuestion.answer,
        explanation: nextResult.explanation || currentQuestion.explanation,
        question: currentQuestion,
      }])

      if (!answerIsCorrect) {
        addWrongQuestion({
          ...currentQuestion,
          userAnswer: userAnswer.trim(),
          isCorrect: false,
          subject: pack?.subject || 'math',
        })
      }
    })
  }

  const handleNext = () => {
    if (currentIndex < pack.questions.length - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      setCurrentQuestion(pack.questions[nextIndex])
      setUserAnswer('')
      setShowResult(false)
      setResult(null)
      setShowExplanation(false)
      return
    }

    completePractice()
    const finalAnswers = answers.some(answer => answer.questionId === currentQuestion.id)
      ? answers
      : [...answers, {
          questionId: currentQuestion.id,
          answer: userAnswer.trim(),
          isCorrect: Boolean(result?.isCorrect),
          content: currentQuestion.content,
          type: currentQuestion.type,
          knowledgePoint: currentQuestion.knowledgePoint,
          correctAnswer: currentQuestion.answer,
          explanation: currentQuestion.explanation,
          question: currentQuestion,
        }]
    const correctCount = finalAnswers.filter(a => a.isCorrect).length
    const duration = currentPractice.startTime ? Math.max(1, Math.round((Date.now() - currentPractice.startTime) / 60000)) : pack.estimatedTime || 0
    const score = pack.questions.length ? Math.round((correctCount / pack.questions.length) * 100) : 0
    const wrongAnswers = finalAnswers.filter(answer => !answer.isCorrect)
    const weakKnowledgePoints = Array.from(new Set(wrongAnswers.map(answer => answer.knowledgePoint).filter(Boolean)))
    const rating = score >= 90 ? '优秀' : score >= 75 ? '良好' : score >= 60 ? '需巩固' : '重点补弱'
    const parentSummary = score >= 90
      ? '本轮掌握稳定，家长可以鼓励孩子继续保持节奏。'
      : score >= 75
        ? '整体完成不错，建议家长陪孩子复盘错题知识点。'
        : '本轮薄弱点比较集中，建议先订正错题，再安排同类题巩固。'
    const nextAction = weakKnowledgePoints.length > 0
      ? `优先复习：${weakKnowledgePoints.slice(0, 3).join('、')}`
      : '继续完成下一组教材同步练，保持手感。'
    const report = {
      packName: pack.name,
      subject: subjectLabels[pack.subject] || pack.subject || '数学',
      roundType: pack.roundType || 'daily',
      total: pack.questions.length,
      correct: correctCount,
      wrong: wrongAnswers.length,
      score,
      rating,
      duration,
      weakKnowledgePoints,
      parentSummary,
      nextAction,
      answers: finalAnswers,
    }

    setIsLoading(true)
    apiPost('/practice-records', {
      user: studentProfile.nickname || '同学',
      packId: pack.id,
      packName: pack.name,
      subject: subjectLabels[pack.subject] || pack.subject || '数学',
      roundType: pack.roundType || 'daily',
      duration,
      answers: finalAnswers.map((answer) => ({
        questionId: answer.questionId,
        answer: answer.answer,
        userAnswer: answer.answer,
        content: answer.content,
        type: answer.type,
        knowledgePoint: answer.knowledgePoint,
        correctAnswer: answer.correctAnswer,
        explanation: answer.explanation,
        question: answer.question,
      })),
    }, report).then((record) => {
      const authoritativeReport = record || report
      if (record?.rewardTransaction) applyPointTransaction(record.rewardTransaction)
      const totalCompleted = (stats.totalCompleted || 0) + (authoritativeReport.total || pack.questions.length)
      const priorCorrect = Math.round(((stats.accuracyRate || 0) / 100) * (stats.totalCompleted || 0))
      updateStats({
        weeklyCompleted: (stats.weeklyCompleted || 0) + (authoritativeReport.total || pack.questions.length),
        totalCompleted,
        accuracyRate: totalCompleted ? Math.round(((priorCorrect + (authoritativeReport.correct || 0)) / totalCompleted) * 100) : 0,
      })
      setIsLoading(false)
      onComplete(authoritativeReport)
    })
  }

  const handleFavoriteQuestion = () => {
    if (!currentQuestion) return
    const favorite = {
      questionId: currentQuestion.id,
      packId: pack.id,
      packName: pack.name,
      subject: subjectLabels[pack.subject] || pack.subject || '数学',
      type: currentQuestion.type,
      knowledgePoint: currentQuestion.knowledgePoint,
      content: currentQuestion.content,
      answer: currentQuestion.answer,
      explanation: currentQuestion.explanation,
    }
    addFavoriteQuestion(favorite)
    setFavoriteMessage('已收藏到“我的-收藏题目”。')
    apiPost('/favorite-questions', {
      user: studentProfile.nickname || '同学',
      ...favorite,
      question: currentQuestion,
    }, null)
  }

  const selectChoice = (option) => {
    if (showResult) return
    setUserAnswer(option.charAt(0))
  }

  const handleShowHint = () => {
    setShowExplanation(true)
  }

  const renderChoiceQuestion = () => (
    <div className="grid gap-3">
      {currentQuestion.options?.map((option, index) => {
        const key = option.charAt(0)
        const isAnswer = showResult && key === currentQuestion.answer
        const isWrongPick = showResult && userAnswer === key && key !== currentQuestion.answer
        const selected = userAnswer === key

        return (
          <button
            key={option}
            onClick={() => selectChoice(option)}
            disabled={showResult}
            className={`surface-line flex min-h-[62px] items-center gap-3 rounded-card bg-white p-4 text-left transition-all ${
              isAnswer ? 'border-green-500 bg-green-50' : ''
            } ${isWrongPick ? 'border-red-400 bg-red-50' : ''} ${
              selected && !showResult ? 'border-primary-600 bg-primary-50' : ''
            }`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-title-3 ${
              isAnswer ? 'bg-green-600 text-white' : isWrongPick ? 'bg-red-600 text-white' : selected ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-700'
            }`}>
              {isAnswer ? <CheckCircle2 size={17} /> : isWrongPick ? <XCircle size={17} /> : key}
            </span>
            <span className="text-body text-neutral-900">{option}</span>
          </button>
        )
      })}
    </div>
  )

  const renderTextAnswer = (multiline = false) => (
    <div className="grid gap-4">
      {multiline ? (
        <textarea
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          disabled={showResult}
          className="input-field min-h-[150px] w-full resize-none"
          placeholder="写下答案或过程"
        />
      ) : (
        <input
          type="text"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          disabled={showResult}
          className="input-field w-full text-center text-title-1"
          placeholder="输入答案"
        />
      )}
      {showResult && !result?.isCorrect && (
        <div className="rounded-card bg-green-50 p-4">
          <div className="text-caption-1 text-neutral-500">正确答案</div>
          <div className="mt-1 text-title-2 text-green-700">{currentQuestion.answer}</div>
        </div>
      )}
    </div>
  )

  const renderAnswerArea = () => {
    if (currentQuestion?.type === 'choice') return renderChoiceQuestion()
    if (currentQuestion?.type === 'application') return renderTextAnswer(true)
    return renderTextAnswer(false)
  }

  const renderResultModal = () => (
    <Modal
      isOpen={showResult}
      onClose={() => setShowResult(false)}
      title={result?.isCorrect ? '回答正确' : '回答错误'}
    >
      <div className="space-y-4">
        <div className={`rounded-card p-5 ${result?.isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className={`mb-2 flex items-center gap-2 text-title-2 ${result?.isCorrect ? 'text-green-700' : 'text-red-600'}`}>
            {result?.isCorrect ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
            {result?.isCorrect ? '很好，继续保持' : '这题需要回收'}
          </div>
          <p className="text-subhead text-neutral-600">
            {result?.isCorrect ? '可以进入下一题。' : '已自动加入错题集，后续可在错题强化里再练。'}
          </p>
        </div>

        <div className="rounded-card border border-neutral-200 bg-white p-4">
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="flex w-full items-center justify-between text-left text-title-3 text-neutral-900"
          >
            AI讲解
            <span className="text-caption-1 text-primary-700">{showExplanation ? '收起' : '展开'}</span>
          </button>
          <AnimatePresence>
            {showExplanation && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="mt-3 whitespace-pre-line text-subhead text-neutral-700"
              >
                {currentQuestion?.explanation || '暂无讲解'}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <Button fullWidth loading={isLoading} onClick={handleNext}>
          {progress.current < progress.total ? '下一题' : '完成练习'}
        </Button>
      </div>
    </Modal>
  )

  if (!currentQuestion) {
    return (
      <div className="app-page">
        <div className="app-shell flex min-h-screen items-center justify-center">
          <Loader2 size={32} className="animate-spin text-primary-700" />
        </div>
      </div>
    )
  }

  return (
    <div className="app-page">
      <main className="app-shell student-narrow">
        <header className="mb-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              onClick={() => onComplete(null)}
              className="flex items-center gap-1 text-caption-1 text-neutral-500"
            >
              <ChevronLeft size={18} />
              返回
            </button>
            <div className="flex items-center gap-1 text-caption-1 text-neutral-500">
              <Clock3 size={15} />
              {pack?.estimatedTime || 15} 分钟
            </div>
          </div>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="page-kicker mb-2">{pack?.name || '练习'}</div>
              <h1 className="text-display text-neutral-900">第 {progress.current} 题</h1>
            </div>
            <span className="text-title-3 text-primary-700">{Math.round(progress.percentage)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
            <motion.div
              className="h-full rounded-full bg-primary-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress.percentage}%` }}
            />
          </div>
        </header>

        <motion.section
          key={currentQuestion.id}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card staticCard className="mb-4 bg-white">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              {currentQuestion.knowledgePoint && (
                <span className="badge badge-primary">{currentQuestion.knowledgePoint}</span>
              )}
              <button
                onClick={handleFavoriteQuestion}
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  isFavorite(currentQuestion.id) ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-500'
                }`}
                aria-label="收藏题目"
              >
                <Star size={18} fill={isFavorite(currentQuestion.id) ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="text-body text-neutral-900">{currentQuestion.content}</div>
          </Card>

          {favoriteMessage && (
            <div className="mb-4 rounded-card bg-amber-50 p-3 text-caption-1 font-semibold text-amber-700">
              {favoriteMessage}
            </div>
          )}

          {renderAnswerArea()}

          {showExplanation && !showResult && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-card bg-primary-50 p-4 text-subhead text-primary-900"
            >
              {currentQuestion.explanation || '先拆解题干条件，再写出关键计算步骤。'}
            </motion.div>
          )}

          {!showResult && (
            <div className="mt-4 grid gap-3">
              <Button variant="ghost" fullWidth onClick={handleShowHint}>
                <Lightbulb size={18} className="mr-2" />
                查看提示
              </Button>
              <Button fullWidth disabled={!userAnswer.trim() || isLoading} loading={isLoading} onClick={handleSubmitAnswer}>
                提交答案
              </Button>
            </div>
          )}
        </motion.section>
      </main>

      {renderResultModal()}
    </div>
  )
}

export default PracticePage
