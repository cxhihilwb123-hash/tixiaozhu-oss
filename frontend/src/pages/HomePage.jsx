import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BookOpenCheck,
  Clock3,
  Coins,
  Flame,
  LineChart,
  Play,
  ScanLine,
  ShoppingBag,
  Sparkles,
  Target,
} from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import { useUserStore, usePracticeStore, useWrongQuestionStore } from '../stores'
import { apiGet } from '../utils/api'
import { formatTime } from '../utils/constants'

const StatPill = ({ icon: Icon, label, value, tone = 'primary' }) => {
  const toneClass = {
    primary: 'bg-primary-50 text-primary-800',
    green: 'bg-green-50 text-green-700',
    orange: 'bg-amber-50 text-amber-700',
  }[tone]

  return (
    <div className="surface-line flex min-h-[76px] flex-1 flex-col justify-between rounded-card bg-white/70 p-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${toneClass}`}>
        <Icon size={17} />
      </div>
      <div>
        <div className="text-title-2 text-neutral-900">{value}</div>
        <div className="text-caption-1 text-neutral-500">{label}</div>
      </div>
    </div>
  )
}

const subjectLabel = (subject) => ({
  chinese: '语文',
  math: '数学',
  english: '英语',
  语文: '语文',
  数学: '数学',
  英语: '英语',
}[subject] || subject || '学科')

