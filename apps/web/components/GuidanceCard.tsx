'use client'

import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/lib/animations'
import type { VariableGuidance } from '@/lib/orchestrator/guidance'

interface GuidanceCardProps {
  guidance: VariableGuidance
  onDismiss: () => void
}

export function GuidanceCard({ guidance, onDismiss }: GuidanceCardProps) {
  return (
    <motion.div
      style={{
        marginLeft: 44, maxWidth: 560,
        background: 'var(--accent-tint)',
        border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
        borderRadius: 14, padding: 18,
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: DURATION.base, ease: EASE.standard }}
    >
      <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.55, color: 'var(--text)' }}>
        {guidance.explanation}
      </p>

      <p style={{
        margin: '0 0 8px',
        fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--accent)',
      }}>
        Where to find this
      </p>

      <ul style={{ margin: '0 0 16px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {guidance.links.map((link) => (
          <li key={link.url}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--accent)', fontSize: 13.5, textDecoration: 'none',
                fontWeight: 500,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              → {link.label}
            </a>
          </li>
        ))}
      </ul>

      <button
        onClick={onDismiss}
        className="modal-btn primary"
        style={{ fontSize: 13.5, padding: '8px 16px' }}
      >
        Got it — I&apos;ll answer now
      </button>
    </motion.div>
  )
}
