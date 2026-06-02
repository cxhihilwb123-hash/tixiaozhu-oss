import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ChevronLeft, Coins, Crown, FileText, ShieldCheck, Sparkles } from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'
import Modal from '../components/Modal'
import { useUserStore } from '../stores'
import { MEMBERSHIP_PLANS } from '../utils/constants'
import { apiGet, apiPost } from '../utils/api'

const MembershipPage = ({ onClose }) => {
  const { studentProfile, pointsAccount, setMembership, setPointsAccount, applyPointTransaction } = useUserStore()
  const [selectedPlan, setSelectedPlan] = useState(MEMBERSHIP_PLANS.find(p => p.recommended) || MEMBERSHIP_PLANS[0])
  const [pointPackages, setPointPackages] = useState([])
  const [selectedPointPackage, setSelectedPointPackage] = useState(null)
  const [isPointsMode, setIsPointsMode] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentProvider, setPaymentProvider] = useState('wechat_pay')
  const [paymentAvailable, setPaymentAvailable] = useState(false)
  const [paymentDeferred, setPaymentDeferred] = useState(false)

  useEffect(() => {
    apiGet('/payment/config', { monetizationMode: 'membership' }).then((config) => {
      setPaymentAvailable(Boolean(config?.visible || config?.pointsVisible))
      setPaymentDeferred(config?.paymentLaunchStrategy === 'deferred')
      setIsPointsMode(Boolean(config?.pointsVisible))
    })
    apiGet('/point-packages', []).then((packages) => {
      setPointPackages(packages)
      setSelectedPointPackage(packages.find(item => item.recommended) || packages[0] || null)
    })
    apiGet(`/points/account?user=${encodeURIComponent(studentProfile.nickname || '同学')}`, null).then((account) => {
      if (account) setPointsAccount(account)
    })
  }, [studentProfile.nickname, setPointsAccount])

  const handlePayment = () => {
    setIsProcessing(true)
    const expireDate = new Date(Date.now() + selectedPlan.duration * 24 * 60 * 60 * 1000).toLocaleDateString()

    apiPost('/payments/session', {
      user: studentProfile.nickname || '同学',
      planId: selectedPlan.id,
      plan: selectedPlan.name,
      amount: selectedPlan.price,
      provider: paymentProvider,
      duration: selectedPlan.duration,
    }, null).then((session) => {
      if (import.meta.env.PROD || !session?.shouldAutoConfirm) return session
      return apiPost('/payments/mock-confirm', {
        paymentId: session.payment?.id,
        orderId: session.order?.id,
      }, null)
    }).then((result) => {
      const order = result?.order || result
      if (!order || order.status !== 'paid') {
        setIsProcessing(false)
        return
      }
      setMembership({
        isMember: true,
        plan: selectedPlan.id,
        expireDate: order?.expireDate || expireDate,
        trialUsed: true,
      })
      setIsProcessing(false)
      setShowPaymentModal(false)
      onClose()
    })
  }

  const handlePointPurchase = () => {
    if (!selectedPointPackage) return
    setIsProcessing(true)
    apiPost('/points/purchase', {
      user: studentProfile.nickname || '同学',
      packageId: selectedPointPackage.id,
      provider: paymentProvider,
    }, null).then((result) => {
      if (result?.account) setPointsAccount(result.account)
      if (result?.transaction) applyPointTransaction(result.transaction)
      setIsProcessing(false)
      setShowPaymentModal(false)
    })
  }

  if (!paymentAvailable) {
    return (
      <div className="app-page">
        <main className="app-shell student-narrow">
          <header className="mb-6">
            <button onClick={onClose} className="mb-5 flex items-center gap-1 text-caption-1 text-neutral-500">
              <ChevronLeft size={18} />
              返回
            </button>
            <div className="rounded-card bg-neutral-900 p-5 text-white">
              <div className="mb-8 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                  <ShieldCheck size={24} className="text-primary-200" />
                </div>
                <span className="badge bg-white/10 text-white">{paymentDeferred ? '支付延期' : '暂未开放'}</span>
              </div>
              <h1 className="mb-3 text-display">支付入口暂未开放</h1>
              <p className="text-body text-white/68">
                当前版本先开放题库、练习、错题和学习报告能力；正式支付会在商户、回调、退款和对账完成后单独上线。
              </p>
            </div>
          </header>

          <Card staticCard className="bg-white">
            <h2 className="mb-2 text-title-2 text-neutral-900">现在可以继续使用</h2>
            <p className="text-subhead text-neutral-500">
              已解锁题包、免费题包、练习记录、错题回收和家长报告不受影响。
            </p>
          </Card>
        </main>
      </div>
    )
  }

  if (isPointsMode) {
    return (
      <div className="app-page">
        <main className="app-shell">
          <header className="mb-6">
            <button onClick={onClose} className="mb-5 flex items-center gap-1 text-caption-1 text-neutral-500">
              <ChevronLeft size={18} />
              返回
            </button>
            <div className="rounded-card bg-neutral-900 p-5 text-white">
              <div className="mb-8 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                  <Coins size={24} className="text-amber-200" />
                </div>
                <span className="badge bg-white/10 text-white">积分模式</span>
              </div>
              <h1 className="mb-3 text-display">购买题包用学习积分</h1>
              <p className="max-w-[520px] text-body text-white/68">
                当前余额 {pointsAccount.balance || 0} 积分。只有解锁题包会扣积分，拍题、提示、批改和学习报告免费使用。
              </p>
            </div>
          </header>

          <section className="mb-6">
            <h2 className="section-title mb-3">积分规则</h2>
            <div className="student-card-grid">
              {(pointsAccount.rules?.length ? pointsAccount.rules : [
                { action: 'content_purchase', name: '解锁题包', variableCost: true, unit: '题包' },
                { action: 'practice_reward', name: '完成练习奖励', reward: 5, unit: '组' },
              ]).map((rule) => (
                <div key={rule.action} className="surface-line flex min-h-[52px] items-center justify-between rounded-card bg-white px-4">
                  <span className="text-body text-neutral-900">{rule.name}</span>
                  <span className={rule.reward ? 'text-title-3 text-green-700' : 'text-title-3 text-amber-700'}>
                    {rule.variableCost ? '按题包价格' : `${rule.reward ? `+${rule.reward}` : `-${rule.cost}`} 积分/${rule.unit}`}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-6">
            <h2 className="section-title mb-3">选择积分包</h2>
            <div className="student-card-grid">
              {pointPackages.map((pack) => {
                const active = selectedPointPackage?.id === pack.id
                const total = Number(pack.points || 0) + Number(pack.bonusPoints || 0)
                return (
                  <Card
                    key={pack.id}
                    animate={false}
                    onClick={() => setSelectedPointPackage(pack)}
                    className={`bg-white ${active ? 'border-primary-600 bg-primary-50' : ''}`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <h3 className="text-title-2 text-neutral-900">{pack.name}</h3>
                          {pack.recommended && <span className="badge badge-warning">推荐</span>}
                        </div>
                        <p className="text-caption-1 text-neutral-500">{pack.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-title-1 text-primary-800">¥{pack.price}</div>
                        <div className="text-caption-1 text-neutral-500">{total} 积分</div>
                      </div>
                    </div>
                    {pack.bonusPoints > 0 && (
                      <div className="mt-4 inline-flex rounded-full bg-amber-50 px-3 py-1 text-caption-1 text-amber-700">
                        含赠送 {pack.bonusPoints} 积分
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </section>

          <section className="mb-6">
            <h2 className="section-title mb-3">最近流水</h2>
            <div className="surface-line overflow-hidden rounded-card bg-white">
              {(pointsAccount.recentTransactions || []).slice(0, 5).map((item, index) => (
                <div key={item.id} className={`flex min-h-[58px] items-center justify-between px-4 ${index > 0 ? 'border-t border-neutral-100' : ''}`}>
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-neutral-400" />
                    <div>
                      <div className="text-body text-neutral-900">{item.note || item.action}</div>
                      <div className="text-caption-1 text-neutral-500">{item.createdAt}</div>
                    </div>
                  </div>
                  <span className={item.type === 'credit' ? 'text-title-3 text-green-700' : 'text-title-3 text-amber-700'}>
                    {item.type === 'credit' ? '+' : '-'}{item.points}
                  </span>
                </div>
              ))}
              {(!pointsAccount.recentTransactions || pointsAccount.recentTransactions.length === 0) && (
                <div className="px-4 py-5 text-center text-caption-1 text-neutral-500">暂无积分流水</div>
              )}
            </div>
          </section>

          <Button fullWidth disabled={!selectedPointPackage} onClick={() => setShowPaymentModal(true)}>
            购买积分 ¥{selectedPointPackage?.price || 0}
          </Button>
        </main>

        <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="确认购买">
          <div className="space-y-4">
            <div className="rounded-card bg-neutral-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-body text-neutral-900">{selectedPointPackage?.name}</span>
                <span className="text-title-1 text-primary-800">¥{selectedPointPackage?.price}</span>
              </div>
            </div>
            <Button fullWidth loading={isProcessing} onClick={handlePointPurchase}>
              确认支付
            </Button>
            <p className="text-center text-caption-1 text-neutral-400">测试模式会自动到账</p>
          </div>
        </Modal>
      </div>
    )
  }

  return (
    <div className="app-page">
      <main className="app-shell">
        <header className="mb-6">
          <button onClick={onClose} className="mb-5 flex items-center gap-1 text-caption-1 text-neutral-500">
            <ChevronLeft size={18} />
            返回
          </button>
          <div className="rounded-card bg-neutral-900 p-5 text-white">
              <div className="mb-8 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <Crown size={24} className="text-amber-200" />
              </div>
              <span className="badge bg-white/10 text-white">题小助会员</span>
            </div>
            <h1 className="mb-3 text-display">更多题目处理额度</h1>
            <p className="max-w-[520px] text-body text-white/68">
              适合高频拍题、订正和阶段复习的学生账号。
            </p>
          </div>
        </header>

        <section className="mb-6">
          <h2 className="section-title mb-3">会员权益</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {['无限拍题识别', 'AI讲解批改', '错题强化练习', '专属题包', '学习报告'].map((benefit, index) => (
              <motion.div
                key={benefit}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="surface-line flex min-h-[52px] items-center gap-3 rounded-card bg-white px-4"
              >
                <Check size={18} className="text-green-700" />
                <span className="text-body text-neutral-900">{benefit}</span>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="section-title mb-3">选择套餐</h2>
          <div className="student-card-grid">
            {MEMBERSHIP_PLANS.map((plan) => {
              const active = selectedPlan?.id === plan.id
              return (
                <Card
                  key={plan.id}
                  animate={false}
                  onClick={() => setSelectedPlan(plan)}
                  className={`bg-white ${active ? 'border-primary-600 bg-primary-50' : ''}`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-title-2 text-neutral-900">{plan.name}</h3>
                        {plan.recommended && <span className="badge badge-warning">推荐</span>}
                      </div>
                      <p className="text-caption-1 text-neutral-500">{plan.duration} 天有效期</p>
                    </div>
                    <div className="text-right">
                      <div className="text-title-1 text-primary-800">¥{plan.price}</div>
                      {plan.originalPrice > plan.price && (
                        <div className="text-caption-1 text-neutral-400 line-through">¥{plan.originalPrice}</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {plan.features.slice(0, 4).map(feature => (
                      <span key={feature} className="rounded-full bg-neutral-100 px-3 py-1 text-caption-1 text-neutral-600">
                        {feature}
                      </span>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        </section>

        <Button fullWidth onClick={() => setShowPaymentModal(true)}>
          立即开通 ¥{selectedPlan?.price}
        </Button>
        <p className="mt-3 text-center text-caption-1 text-neutral-400">开通后立即生效</p>
      </main>

      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="确认购买">
        <div className="space-y-4">
          <div className="rounded-card bg-neutral-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-body text-neutral-900">{selectedPlan?.name}</span>
              <span className="text-title-1 text-primary-800">¥{selectedPlan?.price}</span>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-title-3 text-neutral-900">支付方式</h3>
            <div className="grid gap-2">
              <button
                onClick={() => setPaymentProvider('wechat_pay')}
                className={`surface-line flex min-h-[52px] items-center gap-3 rounded-card px-4 text-left ${paymentProvider === 'wechat_pay' ? 'bg-primary-50 border-primary-600' : 'bg-white'}`}
              >
                <Sparkles size={20} className="text-green-700" />
                <span className="text-body text-neutral-900">微信支付</span>
              </button>
              <button
                onClick={() => setPaymentProvider('alipay')}
                className={`surface-line flex min-h-[52px] items-center gap-3 rounded-card px-4 text-left ${paymentProvider === 'alipay' ? 'bg-primary-50 border-primary-600' : 'bg-white'}`}
              >
                <ShieldCheck size={20} className="text-primary-700" />
                <span className="text-body text-neutral-900">支付宝</span>
              </button>
            </div>
          </div>

          <Button fullWidth loading={isProcessing} onClick={handlePayment}>
            立即支付 ¥{selectedPlan?.price}
          </Button>
          <p className="text-center text-caption-1 text-neutral-400">购买即表示同意会员服务协议</p>
        </div>
      </Modal>
    </div>
  )
}

export default MembershipPage
