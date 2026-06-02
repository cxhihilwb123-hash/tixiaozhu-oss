import React, { useState } from 'react'
import { Lock, ShieldCheck, User } from 'lucide-react'
import { apiPost } from '../utils/api'

const LoginPage = ({ onSuccess }) => {
  const [username, setUsername] = useState(import.meta.env.PROD ? '' : 'admin')
  const [password, setPassword] = useState(import.meta.env.PROD ? '' : 'admin123')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    const result = await apiPost('/admin/auth/login', { username, password }, null)
    setLoading(false)
    if (!result?.token) {
      setMessage('登录失败，请检查账号和密码。')
      return
    }
    onSuccess(result)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#e0f2fe_0%,#f8fafc_42%,#eef2ff_100%)] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-white/80 bg-white/90 shadow-[0_30px_120px_rgba(15,23,42,0.12)] backdrop-blur md:grid-cols-[1.08fr_0.92fr]">
          <div className="relative flex flex-col justify-between bg-sky-950 px-8 py-10 text-white md:px-10">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(56,189,248,0.04),transparent)]" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs tracking-[0.18em] text-sky-100">
                <ShieldCheck size={14} />
                ADMIN ACCESS
              </div>
              <h1 className="mt-6 text-4xl font-semibold leading-tight">题小助运营后台</h1>
              <p className="mt-4 max-w-md text-sm leading-7 text-sky-100/85">
                后台需要管理员登录后才能进入，关键配置、积分调账、题包调题等写操作会同步校验管理员会话。
              </p>
            </div>
            <div className="relative mt-10 grid gap-4 text-sm text-sky-100/90">
              {[
                '正式基线审计、题库质检、积分模式都已经接入后台。',
                '生产环境必须使用环境变量配置的强账号和强会话密钥。',
                '支付延期版本下，后台只保留订单观察和内容运营能力。',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center px-6 py-8 md:px-10">
            <form className="w-full" onSubmit={handleSubmit}>
              <div>
                <div className="text-sm font-medium uppercase tracking-[0.2em] text-sky-600">Secure Sign In</div>
                <h2 className="mt-3 text-3xl font-semibold text-neutral-900">登录继续管理项目</h2>
                <p className="mt-3 text-sm leading-7 text-neutral-500">
                  使用部署环境配置的管理员账号登录；正式环境不会预填测试账号。
                </p>
              </div>

              <div className="mt-8 space-y-5">
                <label className="block">
                  <div className="mb-2 text-sm font-medium text-neutral-700">管理员账号</div>
                  <div className="relative">
                    <User size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      className="input-admin w-full rounded-2xl bg-neutral-50 py-3 pl-11 pr-4"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="请输入管理员账号"
                    />
                  </div>
                </label>

                <label className="block">
                  <div className="mb-2 text-sm font-medium text-neutral-700">登录密码</div>
                  <div className="relative">
                    <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="password"
                      className="input-admin w-full rounded-2xl bg-neutral-50 py-3 pl-11 pr-4"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="请输入密码"
                    />
                  </div>
                </label>
              </div>

              {message && (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-admin btn-admin-primary mt-6 flex w-full items-center justify-center rounded-2xl py-3 text-base disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? '登录中...' : '进入后台'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
