import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, BookOpen, CreditCard, TrendingUp, AlertCircle, Sparkles, Target, ShieldCheck } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { apiGet } from '../utils/api'

const COLORS = ['#0ea5e9', '#22c55e', '#f97316']

const DashboardPage = () => {
  const [summary, setSummary] = useState(null)
  const [productReadiness, setProductReadiness] = useState(null)

  useEffect(() => {
    apiGet('/dashboard', null).then(setSummary)
    apiGet('/product-readiness', null).then(setProductReadiness)
  }, [])

  const readinessMap = {
    ready: {
      label: '正式基线已就绪',
      badge: 'badge-admin badge-success',
      panel: 'border-emerald-200 bg-emerald-50/70',
      text: 'text-emerald-700',
    },
    watch: {
      label: '正式基线需关注',
      badge: 'badge-admin badge-warning',
      panel: 'border-amber-200 bg-amber-50/80',
      text: 'text-amber-700',
    },
    needs_fix: {
      label: '正式基线需修复',
      badge: 'badge-admin badge-error',
      panel: 'border-rose-200 bg-rose-50/80',
      text: 'text-rose-700',
    },
  }

  const readinessUi = readinessMap[productReadiness?.readiness] || readinessMap.watch
  const gradeCoverage = Object.entries(productReadiness?.summary?.gradeCoverage || {})
  const subjectCoverage = Object.entries(productReadiness?.summary?.subjectCoverage || {})
  const subjectScoreData = (summary?.subjectScores || []).map(item => ({
    date: item.subject,
    users: Number(item.total || 0),
  }))
  const userMixData = [
    { name: '付费用户', value: Number(summary?.paidUsers || 0) },
    { name: '积分用户', value: Number(summary?.pointUsers || 0) },
    { name: '其他用户', value: Math.max(0, Number(summary?.totalUsers || 0) - Number(summary?.paidUsers || 0)) },
  ].filter(item => item.value > 0)

  const stats = [
    { label: '总用户数', value: summary?.totalUsers ?? 0, icon: Users, color: 'primary' },
    { label: '近7日活跃', value: summary?.activeUsers ?? 0, icon: TrendingUp, color: 'green' },
    { label: '积分用户', value: summary?.pointUsers ?? 0, icon: Target, color: 'purple' },
    { label: '今日练习', value: summary?.todayPractice ?? 0, icon: BookOpen, color: 'orange' },
    { label: '错题数量', value: summary?.wrongQuestions ?? 0, icon: AlertCircle, color: 'red' },
    { label: '付费用户', value: summary?.paidUsers ?? 0, icon: CreditCard, color: 'primary' },
    { label: '今日收入', value: `¥${summary?.todayRevenue ?? 0}`, icon: CreditCard, color: 'green' },
    { label: '题库题量', value: summary?.generatedQuestions ?? 0, icon: Sparkles, color: 'purple' },
  ]
  
  const hotPacks = summary?.hotPacks?.map(pack => ({
    name: pack.name,
    users: pack.usageCount,
    completion: `${pack.completionRate}%`,
  })) || []
  
  const errorPoints = summary?.errorPoints?.map(item => ({
    name: item.name,
    count: item.wrongRate,
  })) || []
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-semibold text-neutral-800">仪表盘中心</h1>
        <p className="text-sm text-neutral-500 mt-1">查看平台运营数据概览</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`stat-card border ${readinessUi.panel}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-neutral-700 shadow-sm">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-neutral-800">正式产品基线</h3>
                <span className={readinessUi.badge}>{readinessUi.label}</span>
              </div>
              <p className="mt-1 text-sm text-neutral-600">
                这张卡检查种子业务数据是否和当前“小学主科正式产品”定位一致，避免后台、积分、商城、推荐继续混入旧演示样本。
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-white/80 px-4 py-3 text-right shadow-sm">
            <div className="text-xs text-neutral-500">当前问题数</div>
            <div className={`text-2xl font-semibold ${readinessUi.text}`}>{productReadiness?.issues?.length ?? 0}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-3">
          {[
            ['小学主科用户', `${productReadiness?.summary?.primaryUsers ?? 0}/${productReadiness?.summary?.users ?? 0}`],
            ['学习记录', productReadiness?.summary?.learningRecords ?? 0],
            ['内容购买', productReadiness?.summary?.contentPurchases ?? 0],
            ['AI出题任务', productReadiness?.summary?.aiGenerationJobs ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white/80 px-4 py-3 shadow-sm">
              <div className="text-xs text-neutral-500">{label}</div>
              <div className="mt-1 text-xl font-semibold text-neutral-800">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
            <div className="text-sm font-semibold text-neutral-800">年级覆盖</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {gradeCoverage.length > 0 ? gradeCoverage.map(([grade, count]) => (
                <span key={grade} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                  {grade} {count}人
                </span>
              )) : (
                <span className="text-sm text-neutral-500">暂无数据</span>
              )}
            </div>
          </div>
          <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
            <div className="text-sm font-semibold text-neutral-800">学科覆盖</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {subjectCoverage.length > 0 ? subjectCoverage.map(([subject, count]) => (
                <span key={subject} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                  {subject} {count}人
                </span>
              )) : (
                <span className="text-sm text-neutral-500">暂无数据</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-white/80 p-4 shadow-sm">
          <div className="text-sm font-semibold text-neutral-800">当前检查结果</div>
          <div className="mt-3 space-y-2">
            {(productReadiness?.issues?.length ? productReadiness.issues : [{
              title: '当前没有发现跨学段、脏关联或失效购买记录',
              action: '可以继续把精力放在题库扩容、支付接入和真实数据持久化上。',
              count: 0,
            }]).slice(0, 4).map((issue) => (
              <div key={issue.title} className="flex items-start justify-between gap-3 rounded-2xl bg-neutral-50 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-neutral-800">{issue.title}</div>
                  <div className="mt-1 text-xs text-neutral-500">{issue.action}</div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-neutral-500">{issue.count}项</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          const colorClasses = {
            primary: 'bg-primary-100 text-primary-600',
            green: 'bg-green-100 text-green-600',
            purple: 'bg-purple-100 text-purple-600',
            orange: 'bg-orange-100 text-orange-600',
            red: 'bg-red-100 text-red-600',
          }
          
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[stat.color]}`}>
                  <Icon size={20} />
                </div>
                <span className="text-sm font-medium text-neutral-400">实时</span>
              </div>
              <div className="text-2xl font-semibold text-neutral-800">{stat.value}</div>
              <div className="text-sm text-neutral-500 mt-1">{stat.label}</div>
            </motion.div>
          )
        })}
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* User Growth Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="stat-card"
        >
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">学科练习题量</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={subjectScoreData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="date" stroke="#737373" fontSize={12} />
              <YAxis stroke="#737373" fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="users" stroke="#0ea5e9" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
        
        {/* Revenue Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="stat-card"
        >
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">用户构成</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={userMixData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
              >
                {userMixData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {userMixData.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                <span className="text-xs text-neutral-600">{item.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
        
        {/* Error Points */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="stat-card"
        >
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">高频错误知识点</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={errorPoints} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis type="number" stroke="#737373" fontSize={12} />
              <YAxis dataKey="name" type="category" stroke="#737373" fontSize={12} width={80} />
              <Tooltip />
              <Bar dataKey="count" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
      
      {/* Tables Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Hot Packs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="stat-card"
        >
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">热门题包</h3>
          <div className="data-table">
            <table className="w-full">
              <thead>
                <tr>
                  <th>题包名称</th>
                  <th>使用人数</th>
                  <th>完成率</th>
                </tr>
              </thead>
              <tbody>
                {hotPacks.length > 0 ? hotPacks.map((pack) => (
                  <tr key={pack.name}>
                    <td className="text-sm text-neutral-800">{pack.name}</td>
                    <td className="text-sm text-neutral-600">{pack.users}</td>
                    <td>
                      <span className="badge-admin badge-success">{pack.completion}</span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-sm text-neutral-400">暂无真实题包使用数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
        
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="stat-card"
        >
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">积分与付费概览</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
              <span className="text-sm text-neutral-600">积分用户</span>
              <span className="text-lg font-semibold text-primary-600">{summary?.pointUsers ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
              <span className="text-sm text-neutral-600">累计发放积分</span>
              <span className="text-lg font-semibold text-green-600">{summary?.pointsIssued ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
              <span className="text-sm text-neutral-600">累计消耗积分</span>
              <span className="text-lg font-semibold text-orange-600">{summary?.pointsSpent ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-primary-50 rounded-lg">
              <span className="text-sm text-neutral-600">付费转化率</span>
              <span className="text-lg font-semibold text-primary-600">
                {summary?.totalUsers ? `${Math.round((Number(summary.paidUsers || 0) / Number(summary.totalUsers || 1)) * 100)}%` : '0%'}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default DashboardPage
