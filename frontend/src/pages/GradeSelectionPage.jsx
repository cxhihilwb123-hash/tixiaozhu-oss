import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, GraduationCap, Sparkles } from 'lucide-react'
import Button from '../components/Button'
import { useUserStore } from '../stores'
import { GRADE_OPTIONS } from '../utils/constants'

const gradeGroups = [
  { title: '小学', items: GRADE_OPTIONS.slice(0, 6) },
  { title: '初中', items: GRADE_OPTIONS.slice(6, 9) },
  { title: '高中', items: GRADE_OPTIONS.slice(9, 12) },
]

const GradeSelectionPage = ({ onComplete }) => {
  const { setGrade, setNickname } = useUserStore()
  const [selectedGrade, setSelectedGrade] = useState(null)
  const [nickname, setNicknameState] = useState('')
  const [step, setStep] = useState('grade')

  const handleGradeConfirm = () => {
    if (!selectedGrade) return
    setGrade(selectedGrade.value, selectedGrade.label)
    setStep('nickname')
  }

  const handleNicknameConfirm = () => {
    if (nickname.trim()) {
      setNickname(nickname.trim())
    }
    setStep('complete')
  }

  const renderShell = (key, children, footer) => (
    <motion.div
      key={key}
      initial={{ opacity: 0, x: 36 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -36 }}
      className="app-page flex min-h-screen flex-col"
    >
      <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-5 pb-4 pt-5 sm:px-8 lg:pt-10">
        {children}
      </main>
      <div className="mx-auto w-full max-w-[760px] px-5 pb-6 safe-area-bottom sm:px-8">
        {footer}
      </div>
    </motion.div>
  )

  const renderGradeSelection = () => renderShell(
    'grade',
    <>
      <header className="mb-5">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white">
          <GraduationCap size={21} />
        </div>
        <div className="page-kicker mb-2">题小助</div>
        <h1 className="mb-2 text-display text-neutral-900">先确定学习阶段</h1>
        <p className="text-body text-neutral-500">题包、错题强化和练习节奏会按年级匹配。</p>
      </header>

      <div className="space-y-4">
        {gradeGroups.map((group) => (
          <section key={group.title}>
            <h2 className="mb-2 text-caption-1 font-bold text-neutral-500">{group.title}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {group.items.map((grade) => {
                const active = selectedGrade?.value === grade.value
                return (
                  <button
                    key={grade.value}
                    onClick={() => setSelectedGrade(grade)}
                    className={`surface-line relative min-h-[58px] rounded-card bg-white text-left transition-all ${
                      active ? 'border-primary-600 bg-primary-50 text-primary-900' : 'text-neutral-800'
                    }`}
                  >
                    <span className="block px-3 pt-3 text-title-3">{grade.shortLabel}</span>
                    <span className="block px-3 pt-0.5 text-caption-1 text-neutral-500">{grade.label}</span>
                    {active && (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white">
                        <Check size={13} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </>,
    <Button fullWidth disabled={!selectedGrade} onClick={handleGradeConfirm}>
      {selectedGrade ? `确认 ${selectedGrade.label}` : '选择年级'}
    </Button>
  )

  const renderNicknameInput = () => renderShell(
    'nickname',
    <>
      <header className="mb-8 pt-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white">
          <Sparkles size={23} />
        </div>
        <h1 className="mb-3 text-display-large text-neutral-900">怎么称呼你？</h1>
        <p className="text-body text-neutral-500">昵称可选，后续可以在“我的”里调整。</p>
      </header>

      <div className="surface-line rounded-card bg-white p-4">
        <label className="mb-2 block text-caption-1 text-neutral-500">昵称</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNicknameState(e.target.value)}
          placeholder="例如：小宇"
          maxLength={10}
          className="input-field w-full text-title-2"
        />
        <p className="mt-3 text-caption-1 text-neutral-400">最多 10 个字符</p>
      </div>
    </>,
    <Button fullWidth onClick={handleNicknameConfirm}>
      {nickname.trim() ? '保存并继续' : '跳过'}
    </Button>
  )

  const renderComplete = () => renderShell(
    'complete',
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div
        initial={{ scale: 0.86, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 190, damping: 18 }}
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-600 text-white"
      >
        <Check size={38} />
      </motion.div>
      <h1 className="mb-3 text-display text-neutral-900">学习台已准备好</h1>
      <p className="max-w-[320px] text-body text-neutral-500">
        {nickname.trim() ? `${nickname}，` : ''}从今日建议开始，做完一组再回收错题。
      </p>
    </div>,
    <Button fullWidth onClick={onComplete}>
      进入题小助 <ArrowRight size={18} className="ml-2 inline" />
    </Button>
  )

  return (
    <AnimatePresence mode="wait">
      {step === 'grade' && renderGradeSelection()}
      {step === 'nickname' && renderNicknameInput()}
      {step === 'complete' && renderComplete()}
    </AnimatePresence>
  )
}

export default GradeSelectionPage
