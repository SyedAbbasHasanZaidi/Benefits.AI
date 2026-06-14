'use client'

/**
 * EligibilityMeter — water-fill eligibility gauge.
 * ---------------------------------------------------------------------------
 * TypeScript port of `eligibility-meter/EligibilityMeter.jsx`. Behaviour is
 * identical to the original: the fill is driven by the `height` prop via a
 * `clip-path: inset(...)` reveal (NOT by sizing the element with external CSS
 * height), to sidestep the percentage-height resolution quirk of
 * absolutely-positioned boxes documented in the README.
 *
 * Drop directly above the chat composer at 75% width:
 *   <div style={{ width: "75%", margin: "0 auto 12px" }}>
 *     <EligibilityMeter value={topMatch.percent} scheme={topMatch.name} />
 *   </div>
 *
 * Zero dependencies beyond React. Styles inject once on first mount.
 */

import { useEffect, useRef, useState } from 'react'

// ── Self-injected stylesheet ─────────────────────────────────────────────────

const STYLE_ID = 'eligibility-meter-styles'

const CSS = `
.em-root{position:relative;width:100%;border-radius:16px;overflow:hidden;
  background:var(--em-track,#eef0f4);border:1px solid var(--em-border,rgba(20,24,33,.10));
  box-shadow:inset 0 1px 2px rgba(20,24,33,.05);font-family:inherit;
  -webkit-user-select:none;user-select:none;}
.em-water{position:absolute;inset:0;
  transition:clip-path 900ms cubic-bezier(.22,.61,.36,1),background 400ms ease;
  background:linear-gradient(180deg,var(--em-c-top) 0%,var(--em-c-bot) 100%);}
.em-surface{position:absolute;left:0;width:200%;height:14px;pointer-events:none;
  transition:bottom 900ms cubic-bezier(.22,.61,.36,1),opacity 300ms ease;}
.em-wave{position:absolute;left:0;top:0;width:100%;height:14px;fill:var(--em-c-top);}
.em-wave-back{opacity:.5;animation:em-wave-x 7s linear infinite;}
.em-wave-front{opacity:1;animation:em-wave-x 4.2s linear infinite reverse;}
.em-still .em-wave{animation:none!important;}
@keyframes em-wave-x{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.em-content{position:absolute;inset:0;display:flex;align-items:center;
  justify-content:space-between;gap:12px;padding:0 18px;pointer-events:none;}
.em-left{display:flex;flex-direction:column;min-width:0;}
.em-over{font-size:10.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;
  color:var(--em-ink-soft,#6b7180);}
.em-scheme{font-size:15px;font-weight:600;letter-spacing:-.01em;color:var(--em-ink,#1a1f29);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  text-shadow:0 1px 2px rgba(255,255,255,.55);}
.em-right{display:flex;align-items:baseline;gap:5px;flex-shrink:0;
  text-shadow:0 1px 2px rgba(255,255,255,.55);}
.em-pct{font-size:26px;font-weight:700;letter-spacing:-.03em;color:var(--em-ink,#1a1f29);
  font-variant-numeric:tabular-nums;line-height:1;}
.em-pct-sym{font-size:14px;font-weight:700;color:var(--em-ink-soft,#6b7180);}
.em-tier{font-size:11px;font-weight:600;color:var(--em-tier);white-space:nowrap;}
@media (prefers-reduced-motion: reduce){.em-wave{animation:none!important}.em-water,.em-surface{transition:background 400ms ease}}
`

function injectStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = CSS
  document.head.appendChild(el)
}

// ── Wave SVG (periodic across viewBox 900; 200% width + translateX -50% loops) ──

const WAVE_PATH =
  'M0,5 C37.5,1 75,9 112.5,5 C150,1 187.5,9 225,5 C262.5,1 300,9 337.5,5 C375,1 412.5,9 450,5 C487.5,1 525,9 562.5,5 C600,1 637.5,9 675,5 C712.5,1 750,9 787.5,5 C825,1 862.5,9 900,5 L900,14 L0,14 Z'

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

type Tier = 'strong' | 'partial' | 'low'

