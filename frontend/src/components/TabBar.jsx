import React from 'react'
import { motion } from 'framer-motion'
import { Home, ScanLine, BookOpen, BookOpenCheck, UserRound } from 'lucide-react'

const TabBar = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'home', label: '首页', icon: Home },
    { id: 'practice', label: '练习', icon: BookOpen },
    { id: 'capture', label: '拍题', icon: ScanLine },
    { id: 'wrong', label: '错题', icon: BookOpenCheck },
    { id: 'profile', label: '我的', icon: UserRound },
  ]

  return (
    <nav className="tab-bar fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      <div className="mx-auto flex h-[68px] w-full max-w-[1180px] items-center justify-around px-2 sm:px-6 lg:h-[76px] lg:justify-center lg:gap-6 lg:px-8">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              data-testid={`student-tab-${tab.id}`}
              className="tab-item relative flex h-full w-[64px] flex-col items-center justify-center sm:w-[84px] lg:w-[104px]"
              aria-label={`切换到${tab.label}页面`}
            >
              <motion.div
                className={`relative flex h-9 w-12 items-center justify-center rounded-full ${
                  isActive ? 'bg-primary-50' : ''
                }`}
                whileTap={{ scale: 0.9 }}
              >
                <Icon 
                  size={22} 
                  strokeWidth={isActive ? 2.5 : 2}
                  className={isActive ? 'text-primary-700' : 'text-neutral-400'}
                />
                {isActive && (
                  <motion.div
                    className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary-600"
                    layoutId="tabIndicator"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </motion.div>
              <span 
                className={`text-caption-1 mt-1 ${
                  isActive ? 'text-primary-700 font-semibold' : 'text-neutral-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default TabBar
