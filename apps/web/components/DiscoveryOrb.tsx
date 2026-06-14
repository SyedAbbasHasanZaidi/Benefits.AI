'use client'

import { useEffect, useState } from 'react'

interface DiscoveryOrbProps {
  /** 0..1 — proximity to the closest eligible scheme */
  level: number
  /** Once true, orb turns green and invites interaction */
  eligible: boolean
  /** Click handler — typically routes to the Results stage */
  onClick: () => void
}

/**
 * A fluid-filled sphere that visualises how close the user is to qualifying
 * for at least one scheme. The water level rises as the rules engine reports
 * decreasing missing_variables; when an eligibility match exists, the orb
 * transitions to a green state with a subtle celebrate animation.
 *
 * Design constraints (from the brief):
 *  - Stays in a corner, never blocks reading
 *  - No percentages, no progress bars — pure fluid metaphor
 *  - Subtle, alive, non-disruptive
 *  - Empty when no signal, green once at least one match is verified
 */
export function DiscoveryOrb({ level, eligible, onClick }: DiscoveryOrbProps) {
  // Clamp + ease the level — gives a touch of softness to changes
  const clamped = Math.max(0, Math.min(1, level))

  // When eligible, force full level for the visual reward
  const visual = eligible ? 1 : clamped

  // Track whether the orb has ever been engaged — used to gate the tooltip wording
  const [seenEligible, setSeenEligible] = useState(false)
  useEffect(() => { if (eligible) setSeenEligible(true) }, [eligible])

  // Hide the orb entirely until we've gathered any signal at all
  if (visual <= 0.05 && !eligible) {
    return null
  }

  const tooltip = eligible
    ? 'You qualify for one or more — view results'
    : seenEligible
      ? 'Eligibility changed — see what matches'
      : 'Getting closer to your first match'

  // translateY: 100% = empty, 0% = full. We translate by (1 - level) * 100%.
  const fluidY = `translateY(${(1 - visual) * 100}%)`

  return (
    <button
      type="button"
      aria-label={tooltip}
      onClick={onClick}
      className={`orb-shell${eligible ? ' eligible' : ' idle'}`}
    >
      <div className="orb-fluid" style={{ transform: fluidY }}>
        <div className="orb-wave" />
        <div className="orb-wave b" />
      </div>
      <div className="orb-pulse" aria-hidden="true" />
      <span className="orb-tooltip">{tooltip}</span>
    </button>
  )
}
