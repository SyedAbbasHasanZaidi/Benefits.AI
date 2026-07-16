export const DURATION = {
  fast:   0.15,
  base:   0.25,
  slow:   0.4,
  slower: 0.6,
} as const

// EASE.standard matches the existing brand cubic-bezier used throughout globals.css
export const EASE = {
  standard: [0.22, 0.61, 0.36, 1] as const,
  exit:     [0.4, 0, 1, 1] as const,
  spring:   { type: 'spring' as const, stiffness: 400, damping: 30 },
} as const

export const variants = {
  fadeUp: {
    hidden:  { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 },
  },
  fadeIn: {
    hidden:  { opacity: 0 },
    visible: { opacity: 1 },
  },
  stagger: {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.06 } },
  },
  staggerFast: {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.05 } },
  },
} as const
