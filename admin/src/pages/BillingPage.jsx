import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, DollarSign, TrendingUp, Users, Clock, Download, Eye, Search, Filter, RefreshCw, AlertCircle, Coins } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { apiGet } from '../utils/api'

// Demo data is only enabled for local development fallback.
const demoRevenueData = import.meta.env.PROD ? [] : [
  { date: '01/01', revenue: 5600 },
  { date: '01/02', revenue: 7200 },
  { date: '01/03', revenue: 8500 },
  { date: '01/04', revenue: 6800 },
  { date: '01/05', revenue: 9200 },
  { date: '01/06', revenue: 10500 },
  { date: '01/07', revenue: 8560 },
]

const mockOrders = import.meta.env.PROD ? [] : [
  { id: 'ORD001', user: '小明', plan: '季会员', amount: 79, status: 'paid', paymentStatus: 'paid', paymentMethod: '微信支付', provider: 'wechat_pay', transactionId: 'WX202604271030001', createdAt: '2026-04-27 10:30', expireDate: '2026-07-26' },
  { id: 'ORD002', user: '小红', plan: '月会员', amount: 29, status: 'paid', paymentStatus: 'paid', paymentMethod: '支付宝', provider: 'alipay', transactionId: 'ALI202604261520001', createdAt: '2026-04-26 15:20', expireDate: '2026-05-26' },
  { id: 'ORD003', user: '小华', plan: '年会员', amount: 199, status: 'pending', paymentStatus: 'pending', paymentMethod: '-', provider: null, transactionId: null, createdAt: '2026-04-25 09:45', expireDate: '-' },
  { id: 'ORD004', user: '小丽', plan: '季会员', amount: 79, status: 'refunded', paymentStatus: 'refunded', paymentMethod: '微信支付', provider: 'wechat_pay', transactionId: 'WX202604241430001', createdAt: '2026-04-24 14:30', expireDate: '-' },
]

const membershipPlans = import.meta.env.PROD ? [] : [
  { id: 'monthly', name: '月会员', price: 29, originalPrice: 39, activeUsers: 450, renewalRate: '45%' },
  { id: 'quarterly', name: '季会员', price: 79, originalPrice: 117, activeUsers: 680, renewalRate: '68%' },
  { id: 'yearly', name: '年会员', price: 199, originalPrice: 468, activeUsers: 150, renewalRate: '82%' },
]

const fallbackPointPackages = import.meta.env.PROD ? [] : [
  { id: 'points-100', name: '体验积分包', points: 100, bonusPoints: 0, price: 9.9, status: 'active' },
  { id: 'points-360', name: '常用积分包', points: 300, bonusPoints: 60, price: 29.9, status: 'active' },
  { id: 'points-1000', name: '高频积分包', points: 880, bonusPoints: 120, price: 69.9, status: 'active' },
]

const currency = (value) => `¥${Number(value || 0).toLocaleString('zh-CN')}`

const parseOrderDate = (value) => {
  const parsed = new Date(String(value || '').replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const isSameDate = (left, right) => (
  left && right &&
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate()
)

const isWithinDays = (date, days) => {
  if (!date) return false
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000
}

const buildRevenueData = (orders) => {
  const now = new Date()
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now)
    day.setDate(now.getDate() - (6 - index))
    const revenue = orders
      .filter(order => order.status === 'paid' && isSameDate(parseOrderDate(order.paidAt || order.createdAt), day))
      .reduce((sum, order) => sum + Number(order.amount || 0), 0)
    return {
      date: `${String(day.getMonth() + 1).padStart(2, '0')}/${String(day.getDate()).padStart(2, '0')}`,
      revenue,
    }
  })
}

