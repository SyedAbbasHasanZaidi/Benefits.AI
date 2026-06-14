'use client'

import { useEffect, useState } from 'react'

// ── Icons ─────────────────────────────────────────────────────────────────────

const SearchIcon = (s = 16) => (
  <svg viewBox="0 0 24 24" fill="none" width={s} height={s} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
  </svg>
)
const HomeIcon = (s = 16) => (
  <svg viewBox="0 0 24 24" fill="none" width={s} height={s} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" />
  </svg>
)
const UsersIcon = (s = 16) => (
  <svg viewBox="0 0 24 24" fill="none" width={s} height={s} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3 3 0 0 1 0 5.6" /><path d="M17.5 19a5.5 5.5 0 0 0-3-4.9" />
  </svg>
)
const ShieldIcon = (s = 16) => (
  <svg viewBox="0 0 24 24" fill="none" width={s} height={s} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z" />
    <path d="m9.2 11.6 1.9 1.9 3.7-3.8" />
  </svg>
)
const CoinsIcon = (s = 16) => (
  <svg viewBox="0 0 24 24" fill="none" width={s} height={s} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" />
    <path d="M15 12.5c2.5-.2 6-1.2 6-2.9" /><path d="M9 15v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
  </svg>
)
const CheckIcon = (s = 17) => (
  <svg viewBox="0 0 24 24" fill="none" width={s} height={s} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 4.5 4.5L19 7" />
  </svg>
)
const SparkleIcon = (s = 21) => (
  <svg viewBox="0 0 24 24" fill="none" width={s} height={s} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3.5c.6 3.9 1.6 4.9 5.5 5.5-3.9.6-4.9 1.6-5.5 5.5-.6-3.9-1.6-4.9-5.5-5.5 3.9-.6 4.9-1.6 5.5-5.5Z" />
    <path d="M18.5 14.5c.3 1.7.7 2.1 2.5 2.5-1.8.3-2.2.8-2.5 2.5-.3-1.7-.7-2.1-2.5-2.5 1.8-.4 2.2-.8 2.5-2.5Z" />
  </svg>
)

const DISCOVERY_STEPS = [
  { icon: SearchIcon, label: 'Searching federal programs' },
  { icon: HomeIcon,   label: 'Checking state & territory concessions' },
  { icon: UsersIcon,  label: 'Reviewing your household eligibility' },
  { icon: ShieldIcon, label: 'Matching against support programs' },
  { icon: CoinsIcon,  label: 'Calculating potential entitlements' },
]

interface DiscoveryProps {
  /** When true, advance steps to completion. Drive this off the assess promise. */
  done: boolean
}

/**
 * Loader shown while /api/eligibility/assess is in flight. Steps animate
 * forward on a timer (UX feedback) but the final transition is gated on the
 * `done` prop — so the loader stays until the real assessment resolves.
 */
export function Discovery({ done }: DiscoveryProps) {
  const [active, setActive] = useState(0)

  // Cosmetic step progression — 700ms per step, holds at last step until `done`
  useEffect(() => {
    const per = 700
    const timers = DISCOVERY_STEPS.slice(0, -1).map((_, i) =>
      setTimeout(() => setActive(i + 1), per * (i + 1)),
    )
    return () => { timers.forEach(clearTimeout) }
  }, [])

  // When the assessment promise resolves, mark all steps done
  useEffect(() => {
    if (done) setActive(DISCOVERY_STEPS.length)
  }, [done])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <span className="disc-orb" style={{
            width: 40, height: 40, borderRadius: 13, display: 'grid', placeItems: 'center',
            background: 'var(--accent-tint)', color: 'var(--accent)',
          }}>
            {SparkleIcon(21)}
          </span>
        </div>
        <h2 style={{
          textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 24, letterSpacing: '-0.025em', margin: '14px 0 6px', color: 'var(--text)',
        }}>
          Working on your behalf
        </h2>
        <p style={{ textAlign: 'center', fontSize: 14.5, color: 'var(--muted)', margin: '0 0 30px' }}>
          Reviewing your situation against hundreds of programs.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {DISCOVERY_STEPS.map((s, i) => {
            const state = i < active ? 'done' : i === active ? 'now' : 'wait'
            return (
              <div key={s.label} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 12,
                background: state === 'now' ? 'var(--surface)' : 'transparent',
                boxShadow: state === 'now' ? 'var(--shadow-sm)' : 'none',
                border: state === 'now' ? '1px solid var(--border)' : '1px solid transparent',
                opacity: state === 'wait' ? 0.45 : 1,
                transition: 'opacity 300ms ease, background 300ms ease, box-shadow 300ms ease',
              }}>
                <span style={{
                  width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                  display: 'grid', placeItems: 'center',
                  background: state === 'done' ? 'color-mix(in srgb, #1f8a5b 14%, transparent)' : 'var(--bg)',
                  color: state === 'done' ? '#1f8a5b' : state === 'now' ? 'var(--accent)' : 'var(--faint)',
                  transition: 'all 300ms ease',
                }}>
                  {state === 'done'
                    ? CheckIcon(17)
                    : state === 'now'
                      ? <span className="disc-spin" />
                      : s.icon(16)}
                </span>
                <span style={{
                  fontSize: 14.5,
                  fontWeight: state === 'wait' ? 500 : 600,
                  color: state === 'wait' ? 'var(--muted)' : 'var(--text)',
                }}>
                  {s.label}{state === 'now' ? '…' : ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
