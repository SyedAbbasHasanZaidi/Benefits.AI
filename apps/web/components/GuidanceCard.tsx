'use client'

import type { VariableGuidance } from '@/lib/orchestrator/guidance'

interface GuidanceCardProps {
  guidance: VariableGuidance
  onDismiss: () => void
}

export function GuidanceCard({ guidance, onDismiss }: GuidanceCardProps) {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-blue-500/30 bg-blue-950/40 p-4 text-sm">
      <p className="mb-3 text-gray-200">{guidance.explanation}</p>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-400">
        Where to find this
      </p>
      <ul className="mb-4 space-y-1">
        {guidance.links.map((link) => (
          <li key={link.url}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
            >
              → {link.label}
            </a>
          </li>
        ))}
      </ul>
      <button
        onClick={onDismiss}
        className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-100 hover:bg-gray-600 transition-colors"
      >
        Got it — I'll answer now
      </button>
    </div>
  )
}
