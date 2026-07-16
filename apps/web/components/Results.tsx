'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { DURATION, EASE, variants } from '@/lib/animations'
import type { Program, ResultsData } from '@/lib/eligibility/types'

// ── Icons ─────────────────────────────────────────────────────────────────────

const Icon = {
  Sparkle: ({ size = 21 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5c.6 3.9 1.6 4.9 5.5 5.5-3.9.6-4.9 1.6-5.5 5.5-.6-3.9-1.6-4.9-5.5-5.5 3.9-.6 4.9-1.6 5.5-5.5Z" />
      <path d="M18.5 14.5c.3 1.7.7 2.1 2.5 2.5-1.8.3-2.2.8-2.5 2.5-.3-1.7-.7-2.1-2.5-2.5 1.8-.4 2.2-.8 2.5-2.5Z" />
    </svg>
  ),
  Search: ({ size = 16 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
    </svg>
  ),
  TrendUp: ({ size = 16 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" />
    </svg>
  ),
  Coins: ({ size = 16 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" />
      <path d="M15 12.5c2.5-.2 6-1.2 6-2.9" /><path d="M9 15v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
    </svg>
  ),
  ArrowRight: ({ size = 15 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
    </svg>
  ),
  Plus: ({ size = 15 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
}

// ── Count-up hook (matches design's useCountUp) ───────────────────────────────

function useCountUp(target: number, duration = 1100) {
  const [n, setN] = useState(target)
  useEffect(() => {
    let raf: number
    const start = performance.now()
    const ease = (p: number) => 1 - Math.pow(1 - p, 3)
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      setN(Math.round(ease(p) * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return n
}

// ── Confidence badge ──────────────────────────────────────────────────────────

const CONF = {
  strong: { label: 'Strong match',    color: '#1f8a5b',     bg: 'color-mix(in srgb, #1f8a5b 12%, transparent)' },
  likely: { label: 'Likely eligible', color: 'var(--accent)', bg: 'var(--accent-tint)' },
  info:   { label: 'Needs more info', color: '#9a7a2e',     bg: 'color-mix(in srgb, #9a7a2e 13%, transparent)' },
} as const

function ConfBadge({ conf }: { conf: Program['conf'] }) {
  const c = CONF[conf]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600,
      color: c.color, background: c.bg, padding: '4px 10px', borderRadius: 999, letterSpacing: '0.01em',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }} />
      {c.label}
    </span>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

function Stat({ value, label, prefix, icon: IconC }: {
  value: number; label: string; prefix?: string; icon: React.FC<{ size?: number }>
}) {
  const n = useCountUp(value, 1100)
  return (
    <div style={{ flex: 1, minWidth: 150, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', marginBottom: 8 }}>
        <IconC size={16} />
        <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '0.02em' }}>{label}</span>
      </div>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em',
        color: 'var(--text)', fontVariantNumeric: 'tabular-nums',
      }}>
        {prefix || ''}{n.toLocaleString()}
      </div>
    </div>
  )
}

// ── Claim-pathway modal ──────────────────────────────────────────────────────

import { ModalWrapper } from './ModalWrapper'

function ProgramModal({ program, onClose, onRefineProfile }: {
  program: Program
  onClose: () => void
  onRefineProfile: () => void
}) {
  const isInfo = program.conf === 'info'

  return (
    <ModalWrapper onClose={onClose} label={program.name}>
      {(handleClose) => (
        <>
          <button className="modal-x" aria-label="Close" onClick={handleClose}>
            <svg viewBox="0 0 24 24" fill="none" width={18} height={18} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m18 6-12 12M6 6l12 12" />
            </svg>
          </button>

          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
              {program.name}
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>
              {program.agency}{program.value > 0 ? ` · ~$${program.value.toLocaleString()}/yr` : ''}
            </p>
          </div>

          <p style={{ margin: '0 0 16px', fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-soft)' }}>
            {program.desc}
          </p>

          {isInfo ? (
            <p style={{ margin: '0 0 22px', fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-soft)' }}>
              We need a little more detail to confirm your eligibility and estimate a value. Answering a few quick questions will sharpen this match.
            </p>
          ) : (
            <>
              {/* matchedCriteria from the audit trail */}
              {program.matchedCriteria && program.matchedCriteria.length > 0 && (
                <>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
                    Why you may qualify
                  </p>
                  <ul style={{ margin: '0 0 20px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {program.matchedCriteria.map((c, i) => (
                      <li key={i} style={{ display: 'flex', gap: 9, fontSize: 13.5, color: 'var(--text-soft)' }}>
                        <span style={{ color: '#1f8a5b', flexShrink: 0, paddingTop: 2 }}>
                          <svg viewBox="0 0 24 24" fill="none" width={14} height={14} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m5 12 4.5 4.5L19 7" />
                          </svg>
                        </span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <ol style={{ margin: '0 0 22px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { title: 'Check your details', body: 'Confirm the information we matched against this program.' },
                  { title: 'Gather supporting documents', body: 'ID, income details and any relevant statements.' },
                  { title: 'Lodge your claim', body: `Submit directly with ${program.agency} via the official channel.` },
                ].map((s, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--accent-tint)', color: 'var(--accent)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{i + 1}</span>
                    <div style={{ paddingTop: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{s.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 1, lineHeight: 1.45 }}>{s.body}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            {isInfo ? (
              <>
                <motion.button
                  className="modal-btn ghost"
                  onClick={handleClose}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  Close
                </motion.button>
                <motion.button
                  className="modal-btn primary"
                  onClick={() => { handleClose(); onRefineProfile() }}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  Refine in profile
                </motion.button>
              </>
            ) : (
              <>
                <motion.button
                  className="modal-btn ghost"
                  onClick={handleClose}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  Close
                </motion.button>
                <motion.a
                  href={program.claimUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="modal-btn primary"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  Go to official claim site
                </motion.a>
              </>
            )}
          </div>
        </>
      )}
    </ModalWrapper>
  )
}

// ── Results page ──────────────────────────────────────────────────────────────

interface ResultsProps {
  data: ResultsData
  onRestart: () => void
  /** Optional — back to conversation. If omitted, back goes to landing. */
  onBack?: () => void
}

function ChevronLeft({ size = 19 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14 6-6 6 6 6" />
    </svg>
  )
}

export function Results({ data, onRestart, onBack }: ResultsProps) {
  const router = useRouter()
  const [openProgram, setOpenProgram] = useState<Program | null>(null)

  function handleBack() {
    if (onBack) onBack()
    else router.push('/')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* Local header — borderless back arrow + "New assessment", matches landing's transparent header style */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', flexShrink: 0, background: 'transparent',
      }}>
        <motion.button
          onClick={handleBack}
          aria-label="Back to chat"
          className="menu-trigger"
          style={{
            width: 38, height: 38, borderRadius: 11, border: 'none', background: 'transparent',
            color: 'var(--text-soft)', display: 'grid', placeItems: 'center', cursor: 'pointer',
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.93 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <ChevronLeft size={19} />
        </motion.button>
        <motion.button
          onClick={onRestart}
          className="new-chat-btn"
          style={{
            display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface)',
            border: '1px solid var(--border-strong)', color: 'var(--text-soft)',
            padding: '8px 14px', borderRadius: 10, fontSize: 13.5, fontWeight: 500,
            boxShadow: 'var(--shadow-sm)', cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          <Icon.Plus size={15} /> New assessment
        </motion.button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 26px 80px' }}>

          {/* Hero banner */}
          <motion.div
            style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderRadius: 16,
              background: 'var(--accent-tint)',
              border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
            }}
            variants={variants.fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ duration: DURATION.slow, ease: EASE.standard }}
          >
            <span style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              display: 'grid', placeItems: 'center',
              background: 'var(--accent)', color: '#fff',
            }}>
              <Icon.Sparkle size={21} />
            </span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                We&apos;ve identified {data.programs.length} program{data.programs.length === 1 ? '' : 's'}
                {data.total > 0 ? ` worth approximately $${data.total.toLocaleString()}/year` : ''}.
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--text-soft)', marginTop: 2 }}>
                You may qualify for additional support — answer a few more questions to refine these.
              </div>
            </div>
          </motion.div>

          {/* Stat tiles */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 16 }}>
            <Stat value={data.programs.length} label="Programs found" icon={Icon.Search} />
            <Stat value={data.total} label="Est. annual value" prefix="$" icon={Icon.TrendUp} />
            <Stat value={data.claimable} label="Claim opportunities" icon={Icon.Coins} />
          </div>

          <h3 style={{
            fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600,
            letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)',
            margin: '36px 0 14px',
          }}>
            What we found for you
          </h3>

          {/* Program cards */}
          <motion.div
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            variants={variants.stagger}
            initial="hidden"
            animate="visible"
          >
            {data.programs.map((pr, i) => (
              <motion.div
                key={(pr.schemeId ?? pr.name) + i}
                variants={variants.fadeUp}
                transition={{ duration: DURATION.slow, ease: EASE.standard }}
                whileTap={{ scale: 0.99 }}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 16, padding: '18px 20px', boxShadow: 'var(--shadow-sm)',
                  transition: 'box-shadow 200ms ease, border-color 200ms ease',
                  cursor: 'default',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>{pr.name}</span>
                      <ConfBadge conf={pr.conf} />
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--faint)', margin: '3px 0 8px' }}>{pr.agency}</div>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text-soft)', maxWidth: 460 }}>
                      {pr.desc}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {pr.value > 0 ? (
                      <>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                          ${pr.value.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>est. / year</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12.5, color: 'var(--faint)', maxWidth: 90 }}>Value depends on details</div>
                    )}
                  </div>
                </div>

                <div style={{
                  display: 'flex', justifyContent: 'flex-end',
                  marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)',
                }}>
                  <button onClick={() => setOpenProgram(pr)} style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: 'transparent', border: 'none', color: 'var(--accent)',
                    fontSize: 13.5, fontWeight: 600, padding: '4px 2px', cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}>
                    {pr.conf === 'info' ? 'Tell us more' : 'View claim pathway'}
                    <Icon.ArrowRight size={15} />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Disclaimer */}
          <p style={{
            marginTop: 32, padding: '14px 18px', borderRadius: 12,
            background: 'var(--surface)', border: '1px solid var(--border)',
            fontSize: 12.5, lineHeight: 1.55, color: 'var(--muted)',
          }}>
            <strong style={{ color: 'var(--text-soft)' }}>Indicative guidance, not a determination.</strong> Benefits.AI matches you against published rules to help you explore what to claim — the relevant agency makes the final eligibility decision when you apply.
          </p>
        </div>
      </div>

      {openProgram && (
        <ProgramModal
          program={openProgram}
          onClose={() => setOpenProgram(null)}
          onRefineProfile={() => router.push('/profile#profile')}
        />
      )}
    </div>
  )
}
