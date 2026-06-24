'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth/context'
import { SignInModal } from './SignInModal'
import { ModalWrapper } from './ModalWrapper'

// ── Static data ───────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', label: 'English',    native: 'English' },
  { code: 'ar', label: 'Arabic',     native: 'العربية' },
  { code: 'zh', label: 'Mandarin',   native: '中文' },
  { code: 'hi', label: 'Hindi',      native: 'हिन्दी' },
  { code: 'vi', label: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'pa', label: 'Punjabi',    native: 'ਪੰਜਾਬੀ' },
]

const HOW_IT_WORKS_STEPS = [
  { title: 'Tell us your situation',        body: "Describe what's going on in your own words — work, family, study, housing." },
  { title: 'We check your eligibility',     body: 'We match you against federal, state and local programs in real time.' },
  { title: 'See what you may qualify for',  body: 'Plain-English explanations with an estimated annual value for each program.' },
  { title: 'Follow official claim pathways',body: 'We link you straight to the right place to claim with the relevant agency.' },
]

// ── Icons ─────────────────────────────────────────────────────────────────────

export const HeaderIcon = {
  Globe: ({ size = 17 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </svg>
  ),
  Chevron: ({ size = 13 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  Check: ({ size = 16 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  ),
  User: ({ size = 19 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  ),
  X: ({ size = 18 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 6-12 12M6 6l12 12" />
    </svg>
  ),
  Sparkle: ({ size = 21 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5c.6 3.9 1.6 4.9 5.5 5.5-3.9.6-4.9 1.6-5.5 5.5-.6-3.9-1.6-4.9-5.5-5.5 3.9-.6 4.9-1.6 5.5-5.5Z" />
      <path d="M18.5 14.5c.3 1.7.7 2.1 2.5 2.5-1.8.3-2.2.8-2.5 2.5-.3-1.7-.7-2.1-2.5-2.5 1.8-.4 2.2-.8 2.5-2.5Z" />
    </svg>
  ),
  Bell:          ({ size = 18 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  Help:          ({ size = 18 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M9.6 9.4a2.4 2.4 0 0 1 4.6.9c0 1.6-2.2 2-2.2 2" /><path d="M12 17h.01" />
    </svg>
  ),
  Lock:          ({ size = 14 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  ),
  Book:          ({ size = 18 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" />
    </svg>
  ),
  Accessibility: ({ size = 18 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="1.6" /><path d="M5 8h14" /><path d="M12 8v6" /><path d="m9 21 3-7 3 7" />
    </svg>
  ),
  LogOut:        ({ size = 18 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8" /><path d="m17 15 3-3-3-3" /><path d="M20 12H10" />
    </svg>
  ),
}

type IconName = keyof typeof HeaderIcon

// ── Toast system ──────────────────────────────────────────────────────────────

export interface Toast { id: string; title?: string; message: string }

export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className="toast" role="status">
          <div style={{ flex: 1, minWidth: 0 }}>
            {t.title && <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>{t.title}</div>}
            <div style={{ fontSize: 13.5, color: t.title ? 'var(--muted)' : 'var(--text-soft)', lineHeight: 1.4 }}>{t.message}</div>
          </div>
          <button className="toast-x" aria-label="Dismiss" onClick={() => onDismiss(t.id)}>
            <HeaderIcon.X size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const addToast = useCallback((t: Omit<Toast, 'id'>, duration = 3400) => {
    const id = 't' + Date.now() + Math.random().toString(36).slice(2, 5)
    setToasts((prev) => [...prev, { id, ...t }])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), duration)
  }, [])
  const dismiss = useCallback((id: string) => setToasts((prev) => prev.filter((x) => x.id !== id)), [])
  return { toasts, addToast, dismiss }
}

// ── How it works modal ────────────────────────────────────────────────────────

function HowItWorksModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalWrapper onClose={onClose} label="How Benefits.AI works">
      {(handleClose) => (
        <>
          <button className="modal-x" aria-label="Close" onClick={handleClose}><HeaderIcon.X size={18} /></button>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--accent-tint)', color: 'var(--accent)' }}>
              <HeaderIcon.Sparkle size={21} />
            </span>
            <div style={{ flex: 1, paddingTop: 2 }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                How Benefits.AI works
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>Four simple steps — no forms, no jargon.</p>
            </div>
          </div>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {HOW_IT_WORKS_STEPS.map((s, i) => (
              <li key={i} style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--accent-tint)', color: 'var(--accent)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{i + 1}</span>
                <div style={{ paddingTop: 2 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }}>{s.title}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>{s.body}</div>
                </div>
              </li>
            ))}
          </ol>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
            <button className="modal-btn primary" onClick={handleClose}>Got it</button>
          </div>
        </>
      )}
    </ModalWrapper>
  )
}

// ── Language selector ─────────────────────────────────────────────────────────

function LanguageSelector({ onToast }: { onToast?: (t: Omit<Toast, 'id'>) => void }) {
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState(LANGUAGES[0])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} className="lang-trigger" style={{
        display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)',
        border: '1px solid var(--border-strong)', borderRadius: 10, padding: '7px 11px',
        boxShadow: 'var(--shadow-sm)', color: 'var(--text)', cursor: 'pointer',
      }}>
        <span style={{ color: 'var(--accent)', display: 'grid', placeItems: 'center' }}><HeaderIcon.Globe size={17} /></span>
        <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em' }}>{lang.label}</span>
        <span style={{ color: 'var(--faint)', display: 'grid', placeItems: 'center', transition: 'transform 180ms ease', transform: open ? 'rotate(180deg)' : 'none' }}>
          <HeaderIcon.Chevron size={13} />
        </span>
      </button>
      {open && (
        <div role="listbox" className="lang-pop" style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 232, zIndex: 50,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
          boxShadow: 'var(--shadow-lg)', padding: 6, overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 12px 7px', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
            Choose your language
          </div>
          {LANGUAGES.map((l) => {
            const active = l.code === lang.code
            return (
              <button key={l.code} role="option" aria-selected={active} onClick={() => {
                if (l.code !== lang.code) onToast?.({ title: 'Language updated', message: `Benefits.AI is now set to ${l.label}.` })
                setLang(l); setOpen(false)
              }} className="lang-item" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                width: '100%', textAlign: 'left', background: active ? 'var(--accent-tint)' : 'transparent',
                border: 'none', borderRadius: 9, padding: '9px 12px', color: 'var(--text)', cursor: 'pointer',
              }}>
                <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 500 }}>{l.native}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{l.label}</span>
                </span>
                {active && <span style={{ color: 'var(--accent)', flexShrink: 0, display: 'grid', placeItems: 'center' }}><HeaderIcon.Check size={16} /></span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Settings / account menu ───────────────────────────────────────────────────

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase()
}

function SettingsMenu({ onSignIn }: { onSignIn: () => void }) {
  const { user } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function handleSignOut() {
    setOpen(false)
    await createClient().auth.signOut()
  }

  function go(hash: string) { setOpen(false); router.push(`/profile#${hash}`) }

  type MenuItem = { icon: IconName; label: string; locked?: boolean; onClick: () => void }
  const items: MenuItem[] = [
    { icon: 'User',          label: 'Profile',                  locked: !user,  onClick: () => go('profile') },
    { icon: 'Book',          label: 'Resources',                                onClick: () => go('resources') },
    { icon: 'Bell',          label: 'Notification preferences', locked: !user,  onClick: () => go('notifications') },
    { icon: 'Accessibility', label: 'Accessibility settings',                   onClick: () => go('accessibility') },
    { icon: 'Lock',          label: 'Privacy & data',           locked: !user,  onClick: () => go('privacy') },
    { icon: 'Help',          label: 'Help & support',                           onClick: () => go('help') },
  ]

  const displayName = user?.user_metadata?.full_name as string | undefined
  const displayEmail = user?.email ?? ''

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} aria-label={user ? 'Account' : 'Account: guest'}
        aria-haspopup="menu" aria-expanded={open} className="menu-trigger" style={{
          width: 38, height: 38, borderRadius: 11, border: 'none', background: 'transparent',
          color: 'var(--text-soft)', display: 'grid', placeItems: 'center', position: 'relative', cursor: 'pointer',
        }}>
        {user ? (
          <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            {initials(displayName ?? displayEmail)}
          </span>
        ) : (
          <>
            <HeaderIcon.User size={19} />
            <span aria-hidden="true" style={{ position: 'absolute', right: 5, bottom: 5, width: 8, height: 8, borderRadius: '50%', background: 'var(--faint)', border: '2px solid var(--bg)' }} />
          </>
        )}
      </button>

      {open && (
        <div role="menu" className="menu-pop" style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 256, zIndex: 60,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
          boxShadow: 'var(--shadow-lg)', padding: 6,
        }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px 12px' }}>
              <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                {initials(displayName ?? displayEmail)}
              </span>
              <div style={{ minWidth: 0 }}>
                {displayName && <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--muted)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1f8a5b', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayEmail}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '10px 11px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11 }}>
                <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--bg)', color: 'var(--faint)', display: 'grid', placeItems: 'center', flexShrink: 0, border: '1px solid var(--border)' }}>
                  <HeaderIcon.User size={19} />
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Guest</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--muted)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--faint)', flexShrink: 0 }} />
                    Not signed in
                  </div>
                </div>
              </div>
              <button className="menu-signin" onClick={() => { setOpen(false); onSignIn() }} style={{ cursor: 'pointer' }}>
                <HeaderIcon.User size={16} /> Sign in
              </button>
            </div>
          )}

          <div style={{ height: 1, background: 'var(--border)', margin: '2px 4px 6px' }} />

          {items.map((item) => {
            const C = HeaderIcon[item.icon]
            return (
              <button key={item.label} role="menuitem" className="menu-item" onClick={item.onClick} style={{
                display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
                background: 'transparent', border: 'none', borderRadius: 9, padding: '9px 11px',
                color: 'var(--text-soft)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}>
                <span style={{ color: 'var(--muted)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><C size={18} /></span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.locked && <span style={{ color: 'var(--faint)', display: 'grid', placeItems: 'center', flexShrink: 0 }} title="Sign in required"><HeaderIcon.Lock size={14} /></span>}
              </button>
            )
          })}

          {user && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px' }} />
              <button role="menuitem" className="menu-item" onClick={handleSignOut} style={{
                display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
                background: 'transparent', border: 'none', borderRadius: 9, padding: '9px 11px',
                color: '#b4452f', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}>
                <span style={{ color: '#b4452f', display: 'grid', placeItems: 'center', flexShrink: 0 }}><HeaderIcon.LogOut size={18} /></span>
                Sign out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── AppHeader ─────────────────────────────────────────────────────────────────

interface AppHeaderProps {
  onToast?: (t: Omit<Toast, 'id'>) => void
  bordered?: boolean
  rightExtra?: React.ReactNode
  leftExtra?: React.ReactNode
}

export function AppHeader({ onToast, bordered = false, rightExtra, leftExtra }: AppHeaderProps) {
  const [signInOpen, setSignInOpen] = useState(false)
  const [howOpen, setHowOpen] = useState(false)

  return (
    <>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
        padding: '14px 20px',
        borderBottom: bordered ? '1px solid var(--border)' : 'none',
        background: bordered ? 'var(--surface)' : 'transparent',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {leftExtra}
          <SettingsMenu onSignIn={() => setSignInOpen(true)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {rightExtra}
          <button
            className="ghost-link"
            onClick={() => setHowOpen(true)}
            style={{ background: 'none', border: 'none', textDecoration: 'none', color: 'var(--muted)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            How it works
          </button>
          <LanguageSelector onToast={onToast} />
        </div>
      </header>

      {howOpen && <HowItWorksModal onClose={() => setHowOpen(false)} />}
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </>
  )
}
