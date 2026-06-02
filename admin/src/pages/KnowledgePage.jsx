import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Database, Layers3, Plus, Search, ShieldCheck, TrendingUp } from 'lucide-react'
import { apiGet, openAuthorizedResource } from '../utils/api'

const fallbackKnowledge = import.meta.env.PROD ? [] : [
  { id: 'kp-1', subject: '数学', stage: '小学', name: '乘法运算', chapter: '数与运算', gradeRange: '二年级-四年级', questionCount: 68, wrongRate: 18, status: 'active', roundAdvice: '每日口算+应用题各 1 题' },
  { id: 'kp-2', subject: '数学', stage: '小学', name: '质数与合数', chapter: '数的认识', gradeRange: '四年级-六年级', questionCount: 46, wrongRate: 26, status: 'active', roundAdvice: '概念辨析优先，搭配倍数题' },
]

const KnowledgePage = () => {
  const [items, setItems] = useState(import.meta.env.PROD ? [] : fallbackKnowledge)
  const [coverageReport, setCoverageReport] = useState(null)
  const [search, setSearch] = useState('')
  const [subject, setSubject] = useState('all')
  const [message, setMessage] = useState('')

  useEffect(() => {
    apiGet('/knowledge-points', fallbackKnowledge).then(nextItems => setItems(nextItems || []))
    apiGet('/question-bank-coverage', null).then(setCoverageReport)
  }, [])

  const filtered = items.filter(item => {
    if (search && !item.name.includes(search)) return false
    if (subject !== 'all' && item.subject !== subject) return false
    return true
  })

  const coverageById = new Map((coverageReport?.items || []).map(item => [item.id, item]))
  const enrichedItems = filtered.map(item => ({
    ...item,
    coverage: coverageById.get(item.id) || null,
  }))

  const subjectOptions = Array.from(new Set(items.map(item => item.subject).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
  const coverageStatusMeta = {
    leading: ['行业领先', 'badge-admin badge-success'],
    strong: ['覆盖扎实', 'badge-admin badge-info'],
    developing: ['继续补强', 'badge-admin badge-warning'],
    weak: ['重点补题', 'badge-admin badge-error'],
  }
  const handleOpenCoachPack = async (id) => {
    setMessage('')
    try {
      await openAuthorizedResource(`/knowledge-points/${encodeURIComponent(id)}/coach-pack.pdf`)
    } catch {
      setMessage('讲义导出失败，请确认管理员登录状态后再试。')
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-800">题库与知识点中心</h1>
          <p className="text-sm text-neutral-500 mt-1">维护学科知识点、题量覆盖和错误率</p>
        </div>
        <button className="btn-admin btn-admin-primary flex items-center gap-2">
          <Plus size={16} />
          新增知识点
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <Database className="text-primary-600 mb-3" size={22} />
          <div className="text-2xl font-semibold text-neutral-800">{items.length}</div>
          <div className="text-sm text-neutral-500 mt-1">知识点总数</div>
        </div>
        <div className="stat-card">
          <TrendingUp className="text-orange-600 mb-3" size={22} />
          <div className="text-2xl font-semibold text-neutral-800">
            {Math.round(items.reduce((sum, item) => sum + item.wrongRate, 0) / Math.max(items.length, 1))}%
          </div>
          <div className="text-sm text-neutral-500 mt-1">平均错误率</div>
        </div>
        <div className="stat-card">
          <Layers3 className="text-sky-600 mb-3" size={22} />
          <div className="text-2xl font-semibold text-neutral-800">{coverageReport?.summary?.averageCoverageScore || 0}</div>
          <div className="text-sm text-neutral-500 mt-1">平均覆盖分</div>
        </div>
        <div className="stat-card">
          <ShieldCheck className="text-green-600 mb-3" size={22} />
          <div className="text-2xl font-semibold text-neutral-800">{coverageReport?.summary?.leadingCount || 0}</div>
          <div className="text-sm text-neutral-500 mt-1">领先知识点</div>
        </div>
      </div>

      <div className="grid grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="stat-card">
          <div className="text-sm text-neutral-500 mb-2">覆盖运营建议</div>
          <div className="text-neutral-800">
            现在不仅看错误率，还看每个知识点是否同时具备教材同步、专项突破、试卷诊断，以及“识记 / 理解 / 应用 / 迁移 / 综合”的认知梯度。
          </div>
          <div className="mt-3 text-sm text-neutral-500">
            错误率高且覆盖分低的知识点，优先补专项和试卷；覆盖分高但错误率高的知识点，优先优化讲解与变式题。
          </div>
        </div>

        <div className="stat-card">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-orange-600">
            <AlertTriangle size={18} />
            当前补题提醒
          </div>
          <div className="space-y-2">
            {(coverageReport?.gaps || []).slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-lg bg-neutral-50 px-3 py-2">
                <div className="text-sm font-medium text-neutral-800">{item.name}</div>
                <div className="mt-1 text-xs text-neutral-500">{item.issues.join(' · ')}</div>
              </div>
            ))}
            {(!coverageReport?.gaps || coverageReport.gaps.length === 0) && (
              <div className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                当前知识点覆盖结构完整，可以继续做精品扩充。
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card">
          <div className="mb-3 text-sm font-medium text-neutral-800">高频错因专题</div>
          <div className="space-y-3">
            {enrichedItems
              .slice()
              .sort((a, b) => (b.wrongRate || 0) - (a.wrongRate || 0))
              .slice(0, 4)
              .map((item) => (
                <div key={item.id} className="rounded-lg bg-neutral-50 px-3 py-3">
                  <div className="text-sm font-medium text-neutral-800">{item.name}</div>
                  <div className="mt-1 text-xs text-neutral-500">{item.chapter} · 错误率 {item.wrongRate}%</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(item.commonMistakes || []).slice(0, 3).map((mistake) => (
                      <span key={mistake} className="rounded-full bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
                        {mistake}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="stat-card">
          <div className="mb-3 text-sm font-medium text-neutral-800">讲评与家长辅导脚本</div>
          <div className="space-y-3">
            {enrichedItems
              .slice()
              .sort((a, b) => (b.wrongRate || 0) - (a.wrongRate || 0))
              .slice(0, 3)
              .map((item) => (
                <div key={item.id} className="rounded-lg border border-neutral-200 bg-white px-3 py-3">
                  <div className="text-sm font-medium text-neutral-800">{item.name}</div>
                  <div className="mt-2 text-xs text-neutral-500">讲评重点</div>
                  <div className="mt-1 text-sm text-neutral-700">{item.teachingFocus || '-'}</div>
                  <div className="mt-2 text-xs text-neutral-500">家长辅导</div>
                  <div className="mt-1 text-sm text-neutral-700">{item.parentCoach || '-'}</div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="stat-card">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="input-admin pl-10 w-full" placeholder="搜索知识点..." />
          </div>
          <select value={subject} onChange={(event) => setSubject(event.target.value)} className="input-admin">
            <option value="all">全部学科</option>
            {subjectOptions.map(item => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="data-table">
        {message && (
          <div className="border-b border-orange-100 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
            {message}
          </div>
        )}
        <table className="w-full">
          <thead>
            <tr>
              <th>知识点</th>
              <th>学科</th>
              <th>章节</th>
              <th>学段</th>
              <th>年级范围</th>
              <th>题量</th>
              <th>覆盖分</th>
              <th>训练覆盖</th>
              <th>难度梯度</th>
              <th>认知层级</th>
              <th>错误率</th>
              <th>组卷建议</th>
              <th>讲评重点</th>
              <th>状态</th>
              <th>讲义</th>
            </tr>
          </thead>
          <tbody>
            {enrichedItems.map(item => (
              <tr key={item.id} className="hover:bg-neutral-50">
                <td className="font-medium text-neutral-800">{item.name}</td>
                <td className="text-neutral-600">{item.subject}</td>
                <td className="text-neutral-600">{item.chapter || '-'}</td>
                <td className="text-neutral-600">{item.stage}</td>
                <td className="text-neutral-600">{item.gradeRange}</td>
                <td className="text-neutral-600">{item.questionCount}题</td>
                <td className="text-neutral-600">{item.coverage?.coverageScore ?? '-'}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {item.coverage ? [
                      ['教材', item.coverage.seriesCoverage?.textbook],
                      ['专项', item.coverage.seriesCoverage?.special],
                      ['试卷', item.coverage.seriesCoverage?.paper],
                    ].map(([label, count]) => (
                      <span key={label} className={`rounded-full px-2 py-0.5 text-xs font-medium ${count > 0 ? 'bg-primary-50 text-primary-700' : 'bg-neutral-100 text-neutral-400'}`}>
                        {label}{count > 0 ? ` ${count}` : ' 0'}
                      </span>
                    )) : <span className="text-neutral-400">-</span>}
                  </div>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {item.coverage ? Object.keys(item.coverage.difficultyTiers || {}).map((label) => (
                      <span key={label} className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                        {label}
                      </span>
                    )) : <span className="text-neutral-400">-</span>}
                  </div>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {item.coverage ? Object.keys(item.coverage.cognitiveLevels || {}).map((label) => (
                      <span key={label} className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                        {label}
                      </span>
                    )) : <span className="text-neutral-400">-</span>}
                  </div>
                </td>
                <td>
                  <span className={item.wrongRate >= 25 ? 'badge-admin badge-warning' : 'badge-admin badge-success'}>
                    {item.wrongRate}%
                  </span>
                </td>
                <td className="max-w-xs text-neutral-600">{item.roundAdvice || '-'}</td>
                <td className="max-w-xs text-neutral-600">{item.teachingFocus || '-'}</td>
                <td>
                  {item.coverage ? (
                    <span className={coverageStatusMeta[item.coverage.status]?.[1] || 'badge-admin badge-info'}>
                      {coverageStatusMeta[item.coverage.status]?.[0] || '已启用'}
                    </span>
                  ) : (
                    <span className="badge-admin badge-success">启用</span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => handleOpenCoachPack(item.id)}
                    className="inline-flex rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
                  >
                    导出讲义
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}

export default KnowledgePage
