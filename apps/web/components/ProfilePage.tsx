'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/client'
import { SignInModal } from './SignInModal'
import { ModalWrapper } from './ModalWrapper'
import { useToasts, ToastStack } from './AppHeader'
import { DEFAULT_PROFILE, type UserProfile } from '@/lib/profile/types'
import { AnimatePresence, motion } from 'framer-motion'
import { DURATION, EASE } from '@/lib/animations'
import { SkeletonBlock, SkeletonText } from './Skeleton'

// ── Constants ─────────────────────────────────────────────────────────────────

const AU_STATES = [
  'New South Wales', 'Victoria', 'Queensland', 'Western Australia',
  'South Australia', 'Tasmania', 'ACT', 'Northern Territory',
]
const LANGUAGES = ['English', 'Arabic', 'Mandarin', 'Hindi', 'Vietnamese', 'Punjabi']
const RELATIONSHIPS = ['Single', 'Partnered', 'Married', 'Separated', 'Widowed']
const LIVING = ['Renting', 'Homeowner with mortgage', 'Homeowner outright', 'Living with family', 'Other']
const EMPLOYMENT = ['Employed full-time', 'Employed part-time', 'Casual', 'Self-employed', 'Unemployed', 'Retired', 'Unable to work']
const STUDY = ['Not studying', 'Studying full-time', 'Studying part-time', 'Apprenticeship / TAFE']

// ── Icons ─────────────────────────────────────────────────────────────────────

