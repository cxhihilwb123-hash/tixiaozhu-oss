import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, Plus, Eye, Edit, Trash2, MoreVertical, UserPlus, Download, Coins } from 'lucide-react'
import { apiGet, apiPost } from '../utils/api'

// Mock user data
const mockUsers = import.meta.env.PROD ? [] : [
  { id: 1, nickname: '小明', grade: '四年级', subject: '数学', memberStatus: 'active', memberPlan: '季会员', expireDate: '2024-03-15', totalQuestions: 156, accuracy: '85%', lastActive: '2024-01-15', pointsBalance: 238, avatar: null },
  { id: 2, nickname: '小红', grade: '初一', subject: '语文', memberStatus: 'expired', memberPlan: '月会员', expireDate: '2024-01-01', totalQuestions: 89, accuracy: '72%', lastActive: '2024-01-10', pointsBalance: 42, avatar: null },
  { id: 3, nickname: '小华', grade: '初三', subject: '物理', memberStatus: 'trial', memberPlan: null, expireDate: null, totalQuestions: 45, accuracy: '68%', lastActive: '2024-01-14', pointsBalance: 18, avatar: null },
  { id: 4, nickname: '小丽', grade: '五年级', subject: '英语', memberStatus: 'active', memberPlan: '年会员', expireDate: '2024-12-20', totalQuestions: 234, accuracy: '91%', lastActive: '2024-01-15', pointsBalance: 516, avatar: null },
  { id: 5, nickname: '小刚', grade: '高二', subject: '化学', memberStatus: 'none', memberPlan: null, expireDate: null, totalQuestions: 12, accuracy: '55%', lastActive: '2024-01-08', pointsBalance: 8, avatar: null },
]

