'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ModalWrapper } from './ModalWrapper'

// ── Icons ─────────────────────────────────────────────────────────────────────

function XIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 6-12 12M6 6l12 12" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SignInModalProps {
  open: boolean
  onClose: () => void
}

type Step = 'idle' | 'email_sent' | 'loading'

export function SignInModal({ open, onClose }: SignInModalProps) {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const supabase = createClient()
  const redirectTo = typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : '/auth/callback'

  async function handleGoogle() {
    setError(null)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStep('loading')
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    })
    if (error) {
      setError(error.message)
      setStep('idle')
    } else {
      setStep('email_sent')
    }
  }

  function resetAndClose(closeFn: () => void) {
    setEmail('')
    setStep('idle')
    setError(null)
    closeFn()
  }

  return (
    <ModalWrapper onClose={onClose} label="Sign in to Benefits.AI">
      {(handleClose) => (
      <>
        <button className="modal-x" aria-label="Close" onClick={() => resetAndClose(handleClose)}>
          <XIcon size={18} />
        </button>

        {step === 'email_sent' ? (
          <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>📬</div>
            <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
              Check your inbox
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>
              We sent a sign-in link to <strong style={{ color: 'var(--text)' }}>{email}</strong>. Click it to continue.
            </p>
            <button className="modal-btn ghost" onClick={handleClose} style={{ width: '100%' }}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                Sign in to Benefits.AI
              </h2>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)' }}>
                Save your conversations and pick up where you left off.
              </p>
            </div>

            {/* Google */}
            <button
              onClick={handleGoogle}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: '11px 16px', borderRadius: 11,
                border: '1px solid var(--border-strong)', background: 'var(--surface)',
                fontSize: 14, fontWeight: 600, color: 'var(--text)',
                cursor: 'pointer', transition: 'background 140ms ease',
                marginBottom: 16,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 12, color: 'var(--faint)', fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* Email magic link */}
            <form onSubmit={handleMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10,
                  border: '1px solid var(--border-strong)', background: 'var(--surface)',
                  fontSize: 14, color: 'var(--text)', outline: 'none',
                  transition: 'border-color 160ms ease, box-shadow 160ms ease',
                  fontFamily: 'var(--font-body)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent)'
                  e.target.style.boxShadow = '0 0 0 3px var(--accent-tint)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border-strong)'
                  e.target.style.boxShadow = 'none'
                }}
              />
              {error && (
                <p style={{ margin: 0, fontSize: 12.5, color: '#b4452f' }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={step === 'loading' || !email.trim()}
                className="modal-btn primary"
                style={{ width: '100%', opacity: step === 'loading' ? 0.7 : 1 }}
              >
                {step === 'loading' ? 'Sending…' : 'Send sign-in link'}
              </button>
            </form>

            <p style={{ margin: '16px 0 0', fontSize: 12, color: 'var(--faint)', textAlign: 'center', lineHeight: 1.5 }}>
              By signing in you agree to our terms. We never sell your data.
            </p>
          </>
        )}
      </>
      )}
    </ModalWrapper>
  )
}
