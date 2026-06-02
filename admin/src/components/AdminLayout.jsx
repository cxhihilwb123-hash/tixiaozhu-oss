import React from 'react'
import { motion } from 'framer-motion'
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Sparkles, 
  Database, 
  History, 
  CreditCard, 
  Settings, 
  ChevronLeft,
  Bell,
  Search,
  LogOut
} from 'lucide-react'

const menuItems = [
  { id: 'dashboard', label: '仪表盘中心', icon: LayoutDashboard },
  { id: 'users', label: '用户与档案', icon: Users },
  { id: 'questions', label: '习题内容', icon: BookOpen },
  { id: 'ai', label: 'AI出题中心', icon: Sparkles },
  { id: 'knowledge', label: '题库与知识点', icon: Database },
  { id: 'records', label: '学习记录与错题', icon: History },
  { id: 'billing', label: '收费与积分', icon: CreditCard },
  { id: 'settings', label: '系统与权限', icon: Settings },
]

const AdminLayout = ({ children, activeMenu, onMenuChange, adminProfile, onLogout }) => {
  const [collapsed, setCollapsed] = React.useState(false)
  
  return (
    <div className="flex min-h-screen flex-col bg-neutral-100 lg:flex-row">
      {/* Sidebar */}
      <motion.div
        className={`sidebar flex w-full shrink-0 flex-col lg:sticky lg:top-0 lg:h-screen ${collapsed ? 'lg:w-16' : 'lg:w-60'}`}
        initial={false}
        transition={{ duration: 0.2 }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-4">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">题</span>
              </div>
              <span className="font-semibold text-neutral-800">题小助</span>
            </motion.div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            aria-label="折叠侧边栏"
          >
            <ChevronLeft size={20} className={`text-neutral-500 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
        
        {/* Menu */}
        <nav className="flex gap-2 overflow-x-auto px-3 py-3 lg:block lg:flex-1 lg:overflow-y-auto lg:py-4">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeMenu === item.id
            
            return (
              <button
                key={item.id}
                onClick={() => onMenuChange(item.id)}
                className={`sidebar-item mb-0 flex shrink-0 items-center gap-2 lg:mb-1 lg:w-full lg:gap-3 ${
                  isActive ? 'active' : ''
                }`}
              >
                <Icon size={20} />
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="whitespace-nowrap text-sm"
                  >
                    {item.label}
                  </motion.span>
                )}
              </button>
            )
          })}
        </nav>
        
        {/* User */}
        <div className="hidden border-t border-neutral-200 p-3 lg:block">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-primary-600 font-medium text-sm">管</span>
            </div>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1"
              >
                <div className="text-sm font-medium text-neutral-800">{adminProfile?.displayName || '管理员'}</div>
                <div className="text-xs text-neutral-500">{adminProfile?.role === 'super_admin' ? '超级管理员' : '运营账号'}</div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
      
      {/* Main Content */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-4 py-3 lg:px-6 lg:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="搜索..."
                className="input-admin w-full pl-10 lg:w-[300px]"
                />
              </div>
            </div>
            
            <div className="flex shrink-0 items-center gap-2 lg:gap-4">
              <button className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
                <Bell size={20} className="text-neutral-500" />
              </button>
              <button onClick={onLogout} className="btn-admin btn-admin-secondary flex items-center gap-2">
                <LogOut size={16} />
                <span>退出</span>
              </button>
            </div>
          </div>
        </header>
        
        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6" aria-label="后台主内容" data-testid="admin-main-content">
          {children}
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