const BillingPage = () => {
  const [activeTab, setActiveTab] = useState('orders') // 'orders' | 'plans' | 'stats'
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [orders, setOrders] = useState(import.meta.env.PROD ? [] : mockOrders)
  const [plans, setPlans] = useState(import.meta.env.PROD ? [] : membershipPlans)
  const [payments, setPayments] = useState([])
  const [pointPackages, setPointPackages] = useState(import.meta.env.PROD ? [] : fallbackPointPackages)
  const [pointTransactions, setPointTransactions] = useState([])

  useEffect(() => {
    apiGet('/orders', mockOrders).then(items => setOrders(items || []))
    apiGet('/membership-plans', membershipPlans).then(items => setPlans(items || []))
    apiGet('/payments', []).then(items => setPayments(items || []))
    apiGet('/point-packages', fallbackPointPackages).then(items => setPointPackages(items || []))
    apiGet('/point-transactions', []).then(items => setPointTransactions(items || []))
  }, [])
  
  const filteredOrders = orders.filter(order => {
    if (searchTerm && !order.id.includes(searchTerm) && !order.user.includes(searchTerm)) return false
    if (selectedStatus !== 'all' && order.status !== selectedStatus) return false
    return true
  })
  
  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return <span className="badge-admin badge-success">已支付</span>
      case 'pending':
        return <span className="badge-admin badge-warning">待支付</span>
      case 'refunded':
        return <span className="badge-admin badge-error">已退款</span>
      default:
        return <span className="badge-admin badge-info">{status}</span>
    }
  }
  
  const paidOrders = orders.filter(order => order.status === 'paid' || order.paymentStatus === 'paid')
  const today = new Date()
  const todayRevenue = paidOrders
    .filter(order => isSameDate(parseOrderDate(order.paidAt || order.createdAt), today))
    .reduce((sum, order) => sum + Number(order.amount || 0), 0)
  const weeklyRevenue = paidOrders
    .filter(order => isWithinDays(parseOrderDate(order.paidAt || order.createdAt), 7))
    .reduce((sum, order) => sum + Number(order.amount || 0), 0)
  const monthlyRevenue = paidOrders
    .filter(order => isWithinDays(parseOrderDate(order.paidAt || order.createdAt), 30))
    .reduce((sum, order) => sum + Number(order.amount || 0), 0)
  const paidUserCount = new Set(paidOrders.map(order => order.userId || order.user).filter(Boolean)).size
  const pendingOrderCount = orders.filter(order => order.status === 'pending' || order.paymentStatus === 'pending').length
  const refundedOrderCount = orders.filter(order => order.status === 'refunded' || order.paymentStatus === 'refunded').length
  const expiringSoonCount = paidOrders.filter((order) => {
    const expireDate = parseOrderDate(order.expireDate)
    if (!expireDate) return false
    const diff = expireDate.getTime() - Date.now()
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000
  }).length
  const revenueData = orders.length ? buildRevenueData(orders) : demoRevenueData

  const stats = [
    { label: '今日收入', value: currency(todayRevenue), icon: DollarSign, color: 'green' },
    { label: '近7日收入', value: currency(weeklyRevenue), icon: TrendingUp, color: 'primary' },
    { label: '近30日收入', value: currency(monthlyRevenue), icon: CreditCard, color: 'purple' },
    { label: '付费用户', value: paidUserCount, icon: Users, color: 'orange' },
    { label: '积分流水', value: pointTransactions.length, icon: Coins, color: 'orange' },
  ]
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-800">收费与订单中心</h1>
          <p className="text-sm text-neutral-500 mt-1">管理会员套餐和订单</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-admin btn-admin-secondary flex items-center gap-2">
            <Download size={16} />
            导出报表
          </button>
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          const colorClasses = {
            green: 'bg-green-100 text-green-600',
            primary: 'bg-primary-100 text-primary-600',
            purple: 'bg-purple-100 text-purple-600',
            orange: 'bg-orange-100 text-orange-600',
          }
          
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="stat-card"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[stat.color]}`}>
                  <Icon size={20} />
                </div>
              </div>
              <div className="text-2xl font-semibold text-neutral-800">{stat.value}</div>
              <div className="text-sm text-neutral-500 mt-1">{stat.label}</div>
            </motion.div>
          )
        })}
      </div>
      
      {/* Tabs */}
      <div className="flex gap-4 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'orders'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          订单管理
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'plans'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          套餐管理
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'stats'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          收入统计
        </button>
        <button
          onClick={() => setActiveTab('points')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'points'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          积分模式
        </button>
      </div>
      
      {/* Content */}
      {activeTab === 'orders' && (
        <>
          {/* Filters */}
          <div className="stat-card">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="搜索订单号或用户..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-admin pl-10 w-full"
                />
              </div>
              
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="input-admin"
              >
                <option value="all">全部状态</option>
                <option value="paid">已支付</option>
                <option value="pending">待支付</option>
                <option value="refunded">已退款</option>
              </select>
            </div>
          </div>
          
          {/* Orders Table */}
          <div className="data-table">
            <table className="w-full">
              <thead>
                <tr>
                  <th>订单号</th>
                  <th>用户</th>
                  <th>套餐</th>
                  <th>金额</th>
                  <th>支付方式</th>
                  <th>交易号</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th>到期时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-neutral-50"
                  >
                    <td className="font-medium text-neutral-800">{order.id}</td>
                    <td className="text-neutral-600">{order.user}</td>
                    <td className="text-neutral-600">{order.plan}</td>
                    <td className="text-primary-600 font-medium">¥{order.amount}</td>
                    <td className="text-neutral-600">{order.paymentMethod}</td>
                    <td className="max-w-[150px] truncate text-neutral-500">{order.transactionId || '-'}</td>
                    <td>{getStatusBadge(order.status)}</td>
                    <td className="text-neutral-500">{order.createdAt}</td>
                    <td className="text-neutral-500">{order.expireDate}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500">
                          <Eye size={16} />
                        </button>
                        {order.status === 'paid' && (
                          <button className="p-2 rounded-lg hover:bg-neutral-100 text-red-500">
                            <RefreshCw size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      
      {activeTab === 'plans' && (
        <div className="grid grid-cols-3 gap-4">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-neutral-800">{plan.name}</h3>
                <button className="btn-admin btn-admin-secondary text-sm">编辑</button>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                  <span className="text-sm text-neutral-600">当前价格</span>
                  <span className="text-lg font-semibold text-primary-600">¥{plan.price}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                  <span className="text-sm text-neutral-600">原价</span>
                  <span className="text-neutral-500">¥{plan.originalPrice}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                  <span className="text-sm text-neutral-600">活跃用户</span>
                  <span className="text-neutral-800">{plan.activeUsers}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-primary-50 rounded-lg">
                  <span className="text-sm text-neutral-600">续费率</span>
                  <span className="text-lg font-semibold text-primary-600">{String(plan.renewalRate).replace('%', '')}%</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      
      {activeTab === 'stats' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="stat-card"
          >
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">收入趋势</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="date" stroke="#737373" fontSize={12} />
                <YAxis stroke="#737373" fontSize={12} />
                <Tooltip formatter={(value) => `¥${value}`} />
                <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
          
          {/* Renewal Alerts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="stat-card"
          >
            <h3 className="text-lg font-semibold text-neutral-800 mb-4 flex items-center gap-2">
              <AlertCircle size={20} className="text-orange-500" />
              续费提醒
            </h3>
            
            <div className="space-y-3">
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-orange-700">即将到期用户</span>
                  <span className="text-lg font-semibold text-orange-600">{expiringSoonCount}</span>
                </div>
                <p className="text-xs text-orange-600">7天内会员即将到期</p>
              </div>
              
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-red-700">已退款订单</span>
                  <span className="text-lg font-semibold text-red-600">{refundedOrderCount}</span>
                </div>
                <p className="text-xs text-red-600">需要客服确认售后原因</p>
              </div>
              
              <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-primary-700">待支付订单</span>
                  <span className="text-lg font-semibold text-primary-600">{pendingOrderCount}</span>
                </div>
                <p className="text-xs text-primary-600">支付延期版本下应保持不可支付</p>
              </div>
            </div>
            
            <button disabled className="btn-admin btn-admin-secondary w-full mt-4 opacity-60">
              正式支付恢复后开启提醒
            </button>
          </motion.div>
        </div>
      )}

      {activeTab === 'points' && (
        <div className="grid grid-cols-[360px_1fr] gap-6">
          <section className="stat-card">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4 flex items-center gap-2">
              <Coins size={20} className="text-amber-500" />
              积分包
            </h3>
            <div className="space-y-3">
              {pointPackages.map(pack => {
                const total = Number(pack.points || 0) + Number(pack.bonusPoints || 0)
                return (
                  <div key={pack.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="font-medium text-neutral-800">{pack.name}</div>
                      <span className="badge-admin badge-success">{pack.status === 'active' ? '上架' : '停用'}</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-semibold text-amber-600">{total}</div>
                        <div className="text-xs text-neutral-500">可到账积分</div>
                      </div>
                      <div className="text-lg font-semibold text-primary-600">¥{pack.price}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="data-table">
            <table className="w-full">
              <thead>
                <tr>
                  <th>流水号</th>
                  <th>用户</th>
                  <th>类型</th>
                  <th>动作</th>
                  <th>积分</th>
                  <th>余额</th>
                  <th>说明</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {pointTransactions.map(item => (
                  <tr key={item.id} className="hover:bg-neutral-50">
                    <td className="font-medium text-neutral-800">{item.id}</td>
                    <td className="text-neutral-600">{item.user}</td>
                    <td>{item.type === 'credit' ? <span className="badge-admin badge-success">收入</span> : <span className="badge-admin badge-warning">支出</span>}</td>
                    <td className="text-neutral-600">{item.action}</td>
                    <td className={item.type === 'credit' ? 'font-medium text-green-600' : 'font-medium text-amber-600'}>
                      {item.type === 'credit' ? '+' : '-'}{item.points}
                    </td>
                    <td className="text-neutral-600">{item.balanceAfter}</td>
                    <td className="text-neutral-500">{item.note}</td>
                    <td className="text-neutral-500">{item.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {activeTab === 'orders' && payments.length > 0 && (
        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>支付单号</th>
                <th>订单号</th>
                <th>渠道</th>
                <th>金额</th>
                <th>支付状态</th>
                <th>创建时间</th>
                <th>支付时间</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(payment => (
                <tr key={payment.id} className="hover:bg-neutral-50">
                  <td className="font-medium text-neutral-800">{payment.id}</td>
                  <td className="text-neutral-600">{payment.orderId}</td>
                  <td className="text-neutral-600">{payment.channel}</td>
                  <td className="font-medium text-primary-600">¥{payment.amount}</td>
                  <td>{getStatusBadge(payment.status)}</td>
                  <td className="text-neutral-500">{payment.createdAt}</td>
                  <td className="text-neutral-500">{payment.paidAt || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  )
}

export default BillingPage
