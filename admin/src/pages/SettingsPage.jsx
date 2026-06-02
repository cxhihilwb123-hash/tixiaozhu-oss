import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Save, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { apiGet, apiPatch } from '../utils/api'

const fallbackSettings = import.meta.env.PROD ? null : {
  appName: '题小助',
  uploadLimitPerDay: 20,
  trialDays: 7,
  aiProvider: 'mock-compatible',
  contentReviewRequired: true,
  maintenanceMode: false,
  monetizationMode: 'points',
  pointsFeatureVisible: true,
  paymentFeatureVisible: false,
  paymentMode: 'test',
}

const SettingsPage = () => {
  const [settings, setSettings] = useState(fallbackSettings || {})
  const [launchReport, setLaunchReport] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    apiGet('/settings', fallbackSettings).then(next => {
      if (next) setSettings(next)
    })
    apiGet('/commercial-launch-readiness', null).then(setLaunchReport)
  }, [])

  const update = (key, value) => {
    setSettings(current => ({ ...current, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    const next = await apiPatch('/settings', settings, settings)
    if (next) {
      setSettings(next)
      setSaved(true)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-800">系统与权限中心</h1>
          <p className="text-sm text-neutral-500 mt-1">管理应用配置、内容审核和运行开关</p>
        </div>
        <button onClick={handleSave} className="btn-admin btn-admin-primary flex items-center gap-2">
          <Save size={16} />
          保存配置
        </button>
      </div>

      {saved && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          配置已保存。
        </div>
      )}

      {launchReport && (
        <section className="stat-card">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-800">商业上线审计</h2>
              <p className="mt-1 text-sm text-neutral-500">这里按生产发布标准检查，不等同于内测可用状态。</p>
            </div>
            <span className={launchReport.readiness === 'launch_ready' ? 'badge-admin badge-success' : launchReport.readiness === 'needs_hardening' ? 'badge-admin badge-warning' : 'badge-admin badge-error'}>
              {launchReport.readiness === 'launch_ready' ? '可上线' : launchReport.readiness === 'needs_hardening' ? '需加固' : '上线阻塞'}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {[
              ['题包', launchReport.summary?.questionPacks || 0],
              ['题目', launchReport.summary?.questions || 0],
              ['支付策略', launchReport.summary?.paymentDeferred ? '延期' : launchReport.summary?.paymentMode || '-'],
              ['数据库', launchReport.summary?.hasDatabase ? '已配置' : '未配置'],
              ['问题项', launchReport.issueCount || 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-neutral-50 p-3">
                <div className="text-xs text-neutral-500">{label}</div>
                <div className="mt-1 text-lg font-semibold text-neutral-800">{value}</div>
              </div>
            ))}
          </div>

          {launchReport.deferredItems?.length > 0 && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3">
              <div className="text-sm font-semibold text-blue-800">本轮明确延期项</div>
              <div className="mt-2 grid gap-2">
                {launchReport.deferredItems.map((item) => (
                  <div key={item.title} className="text-xs text-blue-700">
                    {item.title}：{item.action}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-2">
            {(launchReport.issues || []).slice(0, 6).map((issue) => (
              <div key={issue.title} className="rounded-lg border border-neutral-200 bg-white px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-neutral-800">{issue.title}</div>
                  <span className={issue.level === 'high' ? 'badge-admin badge-error' : 'badge-admin badge-warning'}>
                    {issue.level === 'high' ? 'P0' : 'P1'}
                  </span>
                </div>
                <div className="mt-1 text-xs text-neutral-500">{issue.action}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-6">
        <section className="stat-card">
          <h2 className="text-lg font-semibold text-neutral-800 mb-4 flex items-center gap-2">
            <SlidersHorizontal size={20} className="text-primary-600" />
            基础配置
          </h2>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm text-neutral-600 mb-2 block">应用名称</span>
              <input className="input-admin w-full" value={settings.appName} onChange={event => update('appName', event.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm text-neutral-600 mb-2 block">每日拍题额度</span>
              <input type="number" className="input-admin w-full" value={settings.uploadLimitPerDay} onChange={event => update('uploadLimitPerDay', Number(event.target.value))} />
            </label>
            <label className="block">
              <span className="text-sm text-neutral-600 mb-2 block">试用天数</span>
              <input type="number" className="input-admin w-full" value={settings.trialDays} onChange={event => update('trialDays', Number(event.target.value))} />
            </label>
            <label className="block">
              <span className="text-sm text-neutral-600 mb-2 block">AI服务商</span>
              <select className="input-admin w-full" value={settings.aiProvider} onChange={event => update('aiProvider', event.target.value)}>
                {!import.meta.env.PROD && <option value="mock-compatible">内置测试模型</option>}
                <option value="openai-compatible">OpenAI Compatible</option>
                <option value="private-model">私有模型</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-neutral-600 mb-2 block">商业模式</span>
              <select className="input-admin w-full" value={settings.monetizationMode || 'membership'} onChange={event => update('monetizationMode', event.target.value)}>
                <option value="points">积分模式</option>
                <option value="membership">会员模式</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-neutral-600 mb-2 block">支付模式</span>
              <select className="input-admin w-full" value={settings.paymentMode || (import.meta.env.PROD ? 'production' : 'test')} onChange={event => update('paymentMode', event.target.value)}>
                {!import.meta.env.PROD && <option value="test">测试支付</option>}
                <option value="production">正式支付</option>
              </select>
            </label>
          </div>
        </section>

        <section className="stat-card">
          <h2 className="text-lg font-semibold text-neutral-800 mb-4 flex items-center gap-2">
            <ShieldCheck size={20} className="text-green-600" />
            安全与审核
          </h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 rounded-lg bg-neutral-50">
              <div>
                <div className="font-medium text-neutral-800">内容发布审核</div>
                <div className="text-sm text-neutral-500">AI生成题目发布前进入待审核状态</div>
              </div>
              <input type="checkbox" checked={settings.contentReviewRequired} onChange={event => update('contentReviewRequired', event.target.checked)} />
            </label>
            <label className="flex items-center justify-between p-4 rounded-lg bg-neutral-50">
              <div>
                <div className="font-medium text-neutral-800">维护模式</div>
                <div className="text-sm text-neutral-500">开启后前台只展示维护提示</div>
              </div>
              <input type="checkbox" checked={settings.maintenanceMode} onChange={event => update('maintenanceMode', event.target.checked)} />
            </label>
            <label className="flex items-center justify-between p-4 rounded-lg bg-neutral-50">
              <div>
                <div className="font-medium text-neutral-800">前台积分入口</div>
                <div className="text-sm text-neutral-500">开启后我的页面展示积分余额和积分包购买入口</div>
              </div>
              <input type="checkbox" checked={Boolean(settings.pointsFeatureVisible)} onChange={event => update('pointsFeatureVisible', event.target.checked)} />
            </label>
            <label className="flex items-center justify-between p-4 rounded-lg bg-neutral-50">
              <div>
                <div className="font-medium text-neutral-800">前台支付入口</div>
                <div className="text-sm text-neutral-500">支付延期版本必须保持关闭，正式支付恢复后再开放</div>
              </div>
              <input type="checkbox" checked={Boolean(settings.paymentFeatureVisible)} onChange={event => update('paymentFeatureVisible', event.target.checked)} />
            </label>
            <div className="p-4 rounded-lg bg-primary-50 text-sm text-primary-700">
              {import.meta.env.PROD
                ? '当前按正式运行口径展示配置；支付入口需等待正式商户、回调、退款和对账完成后再开放。'
                : '当前使用本地测试运行配置；产品模块按正式业务保留，生产环境需接入账号权限、持久化数据库和真实支付回调验签。'}
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  )
}

export default SettingsPage
