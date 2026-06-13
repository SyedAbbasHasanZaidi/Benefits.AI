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
  eligibility,
  schemes,
  open,
  onToggle,
  onAskMore,
  onAnswerInChat,
}: ResultsDrawerProps) {
  const schemeMap = new Map(schemes.map((s) => [s.id, s]))

  const eligibleCount = eligibility?.eligible.length ?? 0
  const needsInfoCount = eligibility?.needs_info.length ?? 0
  const ineligibleCount = eligibility?.ineligible.length ?? 0
  const total = eligibleCount + needsInfoCount + ineligibleCount

  if (total === 0) return null

  return (
    <div className="border-b border-gray-800 bg-gray-950">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-gray-900 transition-colors"
      >
        <div className="flex items-center gap-3">
          {eligibleCount > 0 && (
            <span className="flex items-center gap-1 text-green-400">
              <span>✓</span>
              <span>{eligibleCount} eligible</span>
            </span>
          )}
          {needsInfoCount > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <span>⚠</span>
              <span>{needsInfoCount} needs info</span>
            </span>
          )}
          {ineligibleCount > 0 && (
            <span className="flex items-center gap-1 text-gray-500">
              <span>✗</span>
              <span>{ineligibleCount} not eligible</span>
            </span>
          )}
        </div>
        <span className="text-gray-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="max-h-96 overflow-y-auto px-4 pb-4 space-y-3">
          {eligibility?.eligible.map((id) => {
            const scheme = schemeMap.get(id)
            if (!scheme) return null
            return (
              <SchemeCard
                key={id}
                scheme={scheme}
                status="eligible"
                onAskMore={onAskMore}
                onAnswerInChat={onAnswerInChat}
              />
            )
          })}
          {eligibility?.needs_info.map(({ schemeId, missingVars }) => {
            const scheme = schemeMap.get(schemeId)
            if (!scheme) return null
            return (
              <SchemeCard
                key={schemeId}
                scheme={scheme}
                status="needs_info"
                missingVars={missingVars}
                onAskMore={onAskMore}
                onAnswerInChat={onAnswerInChat}
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
