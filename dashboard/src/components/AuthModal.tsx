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

  return (
    <div className="min-h-screen bg-lp-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-lp-800 tracking-tight">Sleep Sensor</h1>
          <p className="text-sm text-lp-400 mt-1">Live Bedside Monitor</p>
        </div>

        <div className="bg-white rounded-2xl border border-lp-200 p-6 shadow-sm">
          {/* Tab toggle */}
          <div className="flex rounded-lg overflow-hidden border border-lp-200 text-sm mb-6">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null) }}
                className={`flex-1 py-2 font-medium transition-colors ${
                  mode === m
                    ? 'bg-lp-500 text-white'
                    : 'text-lp-400 hover:bg-lp-50'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            {mode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-lp-600 uppercase tracking-wider">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your name"
                  className="w-full px-3 py-2.5 rounded-lg border border-lp-200 bg-lp-50 text-lp-800 text-sm placeholder:text-lp-300 focus:outline-none focus:ring-2 focus:ring-lp-400 focus:border-transparent"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-lp-600 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 rounded-lg border border-lp-200 bg-lp-50 text-lp-800 text-sm placeholder:text-lp-300 focus:outline-none focus:ring-2 focus:ring-lp-400 focus:border-transparent"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-lp-600 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder={mode === 'register' ? 'Min 8 characters' : '••••••••'}
                className="w-full px-3 py-2.5 rounded-lg border border-lp-200 bg-lp-50 text-lp-800 text-sm placeholder:text-lp-300 focus:outline-none focus:ring-2 focus:ring-lp-400 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 w-full py-2.5 rounded-lg bg-lp-500 hover:bg-lp-600 text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {isLoading
                ? mode === 'login' ? 'Signing in…' : 'Creating account…'
                : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-lp-300 mt-4">
          Your data stays private — only you can see your readings.
        </p>
      </div>
    </div>
  )
}
