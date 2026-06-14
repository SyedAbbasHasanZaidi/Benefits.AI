'use client'

import { useState } from 'react'

export interface SchemeMetadata {
  id: string
  name: string
  tier: string
  agency: string
  apply_url: string
  delivery_channel: string
  plain_description: string
}

export type SchemeStatus = 'eligible' | 'needs_info' | 'ineligible'

interface SchemeCardProps {
  scheme: SchemeMetadata
  status: SchemeStatus
  missingVars?: string[]
  onAskMore?: (schemeId: string) => void
  onAnswerInChat?: (question: string) => void
}

const MISSING_VAR_LABELS: Record<string, string> = {
  is_australian_resident: 'whether you are an Australian resident',
  age: 'your age',
  annual_income: 'your annual income',
  state: 'your state',
  council_lga: 'your council area',
  tenure_type: 'whether you rent or own',
  rent_paid_fortnightly: 'your fortnightly rent',
  number_of_children: 'number of children',
  youngest_child_age: 'age of your youngest child',
  has_partner: 'whether you have a partner',
  employment_status: 'your employment status',
  hours_worked_per_week: 'hours worked per week',
  has_disability: 'whether you have a disability',
  is_carer: 'whether you are a carer',
  has_financial_hardship: 'whether you have financial hardship',
  uses_life_support_equipment: 'whether you use life support equipment',
}

export function SchemeCard({
  scheme, status, missingVars = [], onAskMore, onAnswerInChat,
}: SchemeCardProps) {
  const [claimOpen, setClaimOpen] = useState(false)

  const accentColor =
    status === 'eligible' ? '#1f8a5b'
    : status === 'needs_info' ? '#9a7a2e'
    : 'var(--faint)'

  const accentBg =
    status === 'eligible' ? 'color-mix(in srgb, #1f8a5b 14%, transparent)'
    : status === 'needs_info' ? 'color-mix(in srgb, #9a7a2e 16%, transparent)'
    : 'var(--bg)'

  const badgeLabel =
    status === 'eligible' ? 'Eligible'
    : status === 'needs_info' ? 'Needs info'
    : 'Not eligible'

  if (status === 'ineligible') {
    return (
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderLeft: '4px solid var(--border-strong)', borderRadius: '0 12px 12px 0',
        padding: '12px 16px', opacity: 0.55,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <span style={{ fontSize: 14, color: 'var(--muted)' }}>{scheme.name}</span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
          background: 'var(--bg)', color: 'var(--faint)',
        }}>{badgeLabel}</span>
      </div>
    )
  }

  return (
    <div className="res-card" style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `4px solid ${accentColor}`, borderRadius: '0 12px 12px 0',
      padding: '14px 16px', boxShadow: 'var(--shadow-sm)',
      display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'border-color 180ms ease, box-shadow 180ms ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em', color: 'var(--text)' }}>
            {scheme.name}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--muted)' }}>{scheme.agency}</p>
        </div>
        <span style={{
          flexShrink: 0, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
          background: accentBg, color: accentColor,
        }}>{badgeLabel}</span>
      </div>

      {status === 'eligible' && (
        <>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-soft)' }}>
            {scheme.plain_description}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              onClick={() => setClaimOpen((o) => !o)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border-strong)',
                color: 'var(--text-soft)', padding: '7px 13px', borderRadius: 9,
                fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              {claimOpen ? 'Hide steps' : 'How to claim'}
            </button>
            <a
              href={scheme.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="res-claim"
              style={{
                background: 'var(--accent)', color: 'var(--accent-ink)',
                padding: '7px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              Go to {scheme.agency} →
            </a>
            {onAskMore && (
              <button
                onClick={() => onAskMore(scheme.id)}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--accent)', padding: '7px 13px', borderRadius: 9,
                  fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Ask me more
              </button>
            )}
          </div>
          {claimOpen && (
            <div style={{
              background: 'var(--bg)', borderRadius: 10, padding: 12, fontSize: 13, color: 'var(--text-soft)',
            }}>
              <p style={{ margin: '0 0 6px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
                How to claim
              </p>
              <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li>Visit the {scheme.agency} website or call 132 300</li>
                <li>Sign in or create a myGov account linked to Centrelink</li>
                <li>Submit a claim form — have your ID, income and bank details ready</li>
              </ol>
            </div>
          )}
        </>
      )}

      {status === 'needs_info' && (
        <>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
            Still need: {missingVars.map((v) => MISSING_VAR_LABELS[v] ?? v).join(', ')}
          </p>
          {onAnswerInChat && (
            <button
              onClick={() => onAnswerInChat(`Tell me more about ${scheme.name} — what do you need to know?`)}
              style={{
                alignSelf: 'flex-start',
                background: 'transparent', border: '1px solid #9a7a2e',
                color: '#9a7a2e', padding: '7px 13px', borderRadius: 9,
                fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Answer in chat →
            </button>
          )}
        </>
      )}
    </div>
  )
}
