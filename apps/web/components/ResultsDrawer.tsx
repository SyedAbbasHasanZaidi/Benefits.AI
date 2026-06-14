'use client'

import type { EligibilityResult } from '@/lib/orchestrator/turn'
import { SchemeCard, type SchemeMetadata } from './SchemeCard'

interface ResultsDrawerProps {
  eligibility: EligibilityResult | null
  schemes: SchemeMetadata[]
  open: boolean
  onToggle: () => void
  onAskMore: (schemeId: string) => void
  onAnswerInChat: (question: string) => void
}

export function ResultsDrawer({
  eligibility, schemes, open, onToggle, onAskMore, onAnswerInChat,
}: ResultsDrawerProps) {
  const schemeMap = new Map(schemes.map((s) => [s.id, s]))

  const eligibleCount = eligibility?.eligible.length ?? 0
  const needsInfoCount = eligibility?.needs_info.length ?? 0
  const ineligibleCount = eligibility?.ineligible.length ?? 0
  const total = eligibleCount + needsInfoCount + ineligibleCount

  if (total === 0) return null

  return (
    <div style={{
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
    }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '12px 26px', background: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: 'var(--font-body)',
          transition: 'background 140ms ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13.5, fontWeight: 500 }}>
          {eligibleCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1f8a5b' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1f8a5b' }} />
              {eligibleCount} eligible
            </span>
          )}
          {needsInfoCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9a7a2e' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#9a7a2e' }} />
              {needsInfoCount} needs info
            </span>
          )}
          {ineligibleCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--faint)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border-strong)' }} />
              {ineligibleCount} not eligible
            </span>
          )}
        </div>
        <span style={{ color: 'var(--faint)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          maxHeight: 400, overflowY: 'auto', padding: '0 26px 18px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {eligibility?.eligible.map((id) => {
            const scheme = schemeMap.get(id)
            if (!scheme) return null
            return (
              <SchemeCard
                key={id} scheme={scheme} status="eligible"
                onAskMore={onAskMore} onAnswerInChat={onAnswerInChat}
              />
            )
          })}
          {eligibility?.needs_info.map(({ schemeId, missingVars }) => {
            const scheme = schemeMap.get(schemeId)
            if (!scheme) return null
            return (
              <SchemeCard
                key={schemeId} scheme={scheme} status="needs_info"
                missingVars={missingVars} onAskMore={onAskMore} onAnswerInChat={onAnswerInChat}
              />
            )
          })}
          {eligibility?.ineligible.map((id) => {
            const scheme = schemeMap.get(id)
            if (!scheme) return null
            return <SchemeCard key={id} scheme={scheme} status="ineligible" />
          })}
        </div>
      )}
    </div>
  )
}
