import { useState } from 'react'
import { login, register } from '../api'
import type { AuthUser } from '../api'

interface Props {
  onSuccess: (token: string, user: AuthUser) => void
}

export function AuthModal({ onSuccess }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      const result =
        mode === 'login'
          ? await login(email, password)
          : await register(email, name, password)
      onSuccess(result.token, result.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg border border-lp-200 bg-lp-50 text-lp-900 text-sm placeholder:text-lp-300 focus:outline-none focus:ring-2 focus:ring-lp-500/50 focus:border-lp-500/60 transition-colors'

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: '#0F172A',
        backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(34,197,94,0.08) 0%, transparent 70%)',
      }}
    >
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span
              className="w-2 h-2 rounded-full bg-lp-500 animate-pulse"
              style={{ boxShadow: '0 0 8px #22C55E' }}
            />
            <h1 className="font-mono text-2xl font-bold text-lp-900 tracking-tight">
              sleep_sensor
            </h1>
          </div>
          <p className="text-sm text-lp-400 font-mono">// live bedside monitor</p>
        </div>

        <div
          className="rounded-2xl border border-lp-200 p-6"
          style={{ background: '#1E293B', boxShadow: '0 0 40px rgba(34,197,94,0.06), 0 4px 24px rgba(0,0,0,0.4)' }}
        >
          {/* Tab toggle */}
          <div className="flex rounded-lg overflow-hidden border border-lp-200 text-sm mb-6">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null) }}
                className={`flex-1 py-2 font-medium transition-all ${
                  mode === m
                    ? 'bg-lp-500 text-white'
                    : 'text-lp-400 hover:bg-lp-200/50 hover:text-lp-700'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            {mode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-lp-400 uppercase tracking-wider">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your name"
                  className={inputClass}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-lp-400 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-lp-400 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder={mode === 'register' ? 'Min 8 characters' : '••••••••'}
                className={inputClass}
              />
            </div>

            {error && (
              <p className="text-xs text-rose-400 bg-rose-900/20 border border-rose-700/40 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 w-full py-2.5 rounded-lg bg-lp-500 hover:bg-lp-600 text-white font-semibold text-sm transition-colors disabled:opacity-50 cursor-pointer"
              style={{ boxShadow: isLoading ? 'none' : '0 0 16px rgba(34,197,94,0.3)' }}
            >
              {isLoading
                ? mode === 'login' ? 'Signing in…' : 'Creating account…'
                : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-lp-300 mt-4 font-mono">
          // your data stays private
        </p>
      </div>
    </div>
  )
}
