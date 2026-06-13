'use client'

interface QuickReplyChipsProps {
  chips: string[]
  onChipClick: (value: string) => void
}

export function QuickReplyChips({ chips, onChipClick }: QuickReplyChipsProps) {
  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 pl-10">
      {chips.map((chip) => {
        const isGuidance = chip === 'Not sure? →'
        return (
          <button
            key={chip}
            onClick={() => onChipClick(chip)}
            className={
              isGuidance
                ? 'rounded-full border border-blue-600 px-4 py-1.5 text-sm text-blue-400 hover:bg-blue-900/30 transition-colors'
                : 'rounded-full border border-gray-600 px-4 py-1.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors'
            }
          >
            {chip}
          </button>
        )
      })}
    </div>
  )
}