const HomePage = ({ onStartPractice, onContinuePractice, onStartWrongPractice, onOpenCapture, onOpenPracticeCenter, onOpenQuestionStore }) => {
  const { isLoggedIn, studentProfile, stats, membership, pointsAccount } = useUserStore()
  const { currentPractice, todayRecommend, setTodayRecommend } = usePracticeStore()
  const { getTotalWrongCount } = useWrongQuestionStore()
  useEffect(() => {
    if (!isLoggedIn || todayRecommend || !studentProfile.grade) return undefined
    let active = true
    apiGet(`/question-packs?user=${encodeURIComponent(studentProfile.nickname || '同学')}`, []).then((packs) => {
      if (!active) return
      const recommendedPack = (packs || []).find(pack => (
        pack.status === 'published' &&
        (pack.owned || Number(pack.pointCost || 0) <= 0) &&
        (pack.grade === studentProfile.gradeName || Number(pack.grade) === Number(studentProfile.grade))
      )) || (packs || []).find(pack => (
        pack.status === 'published' &&
        (pack.owned || Number(pack.pointCost || 0) <= 0)
      ))
      if (recommendedPack) setTodayRecommend(recommendedPack)
    })
    return () => {
      active = false
    }
  }, [isLoggedIn, studentProfile.grade, studentProfile.gradeName, studentProfile.nickname, todayRecommend, setTodayRecommend])

  const hasUnfinished = Boolean(currentPractice?.packId && !currentPractice?.isCompleted)
  const wrongCount = getTotalWrongCount()
  const primaryPack = hasUnfinished
    ? {
        id: currentPractice.packId,
        name: currentPractice.packName,
        questions: currentPractice.questions || [],
        estimatedTime: currentPractice.estimatedTime || 15,
      }
    : todayRecommend

  const completion = useMemo(() => {
    if (!hasUnfinished || !currentPractice?.questions?.length) return null
    const done = Math.max(currentPractice.currentIndex, 0)
    const total = currentPractice.questions.length
    return {
      done,
      total,
      percent: Math.round((done / total) * 100),
    }
  }, [currentPractice, hasUnfinished])

  const quickActions = [
    {
      title: '题库练习',
      desc: '按学科和题型自选',
      icon: Target,
      tone: 'bg-green-50 text-green-700',
      onClick: onOpenPracticeCenter,
    },
    {
      title: '拍题批改',
      desc: '输入题目后直接作答',
      icon: ScanLine,
      tone: 'bg-primary-50 text-primary-800',
      onClick: onOpenCapture,
    },
    {
      title: '错题强化',
      desc: wrongCount > 0 ? `${wrongCount} 道待复习` : '暂无待处理错题',
      icon: BookOpenCheck,
      tone: 'bg-amber-50 text-amber-700',
      onClick: () => onStartWrongPractice(),
    },
  ]

  return (
    <div className="app-page">
      <main className="app-shell">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-7"
        >
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="page-kicker mb-2">题小助学习台</div>
              <h1 className="text-display text-neutral-900">
                {studentProfile.nickname || '同学'}，今天从一组练习开始
              </h1>
            </div>
            {membership.isMember && (
              <span className="badge badge-primary shrink-0">会员</span>
            )}
            {!membership.isMember && (
              <span className="badge badge-warning flex shrink-0 items-center gap-1">
                <Coins size={14} />
                {pointsAccount.balance || 0}积分
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatPill icon={Target} label="本周完成" value={`${stats.weeklyCompleted}题`} />
            <StatPill icon={LineChart} label="正确率" value={`${stats.accuracyRate || 0}%`} tone="green" />
            <StatPill icon={Flame} label="待强化" value={`${wrongCount}题`} tone="orange" />
          </div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6 rounded-card bg-neutral-900 p-5 text-white"
          data-testid="home-question-store-cta"
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2 text-caption-1 text-primary-100">
                <ShoppingBag size={15} />
                题库商城
              </div>
              <h2 className="text-title-1">按教材同步、专项训练和试卷解锁题包</h2>
              <p className="mt-2 max-w-2xl text-subhead text-white/68">
                免费题包可直接练，积分题包购买后进入“我的题库”，适合家长按单元和薄弱点安排打印练习。
              </p>
            </div>
            <Button onClick={onOpenQuestionStore} className="bg-white text-neutral-900 hover:bg-white/90">
              去题库商城
            </Button>
          </div>
        </motion.section>

        {primaryPack && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mb-6"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="section-title">{hasUnfinished ? '继续上次练习' : '今日建议'}</h2>
              {completion && (
                <span className="text-caption-1 text-primary-700">已完成 {completion.percent}%</span>
              )}
            </div>
            <Card
              onClick={() => hasUnfinished ? onContinuePractice(currentPractice) : onOpenPracticeCenter()}
              className="overflow-hidden bg-white"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-caption-1 text-primary-700">
                    <Sparkles size={16} />
                    <span>{studentProfile.gradeName || '适配年级'} · {subjectLabel(primaryPack.subject)}</span>
                  </div>
                  <h3 className="mb-2 text-title-1 text-neutral-900">{primaryPack.name}</h3>
                  <p className="mb-4 text-subhead text-neutral-500">{primaryPack.description || '从当前进度继续，保持学习节奏。'}</p>
                  {completion ? (
                    <div>
                      <div className="mb-2 flex items-center justify-between text-caption-1 text-neutral-500">
                        <span>{completion.done}/{completion.total} 题</span>
                        <span>{formatTime(primaryPack.estimatedTime || 15)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-neutral-100">
                        <div
                          className="h-full rounded-full bg-primary-600"
                          style={{ width: `${completion.percent}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-4 text-caption-1 text-neutral-500">
                      <span className="flex items-center gap-1"><Target size={14} />{primaryPack.questions?.length || primaryPack.questionCount || 0}题</span>
                      <span className="flex items-center gap-1"><Clock3 size={14} />{formatTime(primaryPack.estimatedTime || 15)}</span>
                    </div>
                  )}
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white">
                  <Play size={20} fill="currentColor" />
                </div>
              </div>
            </Card>
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="mb-6"
        >
          <h2 className="section-title mb-3">常用入口</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {quickActions.map((item) => {
              const Icon = item.icon
              return (
                <Card
                  key={item.title}
                  animate={false}
                  onClick={item.onClick}
                  aria-label={`快捷入口：${item.title}`}
                  className="min-h-[142px] bg-white"
                >
                  <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-full ${item.tone}`}>
                    <Icon size={21} />
                  </div>
                  <div className="text-title-3 text-neutral-900">{item.title}</div>
                  <div className="mt-1 text-caption-1 text-neutral-500">{item.desc}</div>
                </Card>
              )
            })}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="mb-6 rounded-card bg-neutral-900 p-5 text-white"
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-caption-1 text-white/60">学习节奏</div>
              <h2 className="mt-1 text-title-1">先完成推荐，再处理错题</h2>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              <ArrowRight size={19} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
            {['推荐练习', '即时批改', '错题回收'].map((step, index) => (
              <div key={step} className="rounded-card bg-white/10 px-2 py-3">
                <div className="text-title-2">{index + 1}</div>
                <div className="mt-1 text-caption-1 text-white/68">{step}</div>
              </div>
            ))}
          </div>
        </motion.section>

        <Button fullWidth onClick={() => hasUnfinished ? onContinuePractice(currentPractice) : onOpenPracticeCenter()}>
          {hasUnfinished ? '继续上次练习' : '查看今日题包'}
        </Button>
      </main>
    </div>
  )
}

export default HomePage
