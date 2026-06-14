'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/client'
import { SignInModal } from './SignInModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={20} height={20} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14 6-6 6 6 6" />
    </svg>
  )
}

function ArrowRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={16} height={16} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
    </svg>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid var(--border)' }}>
      <h2 style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
        {label}
      </h2>
    </div>
  )
}

function Section({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', marginBottom: 16, overflow: 'hidden' }}>
      <SectionHeader label={label} />
      <div style={{ padding: '0 20px' }}>{children}</div>
    </section>
  )
}

function LockedOverlay({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(to bottom, transparent 0%, var(--surface) 55%)',
      zIndex: 1,
    }}>
      <button onClick={onSignIn} className="modal-btn primary" style={{ fontSize: 13.5, padding: '9px 20px' }}>
        Sign in to unlock
      </button>
    </div>
  )
}

function Toggle({ label, description, checked, onChange, disabled = false }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: disabled ? 'var(--faint)' : 'var(--text)' }}>{label}</div>
        {description && <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 2 }}>{description}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', flexShrink: 0,
          cursor: disabled ? 'default' : 'pointer',
          background: checked && !disabled ? 'var(--accent)' : 'var(--border-strong)',
          transition: 'background 180ms ease', position: 'relative',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked && !disabled ? 23 : 3, width: 18, height: 18,
          borderRadius: '50%', background: '#fff', transition: 'left 180ms ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
        }} />
      </button>
    </div>
  )
}

function ResourceLink({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '14px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)',
        transition: 'color 140ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text)')}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{description}</div>
      </div>
      <span style={{ color: 'var(--accent)', flexShrink: 0 }}><ArrowRight /></span>
    </a>
  )
}

function HelpRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{value}</div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProfilePage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [signInOpen, setSignInOpen] = useState(false)
  const [emailNotifs, setEmailNotifs] = useState(false)
  const [weeklyDigest, setWeeklyDigest] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  const displayName = user?.user_metadata?.full_name as string | undefined
  const displayEmail = user?.email ?? ''

  // Scroll to section from URL hash
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) {
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [])

  async function handleSignOut() {
    await createClient().auth.signOut()
    router.push('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-body)' }}>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 56,
      }}>
        <button
          onClick={() => router.back()}
          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: '8px 0' }}
        >
          <ChevronLeft /> Back
        </button>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          Your account
        </span>
        {!isLoading && !user && (
          <button onClick={() => setSignInOpen(true)} className="modal-btn primary" style={{ fontSize: 13, padding: '7px 14px' }}>
            Sign in
          </button>
        )}
        {!isLoading && user && (
          <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: '#b4452f', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>
            Sign out
          </button>
        )}
      </header>

      {/* Content */}
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 48px' }}>

        {/* ── Profile ── */}
        <Section id="profile" label="Profile">
          <div style={{ position: 'relative' }}>
            {!user && !isLoading && (
              <div style={{ opacity: 0.4, pointerEvents: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 0 16px' }}>
                  <span style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--border-strong)', display: 'grid', placeItems: 'center', flexShrink: 0 }} />
                  <div>
                    <div style={{ width: 120, height: 14, background: 'var(--border-strong)', borderRadius: 6, marginBottom: 8 }} />
                    <div style={{ width: 180, height: 12, background: 'var(--border)', borderRadius: 6 }} />
                  </div>
                </div>
              </div>
            )}
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 0 16px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                  {initials(displayName ?? displayEmail).toUpperCase()}
                </span>
                <div>
                  {displayName && <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{displayName}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: 'var(--muted)', marginTop: 2 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1f8a5b', flexShrink: 0 }} />
                    {displayEmail}
                  </div>
                </div>
              </div>
            )}
            {!user && !isLoading && (
              <LockedOverlay onSignIn={() => setSignInOpen(true)} />
            )}
          </div>
          {user && (
            <div style={{ padding: '12px 0' }}>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                Profile editing is coming soon. Your conversations and results are saved to this account.
              </p>
            </div>
          )}
        </Section>

        {/* ── Notifications ── */}
        <Section id="notifications" label="Notification preferences">
          <div style={{ position: 'relative' }}>
            <div style={{ opacity: user ? 1 : 0.4, pointerEvents: user ? 'auto' : 'none' }}>
              <Toggle
                label="Email me my results"
                description="Get a summary of your eligible schemes after each session"
                checked={emailNotifs}
                onChange={setEmailNotifs}
                disabled={!user}
              />
              <Toggle
                label="Weekly benefits digest"
                description="Occasional updates when new schemes or changes are relevant to you"
                checked={weeklyDigest}
                onChange={setWeeklyDigest}
                disabled={!user}
              />
              <div style={{ height: 4 }} />
            </div>
            {!user && !isLoading && <LockedOverlay onSignIn={() => setSignInOpen(true)} />}
          </div>
        </Section>

        {/* ── Accessibility ── */}
        <Section id="accessibility" label="Accessibility">
          <Toggle
            label="Reduce motion"
            description="Minimise animations and transitions across the app"
            checked={reduceMotion}
            onChange={setReduceMotion}
          />
          <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Language</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
              Change your language from the selector on the home screen — top right corner.
            </div>
          </div>
          <div style={{ padding: '14px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Screen readers</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
              Compatible with VoiceOver (iOS/macOS) and NVDA/JAWS (Windows). All interactive elements are keyboard accessible.
            </div>
          </div>
        </Section>

        {/* ── Privacy ── */}
        <Section id="privacy" label="Privacy & data">
          <div style={{ position: 'relative' }}>
            <div style={{ opacity: user ? 1 : 0.4, pointerEvents: user ? 'auto' : 'none' }}>
              <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>Your data</div>
                <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                  We store your conversation history and eligibility profile. No data is shared with government agencies or third parties.
                </p>
                <button disabled style={{ background: 'none', border: '1px solid var(--border-strong)', borderRadius: 9, padding: '8px 14px', fontSize: 13.5, color: 'var(--text-soft)', cursor: 'not-allowed', opacity: 0.5 }}>
                  Download my data — coming soon
                </button>
              </div>
              <div style={{ padding: '14px 0' }}>
                <button disabled style={{ background: 'none', border: '1px solid #f0baba', borderRadius: 9, padding: '8px 14px', fontSize: 13.5, color: '#b4452f', cursor: 'not-allowed', opacity: 0.5 }}>
                  Delete account — coming soon
                </button>
              </div>
            </div>
            {!user && !isLoading && <LockedOverlay onSignIn={() => setSignInOpen(true)} />}
          </div>
        </Section>

        {/* ── Resources ── */}
        <Section id="resources" label="Resources">
          <ResourceLink
            title="Services Australia"
            description="Centrelink payments, Medicare, family assistance, aged care"
            href="https://www.servicesaustralia.gov.au"
          />
          <ResourceLink
            title="myGov"
            description="Access Centrelink, ATO, Medicare and more in one place"
            href="https://my.gov.au"
          />
          <ResourceLink
            title="Centrelink payment finder"
            description="Official tool to find which payments you may be entitled to"
            href="https://www.servicesaustralia.gov.au/centrelink"
          />
          <ResourceLink
            title="NSW Concessions Finder"
            description="State concessions for energy, transport, rates and more"
            href="https://www.service.nsw.gov.au/concessions"
          />
          <ResourceLink
            title="National Debt Helpline"
            description="Free financial counselling — 1800 007 007"
            href="https://ndh.org.au"
          />
          <ResourceLink
            title="Carer Gateway"
            description="Support services and payments for carers"
            href="https://www.carergateway.gov.au"
          />
          <ResourceLink
            title="NDIS — Am I eligible?"
            description="Check eligibility for the National Disability Insurance Scheme"
            href="https://www.ndis.gov.au/applying-access-ndis/am-i-eligible"
          />
          <ResourceLink
            title="MoneySmart"
            description="ASIC's free financial guidance and calculators"
            href="https://moneysmart.gov.au"
          />
          <div style={{ height: 4 }} />
        </Section>

        {/* ── Help ── */}
        <Section id="help" label="Help & support">
          <HelpRow
            label="Services Australia"
            value="Call 132 300 — Monday to Friday, 8am to 5pm local time"
          />
          <HelpRow
            label="Translating & Interpreting Service (TIS)"
            value="Call 131 450 — available 24 hours, 7 days, 160+ languages"
          />
          <HelpRow
            label="National Relay Service"
            value="For hearing or speech impairment — relay.services.com.au"
          />
          <div style={{ padding: '14px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>About Benefits.AI</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>
              Benefits.AI helps you explore what Australian government entitlements you may qualify for. It does not make formal eligibility determinations — the relevant government agency does.
            </div>
          </div>
        </Section>

      </main>

      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  )
}
