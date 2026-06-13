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
  scheme,
  status,
  missingVars = [],
  onAskMore,
  onAnswerInChat,
}: SchemeCardProps) {
  const [claimOpen, setClaimOpen] = useState(false)

  const borderColor =
    status === 'eligible'
      ? 'border-l-green-500'
      : status === 'needs_info'
        ? 'border-l-amber-500'
        : 'border-l-gray-600'

  const badgeBg =
    status === 'eligible'
      ? 'bg-green-900/40 text-green-400'
      : status === 'needs_info'
        ? 'bg-amber-900/40 text-amber-400'
        : 'bg-gray-800 text-gray-500'

  const badgeLabel =
    status === 'eligible' ? 'Eligible' : status === 'needs_info' ? 'Needs info' : 'Not eligible'

  if (status === 'ineligible') {
    return (
      <div className={`border-l-4 ${borderColor} rounded-r-lg bg-gray-900 px-4 py-3 opacity-50`}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">{scheme.name}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${badgeBg}`}>{badgeLabel}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`border-l-4 ${borderColor} rounded-r-lg bg-gray-900 px-4 py-4 space-y-3`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-100">{scheme.name}</p>
          <p className="text-xs text-gray-400">{scheme.agency}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${badgeBg}`}>{badgeLabel}</span>
      </div>

      {status === 'eligible' && (
        <>
          <p className="text-sm text-gray-300">{scheme.plain_description}</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setClaimOpen((o) => !o)}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
            >
              {claimOpen ? 'Hide steps ↑' : 'How to Claim ↓'}
            </button>
            <a
              href={scheme.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-green-800 px-3 py-1.5 text-xs text-green-100 hover:bg-green-700 transition-colors"
            >
              Go to {scheme.agency} →
            </a>
            {onAskMore && (
              <button
                onClick={() => onAskMore(scheme.id)}
                className="rounded-lg border border-blue-700 px-3 py-1.5 text-xs text-blue-400 hover:bg-blue-900/30 transition-colors"
              >
                Ask me more
              </button>
            )}
          </div>
          {claimOpen && (
            <div className="rounded-lg bg-gray-800 p-3 text-sm text-gray-300">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                How to claim
              </p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Visit the {scheme.agency} website or call 132 300</li>
                <li>Sign in or create a myGov account linked to Centrelink</li>
                <li>Submit a claim form — have your ID, income, and bank details ready</li>
              </ol>
            </div>
          )}
        </>
      )}

      {status === 'needs_info' && (
        <>
          <p className="text-sm text-gray-400">
            Still need:{' '}
            {missingVars.map((v) => MISSING_VAR_LABELS[v] ?? v).join(', ')}
          </p>
          {onAnswerInChat && (
            <button
              onClick={() =>
                onAnswerInChat(
                  `Tell me more about ${scheme.name} — what do you need to know?`,
                )
              }
              className="rounded-lg border border-amber-700 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-900/30 transition-colors"
            >
              Answer in chat →
            </button>
          )}
        </>
      )}
    </div>
  )
}