const UsersPage = () => {
  const [users, setUsers] = useState(import.meta.env.PROD ? [] : mockUsers)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGrade, setSelectedGrade] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  
  useEffect(() => {
    apiGet('/users', mockUsers).then(items => setUsers(items || []))
  }, [])

  const filteredUsers = users.filter(user => {
    if (searchTerm && !user.nickname.includes(searchTerm)) return false
    if (selectedGrade !== 'all' && user.grade !== selectedGrade) return false
    if (selectedStatus !== 'all' && user.memberStatus !== selectedStatus) return false
    return true
  })
  
  const handleViewDetail = (user) => {
    setSelectedUser(user)
    setShowDetailModal(true)
  }

  const handleAdjustPoints = async (user, type, points) => {
    const result = await apiPost('/admin/points/adjust', {
      user: user.nickname,
      type,
      points,
      note: type === 'credit' ? '后台补发积分' : '后台扣减积分',
    }, null)
    if (!result?.account) return
    const nextBalance = result.account.balance
    setUsers(current => current.map(item => (
      item.id === user.id ? { ...item, pointsBalance: nextBalance } : item
    )))
    setSelectedUser(current => current ? { ...current, pointsBalance: nextBalance } : current)
  }
  
  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="badge-admin badge-success">会员有效</span>
      case 'expired':
        return <span className="badge-admin badge-error">已过期</span>
      case 'trial':
        return <span className="badge-admin badge-warning">试用中</span>
      default:
        return <span className="badge-admin badge-info">未开通</span>
    }
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-800">用户与档案中心</h1>
          <p className="text-sm text-neutral-500 mt-1">管理用户账号和学生档案</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-admin btn-admin-secondary flex items-center gap-2">
            <Download size={16} />
            导出数据
          </button>
          <button className="btn-admin btn-admin-primary flex items-center gap-2">
            <UserPlus size={16} />
            添加用户
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="stat-card">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="搜索用户昵称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-admin pl-10 w-full"
            />
          </div>
          
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="input-admin"
          >
            <option value="all">全部年级</option>
            <option value="四年级">四年级</option>
            <option value="初一">初一</option>
            <option value="初三">初三</option>
            <option value="五年级">五年级</option>
            <option value="高二">高二</option>
          </select>
          
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="input-admin"
          >
            <option value="all">全部状态</option>
            <option value="active">会员有效</option>
            <option value="expired">已过期</option>
            <option value="trial">试用中</option>
            <option value="none">未开通</option>
          </select>
        </div>
      </div>
      
      {/* Users Table */}
      <div className="data-table">
        <table className="w-full">
          <thead>
            <tr>
              <th>用户信息</th>
              <th>年级</th>
              <th>学科偏好</th>
              <th>会员状态</th>
              <th>积分余额</th>
              <th>做题统计</th>
              <th>最后活跃</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <motion.tr
                key={user.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hover:bg-neutral-50"
              >
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-600 font-medium">{user.nickname[0]}</span>
                    </div>
                    <div>
                      <div className="font-medium text-neutral-800">{user.nickname}</div>
                      <div className="text-xs text-neutral-500">ID: {user.id}</div>
                    </div>
                  </div>
                </td>
                <td className="text-neutral-600">{user.grade}</td>
                <td className="text-neutral-600">{user.subject}</td>
                <td>{getStatusBadge(user.memberStatus)}</td>
                <td>
                  <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
                    <Coins size={15} />
                    {user.pointsBalance || 0}
                  </div>
                </td>
                <td>
                  <div className="text-sm">
                    <div className="text-neutral-800">{user.totalQuestions}题</div>
                    <div className="text-neutral-500">正确率 {String(user.accuracy).replace('%', '')}%</div>
                  </div>
                </td>
                <td className="text-neutral-500">{user.lastActive}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewDetail(user)}
                      className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500"
                    >
                      <Eye size={16} />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500">
                      <Edit size={16} />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-500">
          共 {filteredUsers.length} 条记录
        </div>
        <div className="flex gap-2">
          <button className="btn-admin btn-admin-secondary">上一页</button>
          <button className="btn-admin btn-admin-primary">1</button>
          <button className="btn-admin btn-admin-secondary">2</button>
          <button className="btn-admin btn-admin-secondary">3</button>
          <button className="btn-admin btn-admin-secondary">下一页</button>
        </div>
      </div>
      
      {/* Detail Modal */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl w-[600px] max-h-[80vh] overflow-auto"
          >
            <div className="p-6 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-neutral-800">用户详情</h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 rounded-lg hover:bg-neutral-100"
                >
                  <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-2xl text-primary-600 font-medium">{selectedUser.nickname[0]}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-800">{selectedUser.nickname}</h3>
                  <p className="text-sm text-neutral-500">ID: {selectedUser.id}</p>
                </div>
                {getStatusBadge(selectedUser.memberStatus)}
              </div>
              
              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-neutral-50 rounded-lg">
                  <div className="text-sm text-neutral-500 mb-1">年级</div>
                  <div className="text-neutral-800 font-medium">{selectedUser.grade}</div>
                </div>
                <div className="p-4 bg-neutral-50 rounded-lg">
                  <div className="text-sm text-neutral-500 mb-1">学科偏好</div>
                  <div className="text-neutral-800 font-medium">{selectedUser.subject}</div>
                </div>
                <div className="p-4 bg-neutral-50 rounded-lg">
                  <div className="text-sm text-neutral-500 mb-1">会员套餐</div>
                  <div className="text-neutral-800 font-medium">{selectedUser.memberPlan || '未开通'}</div>
                </div>
                <div className="p-4 bg-neutral-50 rounded-lg">
                  <div className="text-sm text-neutral-500 mb-1">到期时间</div>
                  <div className="text-neutral-800 font-medium">{selectedUser.expireDate || '-'}</div>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg">
                  <div className="text-sm text-amber-700 mb-1">积分余额</div>
                  <div className="text-amber-800 font-semibold">{selectedUser.pointsBalance || 0} 积分</div>
                </div>
                <div className="p-4 bg-neutral-50 rounded-lg">
                  <div className="text-sm text-neutral-500 mb-1">累计做题</div>
                  <div className="text-neutral-800 font-medium">{selectedUser.totalQuestions}题</div>
                </div>
                <div className="p-4 bg-neutral-50 rounded-lg">
                  <div className="text-sm text-neutral-500 mb-1">正确率</div>
                  <div className="text-neutral-800 font-medium">{String(selectedUser.accuracy).replace('%', '')}%</div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3">
                <button className="btn-admin btn-admin-primary flex-1">编辑档案</button>
                <button onClick={() => handleAdjustPoints(selectedUser, 'credit', 50)} className="btn-admin btn-admin-secondary flex-1">补发50积分</button>
                <button onClick={() => handleAdjustPoints(selectedUser, 'debit', 10)} className="btn-admin btn-admin-secondary flex-1">扣减10积分</button>
                <button className="btn-admin btn-admin-secondary flex-1">查看订单</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}

export default UsersPage
