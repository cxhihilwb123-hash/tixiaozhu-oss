import React, { Suspense, lazy, useEffect, useState } from 'react'
import AdminLayout from './components/AdminLayout'
import LoginPage from './pages/LoginPage'
import { apiGet, clearAdminToken, getAdminToken, setAdminToken } from './utils/api'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const QuestionsPage = lazy(() => import('./pages/QuestionsPage'))
const AIPage = lazy(() => import('./pages/AIPage'))
const BillingPage = lazy(() => import('./pages/BillingPage'))
const KnowledgePage = lazy(() => import('./pages/KnowledgePage'))
const RecordsPage = lazy(() => import('./pages/RecordsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function App() {
  const [activeMenu, setActiveMenu] = useState('dashboard')
  const [adminProfile, setAdminProfile] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    if (!getAdminToken()) {
      setCheckingSession(false)
      return undefined
    }
    let alive = true
    apiGet('/admin/auth/session', null).then((profile) => {
      if (!alive) return
      setAdminProfile(profile || null)
      setCheckingSession(false)
    })
    return () => {
      alive = false
    }
  }, [])

  const handleLoginSuccess = ({ token, profile }) => {
    setAdminToken(token)
    setAdminProfile(profile)
  }

  const handleLogout = () => {
    clearAdminToken()
    setAdminProfile(null)
    setActiveMenu('dashboard')
  }
  
  const renderPage = () => {
    switch (activeMenu) {
      case 'dashboard':
        return <DashboardPage />
      case 'users':
        return <UsersPage />
      case 'questions':
        return <QuestionsPage />
      case 'ai':
        return <AIPage />
      case 'knowledge':
        return <KnowledgePage />
      case 'records':
        return <RecordsPage />
      case 'billing':
        return <BillingPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <DashboardPage />
    }
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100">
        <div className="rounded-2xl bg-white px-6 py-5 text-sm text-neutral-500 shadow-sm">
          正在校验管理员会话...
        </div>
      </div>
    )
  }

  if (!adminProfile) {
    return <LoginPage onSuccess={handleLoginSuccess} />
  }
  
  return (
    <AdminLayout
      activeMenu={activeMenu}
      onMenuChange={setActiveMenu}
      adminProfile={adminProfile}
      onLogout={handleLogout}
    >
      <Suspense fallback={(
        <div className="rounded-card bg-white p-5 text-sm text-neutral-500 shadow-sm">
          正在加载运营页面...
        </div>
      )}>
        {renderPage()}
      </Suspense>
    </AdminLayout>
  )
}

export default App
