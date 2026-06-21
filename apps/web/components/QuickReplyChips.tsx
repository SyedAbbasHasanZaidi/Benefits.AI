'use client'

interface QuickReplyChipsProps {
  chips: string[]
  onChipClick: (value: string) => void
}

export function QuickReplyChips({ chips, onChipClick }: QuickReplyChipsProps) {
  if (chips.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, paddingLeft: 44 }}>
      {chips.map((chip, i) => {
        const isGuidance = chip === 'Not sure? →'
        return (
          <button
            key={chip}
            onClick={() => onChipClick(chip)}
            className="prompt-pill"
            style={{
              '--i': i,
              animation: 'chip-in 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
              animationDelay: `calc(var(--i) * 55ms)`,
              background: 'var(--surface)',
              border: isGuidance ? '1px solid var(--accent)' : '1px solid var(--border-strong)',
              color: isGuidance ? 'var(--accent)' : 'var(--text-soft)',
              padding: '8px 14px', borderRadius: 999,
              fontSize: 13.5, fontWeight: 500, boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
            } as React.CSSProperties}
          >
            {chip}
          </button>
        )
      })}
    </div>
  )
}
