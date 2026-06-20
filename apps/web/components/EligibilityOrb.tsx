'use client'

/**
 * EligibilityOrb — water-fill discovery orb beside the chat composer.
 * ---------------------------------------------------------------------------
 * TypeScript port of `chat-discovery-kit/EligibilityOrb.jsx`. Behaviour is
 * identical: fills with water based on proximity to the nearest eligible
 * scheme, turns light-green with a tick once eligible, and becomes clickable
 * as the entry point to the Results page.
 *
 * Size the orb via the `size` prop — NOT external CSS. The fill is computed
 * from `size`.
 *
 * Place it to the RIGHT of the chat input, vertically centred. The input
 * keeps its full width (do NOT shrink it). Anchor it absolutely off a
 * relative wrapper around the composer:
 *
 *   <div style={{ position: 'relative' }}>
 *     <div>{composer}</div>
 *     <div style={{ position: 'absolute', left: '100%', top: '50%',
 *                   transform: 'translateY(-50%)', marginLeft: 16 }}>
 *       <EligibilityOrb value={pct} eligible={n > 0} onClick={goToResults} />
 *     </div>
 *   </div>
 */

import { useEffect, useRef, useState } from 'react'

const STYLE_ID = 'eligibility-orb-styles'

const CSS = `
.eo-root{position:relative;border-radius:50%;overflow:hidden;flex:none;
  background:var(--eo-track,#eceef2);
  border:1.5px solid var(--eo-border,rgba(20,24,33,.14));
  box-shadow:inset 0 1px 1px rgba(255,255,255,.5);}
.eo-water{position:absolute;inset:0;
  transition:clip-path 850ms cubic-bezier(.22,.61,.36,1),background 450ms ease;
  background:linear-gradient(180deg,var(--eo-hi) 0%,var(--eo-base) 68%);}
.eo-surface{position:absolute;left:0;width:200%;pointer-events:none;
  transition:bottom 850ms cubic-bezier(.22,.61,.36,1),opacity 300ms ease;}
.eo-wave{position:absolute;left:0;top:0;width:100%;height:100%;fill:var(--eo-hi);
  transition:fill 450ms ease;}
.eo-wave-back{opacity:.5;animation:eo-wave-x 6s linear infinite;}
.eo-wave-front{opacity:1;animation:eo-wave-x 3.6s linear infinite reverse;}
.eo-still .eo-wave{animation:none!important;}
@keyframes eo-wave-x{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.eo-check{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;
  color:#fff;opacity:0;transform:scale(.6);
  transition:opacity 300ms ease 100ms,transform 300ms cubic-bezier(.34,1.4,.64,1) 100ms;}
.eo-check.on{opacity:1;transform:scale(1);}
.eo-btn{appearance:none;-webkit-appearance:none;background:none;border:none;padding:0;margin:0;
  display:inline-flex;border-radius:50%;outline:none;}
.eo-btn.clickable{cursor:pointer;}
.eo-btn.clickable .eo-root{transition:transform 180ms ease,box-shadow 220ms ease;}
.eo-btn.clickable:hover .eo-root{transform:scale(1.06);}
.eo-btn.clickable:active .eo-root{transform:scale(.96);}
.eo-btn.clickable:focus-visible .eo-root{box-shadow:0 0 0 3px var(--eo-ring,rgba(59,191,122,.4));}
.eo-ready{position:absolute;inset:0;border-radius:50%;pointer-events:none;
  box-shadow:0 0 0 0 var(--eo-ring,rgba(59,191,122,.45));animation:eo-pulse 2.4s ease-out infinite;}
@keyframes eo-pulse{0%{box-shadow:0 0 0 0 var(--eo-ring,rgba(59,191,122,.4))}70%,100%{box-shadow:0 0 0 9px rgba(59,191,122,0)}}
@media (prefers-reduced-motion: reduce){
  .eo-wave{animation:none!important}.eo-ready{animation:none!important}
}
`

const WAVE_PATH =
  'M0,5 C37.5,1 75,9 112.5,5 C150,1 187.5,9 225,5 C262.5,1 300,9 337.5,5 C375,1 412.5,9 450,5 C487.5,1 525,9 562.5,5 C600,1 637.5,9 675,5 C712.5,1 750,9 787.5,5 C825,1 862.5,9 900,5 L900,14 L0,14 Z'

function injectStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = CSS
  document.head.appendChild(el)
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export interface EligibilityOrbProps {
  /** Proximity 0–100. Overridden to 100 when `eligible`. */
  value?: number
  /** `true` → full + green + tick + clickable. */
  eligible?: boolean
  /** Fires only when eligible (click / Enter / Space). */
  onClick?: () => void
  /** Diameter in px. Size via this prop — NOT external CSS. */
  size?: number
  /** Fluid fill + ripple. Respects prefers-reduced-motion. */
  animated?: boolean
  /** Water colour while building. Pass your brand accent. */
  accent?: string
  /** Water colour once eligible. */
  eligibleColor?: string
  /** Tooltip / aria-label override. */
  title?: string
  className?: string
  style?: React.CSSProperties
}

export default function EligibilityOrb({
  value = 0,
  eligible = false,
  onClick,
  size = 46,
  animated = true,
  accent = '#4f73c4',
  eligibleColor = '#3bbf7a',
  title,
  className = '',
  style = {},
}: EligibilityOrbProps) {
  useEffect(injectStyles, [])

  // Two-phase eligible transition: fill to 100% first (850ms clip-path
  // animation), then switch to green. Without this, the color and fill start
  // simultaneously and the water snaps green before it's full.
  const prevEligibleRef = useRef(eligible)
  const [greenPhase, setGreenPhase] = useState(eligible)

  useEffect(() => {
    if (eligible && !prevEligibleRef.current) {
      // Just became eligible — keep accent color while fill animates up
      setGreenPhase(false)
      const t = setTimeout(() => setGreenPhase(true), 920)
      prevEligibleRef.current = true
      return () => clearTimeout(t)
    }
    if (!eligible) {
      prevEligibleRef.current = false
      setGreenPhase(false)
    }
  }, [eligible])

  const v = eligible ? 100 : clamp(Math.round(value), 0, 100)
  const color = greenPhase ? eligibleColor : accent
  const waveH = Math.max(6, Math.round(size * 0.2))
  const fillPx = (size * v) / 100
  const clickable = eligible && typeof onClick === 'function'

  const label = title || (eligible
    ? 'You qualify for at least one program — view your results'
    : 'Discovering your eligibility')

  const vars = {
    width: size,
    height: size,
    '--eo-base': color,
    '--eo-hi': `color-mix(in srgb, ${color} 80%, #ffffff)`,
    '--eo-ring': `color-mix(in srgb, ${eligibleColor} 45%, transparent)`,
    ...style,
  } as React.CSSProperties

  const orb = (
    <div className={`eo-root ${animated ? '' : 'eo-still'}`} style={vars}>
      <div
        className="eo-water"
        style={{ clipPath: `inset(${Math.max(0, size - fillPx)}px 0 0 0)` }}
      />
      <div
        className="eo-surface"
        style={{ height: waveH, bottom: `${fillPx - waveH / 2}px`, opacity: v < 2 ? 0 : 1 }}
      >
        <svg className="eo-wave eo-wave-back" viewBox="0 0 900 14" preserveAspectRatio="none" aria-hidden="true">
          <path d={WAVE_PATH} />
        </svg>
        <svg className="eo-wave eo-wave-front" viewBox="0 0 900 14" preserveAspectRatio="none" aria-hidden="true">
          <path d={WAVE_PATH} />
        </svg>
      </div>
      <div className={`eo-check ${greenPhase ? 'on' : ''}`} aria-hidden="true">
        <svg
          width={Math.round(size * 0.48)}
          height={Math.round(size * 0.48)}
          viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.6"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="m5 12.5 4.5 4.5L19 7" />
        </svg>
      </div>
      {clickable && greenPhase && <span className="eo-ready" aria-hidden="true" />}
    </div>
  )

  if (clickable) {
    return (
      <button
        type="button"
        className={`eo-btn clickable ${className}`}
        onClick={onClick}
        aria-label={label}
        title={label}
      >
        {orb}
      </button>
    )
  }

  return (
    <div
      className={`eo-btn ${className}`}
      role="meter"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}
      aria-label={label} title={label}
    >
      {orb}
    </div>
  )
}
