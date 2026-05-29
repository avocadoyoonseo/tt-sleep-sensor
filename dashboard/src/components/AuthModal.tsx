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
    'w-full px-3 py-2.5 rounded-lg border border-lp-200 bg-lp-50 text-lp-900 text-sm placeholder:text-lp-300 focus:outline-none focus:ring-2 focus:ring-lp-500/40 focus:border-lp-500/50 transition-colors'

  return (
    <div className="min-h-screen bg-lp-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="font-display text-5xl font-semibold italic text-lp-900 tracking-tight mb-2">
            Dormi
          </h1>
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="h-px flex-1 max-w-[60px] bg-lp-200" />
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-lp-500 text-[11px] font-semibold tracking-widest uppercase">
              <span>&#920;&#932;</span>
              <span className="text-lp-300">·</span>
              <span>Upsilon Delta</span>
            </span>
            <div className="h-px flex-1 max-w-[60px] bg-lp-200" />
          </div>
          <p className="text-xs text-lp-300 tracking-widest uppercase">Live Bedside Monitor</p>
        </div>

        <div className="bg-lp-100 rounded-2xl border border-lp-200 p-6 shadow-sm">
          {/* Tab toggle */}
          <div className="flex rounded-lg overflow-hidden border border-lp-200 text-sm mb-6">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null) }}
                className={`flex-1 py-2 font-medium transition-all cursor-pointer ${
                  mode === m
                    ? 'bg-lp-900 text-white'
                    : 'text-lp-400 hover:bg-lp-50 hover:text-lp-700'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            {mode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-lp-400 uppercase tracking-widest">
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
              <label className="text-[11px] font-semibold text-lp-400 uppercase tracking-widest">
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
              <label className="text-[11px] font-semibold text-lp-400 uppercase tracking-widest">
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
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 w-full py-2.5 rounded-lg bg-lp-900 hover:bg-lp-800 text-white font-semibold text-sm tracking-wide transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isLoading
                ? mode === 'login' ? 'Signing in…' : 'Creating account…'
                : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-lp-300 mt-4 tracking-wider uppercase">
          Your data stays private
        </p>
      </div>
    </div>
  )
}
