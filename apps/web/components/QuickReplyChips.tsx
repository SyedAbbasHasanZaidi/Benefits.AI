'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { DURATION, EASE } from '@/lib/animations'

interface QuickReplyChipsProps {
  chips: string[]
  onChipClick: (value: string) => void
}

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.05 } },
  exit:    { transition: { staggerChildren: 0.03, staggerDirection: -1 as const } },
}

const chipVariants = {
  hidden:  { opacity: 0, y: 10, scale: 0.96 },
  visible: { opacity: 1, y: 0,  scale: 1    },
  exit:    { opacity: 0,        scale: 0.9  },
}

export function QuickReplyChips({ chips, onChipClick }: QuickReplyChipsProps) {
  return (
    <AnimatePresence mode="wait">
      {chips.length > 0 && (
        <motion.div
          key={chips.join(',')}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 9, paddingLeft: 44 }}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {chips.map((chip) => {
            const isGuidance = chip === 'Not sure? →'
            return (
              <motion.button
                key={chip}
                onClick={() => onChipClick(chip)}
                className="prompt-pill"
                variants={chipVariants}
                transition={{ duration: DURATION.base, ease: EASE.standard }}
                whileTap={{ scale: 0.95 }}
                style={{
                  background: 'var(--surface)',
                  border: isGuidance ? '1px solid var(--accent)' : '1px solid var(--border-strong)',
                  color: isGuidance ? 'var(--accent)' : 'var(--text-soft)',
                  padding: '8px 14px', borderRadius: 999,
                  fontSize: 13.5, fontWeight: 500, boxShadow: 'var(--shadow-sm)',
                  cursor: 'pointer',
                }}
              >
                {chip}
              </motion.button>
            )
          })}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
