import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookPlus,
  Camera,
  CheckCircle2,
  FileText,
  Image,
  Library,
  Loader2,
  RefreshCw,
  ScanLine,
  Send,
  Sparkles,
  Type,
  XCircle,
} from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'
import { useUploadStore, useUserStore, useWrongQuestionStore } from '../stores'
import { apiGet, apiPost } from '../utils/api'

const CapturePage = ({ onFlowStateChange, onOpenPracticeCenter }) => {
  const {
    uploadedQuestions,
    currentUpload,
    setImage,
    setRecognizedText,
    setQuestion,
    startExplanation,
    setExplanation,
    startCorrection,
    setCorrection,
    clearUpload,
    addToUploadedQuestions,
    aiExplanation,
    aiCorrection,
  } = useUploadStore()
  const { studentProfile } = useUserStore()
  const { addWrongQuestion } = useWrongQuestionStore()
  const [mode, setMode] = useState('select')
  const [userAnswer, setUserAnswer] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [savedQuestion, setSavedQuestion] = useState(null)
  const [recognitionConfig, setRecognitionConfig] = useState({
    visible: !import.meta.env.PROD,
    recognitionLaunchStrategy: import.meta.env.PROD ? 'deferred' : 'development',
  })
  const fileInputRef = useRef(null)
  const photoRecognitionVisible = recognitionConfig.visible !== false
  const flowSteps = photoRecognitionVisible ? ['上传', '确认', '作答', '批改'] : ['输入', '作答', '批改']

  useEffect(() => {
    let active = true
    apiGet('/recognition/config', {
      visible: !import.meta.env.PROD,
      recognitionLaunchStrategy: import.meta.env.PROD ? 'deferred' : 'development',
    }).then((config) => {
      if (active && config) setRecognitionConfig(config)
    })
    return () => {
      active = false
    }
  }, [])

  const setFlowMode = (nextMode) => {
    if (nextMode !== 'select') setSavedQuestion(null)
    setMode(nextMode)
    onFlowStateChange?.(nextMode !== 'select')
  }

  const resetFlow = () => {
    clearUpload()
    setUserAnswer('')
    setUploadError('')
    setFlowMode('select')
  }

  const simulateOCR = async (imageData) => {
    if (!photoRecognitionVisible) {
      setUploadError('拍照识别本轮暂未开放，请先用“手动输入”完成这道题。')
      return
    }
    setImage(imageData)
    setUploadError('')
    setFlowMode('recognizing')

    const result = await apiPost('/uploads/recognize', { image: imageData }, () => ({
      recognizedText: '计算：125 × 8 = ?',
      question: {
        id: Date.now(),
        type: 'fill',
        content: '计算：125 × 8 = ?',
        answer: '1000',
        explanation: '125 × 8 可以拆成 125 × 4 × 2，先得 500，再乘 2 得 1000。',
        knowledgePoint: '乘法运算',
        difficulty: 2,
        subject: 'math',
      },
    }))
    if (!result?.recognizedText || !result?.question) {
      setUploadError('图片识别暂时失败，请换一张清晰照片，或先用“手动输入”继续完成这道题。')
      setFlowMode('select')
      return
    }
    setRecognizedText(result.recognizedText)
    setQuestion({
      ...result.question,
      type: result.question.type === '填空题' ? 'fill' : result.question.type,
      subject: result.question.subject === '数学' ? 'math' : result.question.subject,
    })
    setFlowMode('edit')
  }

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const imageData = typeof reader.result === 'string' ? reader.result : ''
      if (!imageData) {
        setUploadError('图片读取失败，请重新选择照片。')
        return
      }
      simulateOCR(imageData)
    }
    reader.onerror = () => {
      setUploadError('图片读取失败，请重新选择照片。')
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const handleManualStart = () => {
    if (!currentUpload.recognizedText.trim()) return
    setQuestion({
      id: Date.now(),
      type: 'short_answer',
      content: currentUpload.recognizedText,
      answer: '',
      explanation: '',
      knowledgePoint: '',
      difficulty: 2,
      subject: 'math',
    })
    setFlowMode('answer')
  }

  const handleSubmitAnswer = () => {
    if (!userAnswer.trim()) return
    setFlowMode('result')
    startCorrection()

    apiPost('/answers/grade', {
      questionId: currentUpload.question?.id,
      answer: userAnswer.trim(),
      question: currentUpload.question,
    }, () => {
      const isCorrect = userAnswer.trim() === currentUpload.question?.answer
      return {
        isCorrect,
        userAnswer: userAnswer.trim(),
        correctAnswer: currentUpload.question?.answer || '待老师确认',
        feedback: isCorrect
          ? '回答正确。这个计算可以直接记住，也可以用拆分法快速验证。'
          : `答案需要修正。参考答案是 ${currentUpload.question?.answer || '待老师确认'}。建议把乘法拆成 125 × 4 × 2 来算。`,
      }
    }).then((nextCorrection) => {
      setCorrection(nextCorrection)
    })
  }

  const handleGetExplanation = () => {
    startExplanation()
    setTimeout(() => {
      setExplanation('先观察数字结构：125 和 8 是常见组合。125 × 8 = 1000，也可以拆成 125 × 4 × 2，降低心算压力。')
    }, 700)
  }

  const handleGenerateSimilar = () => {
    setQuestion({
      id: Date.now(),
      type: 'fill',
      content: '计算：250 × 4 = ?',
      answer: '1000',
      explanation: '250 × 4 = 1000。',
      knowledgePoint: '乘法运算',
      difficulty: 2,
      subject: 'math',
    })
    setRecognizedText('计算：250 × 4 = ?')
    setCorrection(null)
    setUserAnswer('')
    setFlowMode('answer')
  }

  const handleAddToWrongSet = () => {
    if (currentUpload.question) {
      addWrongQuestion({
        ...currentUpload.question,
        userAnswer: userAnswer.trim(),
        isCorrect: false,
      })
    }
    resetFlow()
  }

  const handleComplete = async () => {
    if (currentUpload.question) {
      const correction = aiCorrection.result
      const fallbackQuestion = {
        ...currentUpload.question,
        id: `local-upl-${Date.now()}`,
        user: studentProfile.nickname || '同学',
        source: 'uploaded',
        sourceType: currentUpload.image ? 'photo' : 'manual',
        recognizedText: currentUpload.recognizedText,
        userAnswer: userAnswer.trim(),
        correctionStatus: correction?.isCorrect ? 'correct' : correction?.isCorrect === false ? 'wrong' : 'ungraded',
        uploadedAt: Date.now(),
      }
      const saved = await apiPost('/uploaded-questions', {
        user: studentProfile.nickname || '同学',
        sourceType: currentUpload.image ? 'photo' : 'manual',
        recognizedText: currentUpload.recognizedText,
        userAnswer: userAnswer.trim(),
        isCorrect: correction?.isCorrect,
        correctionStatus: correction?.isCorrect ? 'correct' : correction?.isCorrect === false ? 'wrong' : 'ungraded',
        question: currentUpload.question,
      }, () => fallbackQuestion)
      const stored = addToUploadedQuestions(saved || fallbackQuestion, {
        recognizedText: currentUpload.recognizedText,
        userAnswer: userAnswer.trim(),
        correctionStatus: (saved || fallbackQuestion).correctionStatus,
        sourceType: (saved || fallbackQuestion).sourceType,
        uploadedAt: (saved || fallbackQuestion).uploadedAt,
      })
      setSavedQuestion(stored)
    }
    resetFlow()
    if (currentUpload.question) onOpenPracticeCenter?.('uploads')
  }

  const renderShell = (children) => (
    <div className="app-page">
      <main className="app-shell">
        {children}
      </main>
    </div>
  )

  const renderSelectMode = () => renderShell(
    <>
      <header className="mb-7">
        <div className="page-kicker mb-2">拍题批改</div>
        <h1 className="mb-3 text-display text-neutral-900">把一道题变成可练习任务</h1>
        <p className="text-body text-neutral-500">{photoRecognitionVisible ? '上传、确认、作答、批改，四步完成。' : '输入、作答、批改，三步完成。'}</p>
      </header>

      <section className="mb-6 rounded-card bg-neutral-900 p-5 text-white">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-caption-1 text-white/60">当前流程</div>
            <h2 className="mt-1 text-title-1">{photoRecognitionVisible ? '识别后先确认题目' : '手动输入后直接练习'}</h2>
          </div>
          <ScanLine size={28} className="text-primary-200" />
        </div>
        <div className={`grid gap-2 text-center text-caption-1 text-white/72 ${photoRecognitionVisible ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
          {flowSteps.map((step, index) => (
            <div key={step} className="rounded-card bg-white/10 py-3">
              <div className="mb-1 text-title-3 text-white">{index + 1}</div>
              {step}
            </div>
          ))}
        </div>
      </section>

      <div className="student-card-grid">
        {photoRecognitionVisible && (
          <>
            <Card animate={false} onClick={() => simulateOCR('mock-camera-image')} aria-label="拍照识别" className="bg-white">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-800">
                  <Camera size={23} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-title-2 text-neutral-900">拍照识别</h3>
                  <p className="mt-1 text-caption-1 text-neutral-500">适合纸质作业、练习册题目</p>
                </div>
              </div>
            </Card>

            <Card animate={false} onClick={() => fileInputRef.current?.click()} aria-label="相册上传" className="bg-white">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-700">
                  <Image size={23} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-title-2 text-neutral-900">相册上传</h3>
                  <p className="mt-1 text-caption-1 text-neutral-500">从截图或照片中选择题目</p>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
            </Card>
          </>
        )}

        <Card
          animate={false}
          onClick={() => setFlowMode('input')}
          aria-label="手动输入"
          data-testid="capture-manual-input-card"
          className="bg-white"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <Type size={23} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-title-2 text-neutral-900">手动输入</h3>
              <p className="mt-1 text-caption-1 text-neutral-500">适合短题、口算、文字题</p>
            </div>
          </div>
        </Card>
      </div>

      {uploadError && (
        <div className="mt-4 rounded-card bg-red-50 p-4 text-subhead font-semibold text-red-700" role="alert">
          {uploadError}
        </div>
      )}

      {savedQuestion && (
        <div className="mt-4 rounded-card border border-green-200 bg-green-50 p-4" role="status" aria-live="polite">
          <div className="mb-1 text-title-3 text-green-800">已存入拍题本</div>
          <div className="line-clamp-2 text-subhead text-green-900">{savedQuestion.content || savedQuestion.recognizedText || '刚保存的题目'}</div>
          <button
            onClick={() => onOpenPracticeCenter?.('uploads')}
            className="mt-3 text-caption-1 font-semibold text-green-800"
          >
            去拍题本查看
          </button>
        </div>
      )}

      {uploadedQuestions.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">最近拍题</h2>
            <button onClick={onOpenPracticeCenter} className="text-caption-1 font-semibold text-primary-700">
              去拍题本
            </button>
          </div>
          <div className="surface-line overflow-hidden rounded-card bg-white">
            {uploadedQuestions.slice(0, 3).map((question, index) => (
              <div key={question.id} className={`flex min-h-[58px] items-center gap-3 px-4 ${index > 0 ? 'border-t border-neutral-100' : ''}`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-800">
                  <Library size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-subhead text-neutral-900">{question.content}</div>
                  <div className="text-caption-1 text-neutral-500">{question.knowledgePoint || '未归类知识点'}</div>
                </div>
                <span className={`badge ${question.correctionStatus === 'wrong' ? 'badge-error' : question.correctionStatus === 'correct' ? 'badge-success' : 'badge-primary'}`}>
                  {question.correctionStatus === 'wrong' ? '待订正' : question.correctionStatus === 'correct' ? '已批改' : '待练习'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )

  const renderRecognizing = () => renderShell(
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-700"
      >
        <Loader2 size={32} />
      </motion.div>
      <h1 className="mb-2 text-title-1 text-neutral-900">正在识别题目</h1>
      <p className="text-subhead text-neutral-500">识别完成后会进入题目确认。</p>
    </div>
  )

  const renderEdit = () => renderShell(
    <>
      <header className="mb-5">
        <div className="page-kicker mb-2">确认题目</div>
        <h1 className="text-display text-neutral-900">检查识别结果</h1>
      </header>

      <Card staticCard className="mb-4 bg-white">
        <div className="mb-3 flex items-center gap-2 text-caption-1 text-neutral-500">
          <FileText size={15} />
          <span>识别内容</span>
        </div>
        <textarea
          value={currentUpload.recognizedText}
          onChange={(e) => setRecognizedText(e.target.value)}
          className="input-field min-h-[132px] w-full resize-none"
          placeholder="题目内容"
        />
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button variant="secondary" fullWidth onClick={resetFlow}>重来</Button>
        <Button fullWidth onClick={() => setFlowMode('answer')}>确认题目</Button>
      </div>
    </>
  )

  const renderInput = () => renderShell(
    <>
      <header className="mb-5">
        <div className="page-kicker mb-2">手动输入</div>
        <h1 className="text-display text-neutral-900">输入题目内容</h1>
      </header>

      <Card staticCard className="mb-4 bg-white">
        <textarea
          value={currentUpload.recognizedText}
          onChange={(e) => setRecognizedText(e.target.value)}
          className="input-field min-h-[180px] w-full resize-none"
          placeholder="例如：计算 125 × 8 = ?"
        />
      </Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button variant="secondary" fullWidth onClick={resetFlow}>取消</Button>
        <Button fullWidth disabled={!currentUpload.recognizedText.trim()} onClick={handleManualStart}>开始作答</Button>
      </div>
    </>
  )

  const renderAnswer = () => renderShell(
    <>
      <header className="mb-5">
        <div className="page-kicker mb-2">作答</div>
        <h1 className="text-display text-neutral-900">先独立写答案</h1>
      </header>

      <Card staticCard className="mb-4 bg-white">
        <div className="mb-2 text-caption-1 text-neutral-500">题目</div>
        <div className="text-body text-neutral-900">{currentUpload.question?.content}</div>
      </Card>

      <Card staticCard className="mb-4 bg-white">
        <label className="mb-2 block text-caption-1 text-neutral-500">你的答案</label>
        <input
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          className="input-field w-full"
          placeholder="输入答案"
        />
      </Card>

      {aiExplanation.content && (
        <div className="mb-4 rounded-card bg-primary-50 p-4 text-subhead text-primary-900">
          {aiExplanation.content}
        </div>
      )}

      <div className="mb-3">
        <Button variant="ghost" fullWidth loading={aiExplanation.isLoading} onClick={handleGetExplanation}>
          <Sparkles size={18} className="mr-2" />
          获取提示
        </Button>
      </div>
      <Button fullWidth disabled={!userAnswer.trim()} onClick={handleSubmitAnswer}>
        <Send size={18} className="mr-2" />
        提交批改
      </Button>
    </>
  )

  const renderResult = () => {
    const result = aiCorrection.result
    const isCorrect = result?.isCorrect

    return renderShell(
      <>
        <header className="mb-5">
          <div className="page-kicker mb-2">批改结果</div>
          <h1 className="text-display text-neutral-900" role="status" aria-live="polite">
            {isCorrect ? '答案正确' : '需要订正'}
          </h1>
        </header>

        <Card staticCard className={`mb-4 bg-white ${isCorrect ? 'border-green-200' : 'border-red-200'}`}>
          <div className="mb-5 flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${isCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {isCorrect ? <CheckCircle2 size={27} /> : <XCircle size={27} />}
            </div>
            <div>
              <div className={`text-title-1 ${isCorrect ? 'text-green-700' : 'text-red-600'}`}>
                {isCorrect ? '回答正确' : '回答错误'}
              </div>
              <div className="text-caption-1 text-neutral-500">你的答案：{result?.userAnswer || userAnswer}</div>
            </div>
          </div>
          {!isCorrect && (
            <div className="mb-4 rounded-card bg-green-50 p-3">
              <div className="text-caption-1 text-neutral-500">参考答案</div>
              <div className="mt-1 text-title-2 text-green-700">{result?.correctAnswer}</div>
            </div>
          )}
          <div className="text-subhead text-neutral-700">
            {result?.feedback
              ? result.feedback.replace(/^答案需要订正[，,。]?/, '订正建议：')
              : '正在生成批改结果...'}
          </div>
        </Card>

        <div className="grid gap-3">
          <Button variant="secondary" fullWidth onClick={handleGenerateSimilar}>
            <RefreshCw size={18} className="mr-2" />
            生成同类题
          </Button>
          {!isCorrect && (
            <Button variant="ghost" fullWidth onClick={handleAddToWrongSet}>
              <BookPlus size={18} className="mr-2" />
              加入错题集
            </Button>
          )}
          <Button fullWidth onClick={handleComplete} data-testid="capture-complete-button">完成并查看拍题本</Button>
        </div>
      </>
    )
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        {mode === 'select' && renderSelectMode()}
        {mode === 'recognizing' && renderRecognizing()}
        {mode === 'edit' && renderEdit()}
        {mode === 'input' && renderInput()}
        {mode === 'answer' && renderAnswer()}
        {mode === 'result' && renderResult()}
      </motion.div>
    </AnimatePresence>
  )
}

export default CapturePage