function tierOf(v: number, th: { partial: number; strong: number }): Tier {
  if (v >= th.strong) return 'strong'
  if (v >= th.partial) return 'partial'
  return 'low'
}

const TIER_LABEL: Record<Tier, string> = {
  strong: 'Strong match',
  partial: 'Likely eligible',
  low: 'Low match',
}

function useCountUp(target: number, animated: boolean): number {
  const [n, setN] = useState(target)
  const raf = useRef(0)
  useEffect(() => {
    if (!animated) {
      setN(target)
      return
    }
    const from = n
    const start = performance.now()
    const dur = 850
    const ease = (p: number) => 1 - Math.pow(1 - p, 3)
    const tick = (t: number) => {
      const p = clamp((t - start) / dur, 0, 1)
      setN(Math.round(from + (target - from) * ease(p)))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, animated])
  return animated ? n : target
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface EligibilityMeterProps {
  /** 0–100. Eligibility % for the closest scheme. */
  value?: number
  /** Name of that closest scheme. Shows "Assessing…" if empty. */
  scheme?: string
  /** Small overline text. */
  label?: string
  /** Tank height in px. Drives the fill — NOT external CSS height. */
  height?: number
  /** Ripple + count-up. Respects prefers-reduced-motion. */
  animated?: boolean
  /** Auto colour by value (amber → accent → green). */
  colorByTier?: boolean
  /** Mid-tier / fixed colour. Pass your brand accent. */
  accent?: string
  /** Tier cut-offs. */
  thresholds?: { partial: number; strong: number }
  /** Show the big "NN%" readout. */
  showValue?: boolean
  /** Passed to the root element. */
  className?: string
  /** Merged into the root style. */
  style?: React.CSSProperties
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EligibilityMeter({
  value = 0,
  scheme = '',
  label = 'Closest match',
  height = 64,
  animated = true,
  colorByTier = true,
  accent = '#4f73c4',
  thresholds = { partial: 45, strong: 75 },
  showValue = true,
  className = '',
  style = {},
}: EligibilityMeterProps) {
  useEffect(injectStyles, [])
  const v = clamp(Math.round(value), 0, 100)
  const th = { ...{ partial: 45, strong: 75 }, ...thresholds }
  const tier = tierOf(v, th)
  const display = useCountUp(v, animated)

  const base = colorByTier
    ? (tier === 'strong' ? '#1f8a5b' : tier === 'partial' ? accent : '#c98a2e')
    : accent

  const vars = {
    '--em-c-top': base,
    '--em-c-bot': `color-mix(in srgb, ${base} 78%, #0b1220)`,
    '--em-tier': base,
    height,
    ...style,
  } as React.CSSProperties

  return (
    <div
      className={`em-root ${animated ? '' : 'em-still'} ${className}`}
      style={vars}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      aria-label={scheme ? `${label}: ${scheme}, ${v}% eligible` : `${v}% eligible`}
    >
      <div
        className="em-water"
        style={{ clipPath: `inset(${Math.max(0, height - (height * v) / 100)}px 0 0 0)` }}
      />
      <div
        className="em-surface"
        style={{ bottom: `${(height * v) / 100 - 7}px`, opacity: v < 2 ? 0 : 1 }}
      >
        <svg className="em-wave em-wave-back" viewBox="0 0 900 14" preserveAspectRatio="none" aria-hidden="true">
          <path d={WAVE_PATH} />
        </svg>
        <svg className="em-wave em-wave-front" viewBox="0 0 900 14" preserveAspectRatio="none" aria-hidden="true">
          <path d={WAVE_PATH} />
        </svg>
      </div>

      <div className="em-content">
        <div className="em-left">
          <span className="em-over">{label}</span>
          {scheme ? (
            <span className="em-scheme">{scheme}</span>
          ) : (
            <span className="em-scheme" style={{ opacity: 0.5 }}>Assessing…</span>
          )}
        </div>
        <div className="em-right">
          {showValue && (
            <>
              <span className="em-pct">{display}</span>
              <span className="em-pct-sym">%</span>
            </>
          )}
          <span className="em-tier" style={{ marginLeft: showValue ? 8 : 0 }}>
            {TIER_LABEL[tier]}
          </span>
        </div>
      </div>
    </div>
  )
}