const Icon = {
  User: ({ size = 19 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  ),
  Users: ({ size = 19 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6" /><path d="M17.5 19a5.5 5.5 0 0 0-3-4.9" />
    </svg>
  ),
  Briefcase: ({ size = 19 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" /><path d="M3.5 13h17" />
    </svg>
  ),
  Bell: ({ size = 19 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  Lock: ({ size = 19 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  ),
  Gauge: ({ size = 19 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 17a8 8 0 1 1 16 0" /><path d="m12 13 4-3" />
      <circle cx="12" cy="13" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  Shield: ({ size = 19 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z" />
      <path d="m9.2 11.6 1.9 1.9 3.7-3.8" />
    </svg>
  ),
  Sparkle: ({ size = 19 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5c.6 3.9 1.6 4.9 5.5 5.5-3.9.6-4.9 1.6-5.5 5.5-.6-3.9-1.6-4.9-5.5-5.5 3.9-.6 4.9-1.6 5.5-5.5Z" />
      <path d="M18.5 14.5c.3 1.7.7 2.1 2.5 2.5-1.8.3-2.2.8-2.5 2.5-.3-1.7-.7-2.1-2.5-2.5 1.8-.4 2.2-.8 2.5-2.5Z" />
    </svg>
  ),
  ChevronLeft: ({ size = 19 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14 6-6 6 6 6" />
    </svg>
  ),
  Chevron: ({ size = 15 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  Check: ({ size = 15 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  ),
  Download: ({ size = 17 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v11" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" />
    </svg>
  ),
  Trash: ({ size = 17 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" /><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" />
      <path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" />
    </svg>
  ),
  X: ({ size = 18 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 6-12 12M6 6l12 12" />
    </svg>
  ),
}

// ── Form atoms ────────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-body)', fontSize: 14.5,
  color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border-strong)',
  borderRadius: 11, padding: '11px 13px', outline: 'none',
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', letterSpacing: '-0.01em' }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 12, color: 'var(--faint)' }}>{hint}</span>}
    </label>
  )
}

function TextInput(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className="pf-input" style={{ ...inputBase, ...(p.style || {}) }} />
}

function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pf-input"
        style={{
          ...inputBase, appearance: 'none', paddingRight: 38, cursor: 'pointer',
          color: value ? 'var(--text)' : 'var(--faint)',
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <span style={{
        position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
        color: 'var(--faint)', pointerEvents: 'none', display: 'grid', placeItems: 'center',
      }}>
        <Icon.Chevron size={15} />
      </span>
    </div>
  )
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const btn: React.CSSProperties = {
    width: 38, height: 38, borderRadius: 10, border: '1px solid var(--border-strong)',
    background: 'var(--surface)', color: 'var(--text-soft)', display: 'grid', placeItems: 'center',
    fontSize: 20, lineHeight: 0, cursor: 'pointer',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button type="button" className="pf-step" style={btn} onClick={() => onChange(Math.max(0, value - 1))} aria-label="Decrease">−</button>
      <span style={{ minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <button type="button" className="pf-step" style={btn} onClick={() => onChange(value + 1)} aria-label="Increase">+</button>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button" role="switch" aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        width: 46, height: 27, borderRadius: 999, border: 'none', padding: 3, flexShrink: 0,
        background: on ? 'var(--accent)' : 'var(--border-strong)',
        transition: 'background 200ms ease', cursor: 'pointer', display: 'flex',
        justifyContent: on ? 'flex-end' : 'flex-start', alignItems: 'center',
      }}
    >
      <span style={{
        width: 21, height: 21, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'all 200ms ease',
      }} />
    </button>
  )
}

type IconName = keyof typeof Icon

function ToggleRow({ icon, title, desc, on, onChange }: {
  icon?: IconName; title: string; desc?: string; on: boolean; onChange: (v: boolean) => void
}) {
  const C = icon ? Icon[icon] : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderTop: '1px solid var(--border)' }}>
      {C && <span style={{ color: 'var(--muted)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><C size={19} /></span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        {desc && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{desc}</div>}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  )
}

function Section({ icon, title, subtitle, children, id }: {
  icon: IconName; title: string; subtitle?: string; children: React.ReactNode; id?: string
}) {
  const C = Icon[icon]
  return (
    <section id={id} style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
      padding: '26px 28px', boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, marginBottom: 22 }}>
        <span style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          display: 'grid', placeItems: 'center',
          background: 'var(--accent-tint)', color: 'var(--accent)',
        }}>
          <C size={19} />
        </span>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)' }}>{title}</h2>
          {subtitle && <p style={{ margin: '3px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }

const actionBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface)',
  border: '1px solid var(--border-strong)', color: 'var(--text-soft)',
  padding: '11px 16px', borderRadius: 11, fontSize: 14, fontWeight: 600,
  fontFamily: 'var(--font-body)', cursor: 'pointer',
}

// ── Profile UI ↔ DB mapping ──────────────────────────────────────────────────
// UI form keys (camelCase) ↔ DB columns (snake_case) — keeps the design's
// state shape intact while persisting to the schema from migration 0003.

interface FormState {
  fullName: string
  preferredName: string
  dob: string
  language: string
  relationship: string
  dependents: number
  living: string
  state: string
  employment: string
  occupation: string
  study: string
  emailNotif: boolean
  assessmentUpd: boolean
  programAlerts: boolean
  improveData: boolean
}

function fromDb(db: UserProfile): FormState {
  return {
    fullName: db.full_name ?? '',
    preferredName: db.preferred_name ?? '',
    dob: db.dob ?? '',
    language: db.language ?? 'English',
    relationship: db.relationship ?? '',
    dependents: db.dependents ?? 0,
    living: db.living ?? '',
    state: db.state ?? '',
    employment: db.employment ?? '',
    occupation: db.occupation ?? '',
    study: db.study ?? '',
    emailNotif: db.email_notif,
    assessmentUpd: db.assessment_upd,
    programAlerts: db.program_alerts,
    improveData: db.improve_data,
  }
}

function toDb(key: keyof FormState, value: unknown): Partial<UserProfile> {
  switch (key) {
    case 'fullName':       return { full_name: (value as string) || null }
    case 'preferredName':  return { preferred_name: (value as string) || null }
    case 'dob':            return { dob: (value as string) || null }
    case 'language':       return { language: value as string }
    case 'relationship':   return { relationship: (value as string) || null }
    case 'dependents':     return { dependents: value as number }
    case 'living':         return { living: (value as string) || null }
    case 'state':          return { state: (value as string) || null }
    case 'employment':     return { employment: (value as string) || null }
    case 'occupation':     return { occupation: (value as string) || null }
    case 'study':          return { study: (value as string) || null }
    case 'emailNotif':     return { email_notif: value as boolean }
    case 'assessmentUpd':  return { assessment_upd: value as boolean }
    case 'programAlerts':  return { program_alerts: value as boolean }
    case 'improveData':    return { improve_data: value as boolean }
  }
}

// ── Delete-account confirm modal ──────────────────────────────────────────────

function DeleteConfirm({ onClose, onConfirm, busy }: {
  onClose: () => void; onConfirm: () => void; busy: boolean
}) {
  return (
    <ModalWrapper onClose={onClose} label="Delete account">
      {(handleClose) => (
        <>
          <button className="modal-x" aria-label="Close" onClick={handleClose}><Icon.X size={18} /></button>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
            <span style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              display: 'grid', placeItems: 'center',
              background: 'color-mix(in srgb, #b4452f 13%, transparent)', color: '#b4452f',
            }}>
              <Icon.Trash size={21} />
            </span>
            <div style={{ flex: 1, paddingTop: 2 }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                Delete your account?
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>This can&apos;t be undone.</p>
            </div>
          </div>
          <p style={{ margin: '0 0 22px', fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-soft)' }}>
            This permanently removes your profile, saved conversations and assessment history.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="modal-btn ghost" onClick={handleClose} disabled={busy}>Keep my account</button>
            <button
              className="modal-btn primary danger"
              style={{ background: '#b4452f', borderColor: '#b4452f' }}
              onClick={() => { onConfirm() }}
              disabled={busy}
            >
              {busy ? 'Deleting…' : 'Delete account'}
            </button>
          </div>
        </>
      )}
    </ModalWrapper>
  )
}

// ── Profile skeleton ─────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 26px' }}>
      {[0, 1, 2, 3].map((section) => (
        <div key={section} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '22px 24px', marginBottom: 14,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <SkeletonText width="38%" style={{ height: 16, marginBottom: 20 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SkeletonBlock height={42} />
            <SkeletonBlock height={42} />
            <div style={{ display: 'flex', gap: 12 }}>
              <SkeletonBlock height={42} style={{ flex: 1 }} />
              <SkeletonBlock height={42} style={{ flex: 1 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function ProfilePage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const { toasts, addToast, dismiss } = useToasts()

  const [signInOpen, setSignInOpen] = useState(false)
  const [form, setForm] = useState<FormState>(() => fromDb({
    ...DEFAULT_PROFILE,
    full_name: null, preferred_name: null, dob: null,
    relationship: null, living: null, state: null,
    employment: null, occupation: null, study: null,
  }))
  const [loaded, setLoaded] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingPatchRef = useRef<Partial<UserProfile>>({})

  // ── Load profile on mount (signed-in users only) ───────────────────────────
  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoaded(true); return }
    void (async () => {
      try {
        const res = await fetch('/api/profile')
        if (!res.ok) throw new Error(`profile GET ${res.status}`)
        const data = (await res.json()) as UserProfile
        setForm(fromDb(data))
      } catch (err) {
        console.error('profile load failed', err)
        addToast({ title: "Couldn't load your profile", message: 'Please try refreshing.' })
      } finally {
        setLoaded(true)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading])

  // ── Scroll to section from URL hash ────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return
    const hash = window.location.hash.slice(1)
    if (hash) {
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [loaded])

  // ── Debounced PATCH on each `set()` ────────────────────────────────────────
  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (!user) return  // guest mode — UI works, doesn't persist

    Object.assign(pendingPatchRef.current, toDb(key, value))
    setSaveState('saving')

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const patch = pendingPatchRef.current
      pendingPatchRef.current = {}
      try {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) throw new Error(`PATCH ${res.status}`)
        setSaveState('saved')
      } catch (err) {
        console.error('profile save failed', err)
        setSaveState('error')
        addToast({ title: "Couldn't save changes", message: 'Your changes are still in this tab — try again in a moment.' })
      }
    }, 600)
  }

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }, [])

  async function exportData() {
    try {
      addToast({ title: 'Export started', message: "We're preparing your data — you'll get an email shortly." })
      const res = await fetch('/api/account/export', { method: 'POST' })
      if (!res.ok) throw new Error(`export ${res.status}`)
    } catch (err) {
      console.error('export failed', err)
      addToast({ title: "Couldn't start export", message: 'Please try again in a moment.' })
    }
  }

  async function confirmDelete() {
    setDeleteBusy(true)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (!res.ok) throw new Error(`delete ${res.status}`)
      await createClient().auth.signOut()
      router.push('/')
    } catch (err) {
      console.error('delete failed', err)
      addToast({ title: "Couldn't delete your account", message: 'Please try again.' })
    } finally {
      setDeleteBusy(false)
      setDeleteOpen(false)
    }
  }

  function onBack() { router.back() }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: 'radial-gradient(1200px 620px at 50% -8%, var(--bg-grad) 0%, transparent 70%), var(--bg)',
      color: 'var(--text)', fontFamily: 'var(--font-body)',
    }}>
      {/* Header — back arrow */}
      <header style={{ display: 'flex', alignItems: 'center', padding: '18px 22px', flexShrink: 0 }}>
        <button onClick={onBack} aria-label="Back" className="menu-trigger" style={{
          width: 38, height: 38, borderRadius: 11, border: 'none', background: 'transparent',
          color: 'var(--text-soft)', display: 'grid', placeItems: 'center', cursor: 'pointer',
        }}>
          <Icon.ChevronLeft size={19} />
        </button>
      </header>

      <div style={{ flex: 1 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 26px 120px' }}>

          <div style={{ marginBottom: 26 }}>
            <h1 style={{
              margin: 0, fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700,
              letterSpacing: '-0.03em', color: 'var(--text)',
            }}>
              Your profile
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--muted)', maxWidth: 520, lineHeight: 1.5 }}>
              The more we know, the better we can match you — and the fewer questions we&apos;ll need to ask. Everything here is optional and private to you.
            </p>
          </div>

          {/* Guest banner */}
          {!authLoading && !user && (
            <div style={{
              padding: '14px 18px', marginBottom: 18, borderRadius: 14,
              background: 'var(--accent-tint)',
              border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, flex: 1, minWidth: 200 }}>
                Sign in to save your answers across visits. Your changes here will be lost when you close the tab.
              </span>
              <button onClick={() => setSignInOpen(true)} className="modal-btn primary" style={{ fontSize: 13.5, padding: '8px 16px' }}>
                Sign in
              </button>
            </div>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {!loaded ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION.base, ease: EASE.standard }}
              >
                <ProfileSkeleton />
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: DURATION.base, ease: EASE.standard }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                  <Section id="profile" icon="User" title="Personal information" subtitle="Helps us greet you and tailor language.">
                    <div style={grid2}>
                      <Field label="Full name">
                        <TextInput value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="e.g. Jordan Nguyen" />
                      </Field>
                      <Field label="Preferred name" hint="What we'll call you in conversation.">
                        <TextInput value={form.preferredName} onChange={(e) => set('preferredName', e.target.value)} placeholder="e.g. Jordan" />
                      </Field>
                      <Field label="Date of birth">
                        <TextInput type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} />
                      </Field>
                      <Field label="Preferred language">
                        <Select value={form.language} onChange={(v) => set('language', v)} options={LANGUAGES} />
                      </Field>
                    </div>
                  </Section>

                  <Section icon="Users" title="Household" subtitle="Many programs depend on who you live with.">
                    <div style={grid2}>
                      <Field label="Relationship status">
                        <Select value={form.relationship} onChange={(v) => set('relationship', v)} placeholder="Select…" options={RELATIONSHIPS} />
                      </Field>
                      <Field label="Number of dependents">
                        <Stepper value={form.dependents} onChange={(v) => set('dependents', v)} />
                      </Field>
                      <Field label="Living arrangement">
                        <Select value={form.living} onChange={(v) => set('living', v)} placeholder="Select…" options={LIVING} />
                      </Field>
                      <Field label="State / territory">
                        <Select value={form.state} onChange={(v) => set('state', v)} placeholder="Select…" options={AU_STATES} />
                      </Field>
                    </div>
                  </Section>

                  <Section icon="Briefcase" title="Employment" subtitle="Used to check work-related payments and concessions.">
                    <div style={grid2}>
                      <Field label="Employment status">
                        <Select value={form.employment} onChange={(v) => set('employment', v)} placeholder="Select…" options={EMPLOYMENT} />
                      </Field>
                      <Field label="Occupation">
                        <TextInput value={form.occupation} onChange={(e) => set('occupation', e.target.value)} placeholder="e.g. Carer, Nurse, Student" />
                      </Field>
                      <Field label="Study status">
                        <Select value={form.study} onChange={(v) => set('study', v)} placeholder="Select…" options={STUDY} />
                      </Field>
                    </div>
                  </Section>

                  <Section id="notifications" icon="Bell" title="Communication preferences" subtitle="Choose what you hear about, and how often.">
                    <ToggleRow icon="User" title="Email notifications" desc="Account and security messages." on={form.emailNotif} onChange={(v) => set('emailNotif', v)} />
                    <ToggleRow icon="Gauge" title="Assessment updates" desc="When new programs match your situation." on={form.assessmentUpd} onChange={(v) => set('assessmentUpd', v)} />
                    <ToggleRow icon="Shield" title="Government program alerts" desc="Changes to programs you may be eligible for." on={form.programAlerts} onChange={(v) => set('programAlerts', v)} />
                  </Section>

                  <Section id="privacy" icon="Lock" title="Privacy & data" subtitle="You're in control of your information.">
                    <ToggleRow icon="Sparkle" title="Use my data to improve recommendations" desc="Lets Benefits.AI personalise your matches. Never sold or shared." on={form.improveData} onChange={(v) => set('improveData', v)} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                      <button
                        type="button"
                        className="pf-action"
                        style={actionBtn}
                        onClick={user ? exportData : () => setSignInOpen(true)}
                        disabled={!user}
                        title={user ? 'Email a copy of your data' : 'Sign in required'}
                      >
                        <Icon.Download size={17} /> Export my data
                      </button>
                      <button
                        type="button"
                        className="pf-action danger"
                        style={{ ...actionBtn, color: '#b4452f', borderColor: 'color-mix(in srgb, #b4452f 28%, var(--border-strong))' }}
                        onClick={user ? () => setDeleteOpen(true) : () => setSignInOpen(true)}
                        disabled={!user}
                        title={user ? 'Permanently delete your account' : 'Sign in required'}
                      >
                        <Icon.Trash size={17} /> Delete account
                      </button>
                    </div>
                  </Section>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Sticky save indicator + Done */}
      {user && (
        <div style={{
          position: 'sticky', bottom: 0, flexShrink: 0,
          background: 'var(--bg)', padding: '14px 26px',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
            <span style={{
              fontSize: 13, marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 6,
              color: saveState === 'saved' ? '#1f8a5b'
                  : saveState === 'error' ? '#b4452f'
                  : 'var(--faint)',
              transition: 'color 200ms ease',
            }}>
              {saveState === 'saving' && (
                <><span className="disc-spin" style={{ width: 13, height: 13 }} /> Saving…</>
              )}
              {saveState === 'saved' && (
                <><Icon.Check size={15} /> All changes saved</>
              )}
              {saveState === 'error' && (
                <>Couldn&apos;t save. Try again.</>
              )}
              {saveState === 'idle' && 'Changes save automatically.'}
            </span>
            <button onClick={onBack} className="ghost-btn" style={{
              background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text-soft)',
              padding: '10px 18px', borderRadius: 11, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}>
              Done
            </button>
          </div>
        </div>
      )}

      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
      {deleteOpen && (
        <DeleteConfirm
          onClose={() => setDeleteOpen(false)}
          onConfirm={confirmDelete}
          busy={deleteBusy}
        />
      )}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
