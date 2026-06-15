'use client'

/**
 * ThinkingIndicator — mini-fireworks "AI is generating" loader.
 * ---------------------------------------------------------------------------
 * TypeScript port of `chat-discovery-kit/ThinkingIndicator.jsx`. Render in the
 * message thread only while the assistant is generating, then unmount the
 * moment the response begins streaming.
 */

import { useEffect } from 'react'

const STYLE_ID = 'thinking-indicator-styles'

const CSS = `
.ti-wrap{display:inline-flex;align-items:center;gap:10px;}
.ti-fw{position:relative;flex:none;}
.ti-fw span{position:absolute;left:50%;top:50%;width:3px;height:3px;border-radius:50%;
  background:var(--ti-color,#4f73c4);animation:ti-burst 1.3s ease-out infinite;}
.ti-fw .b{animation-delay:.65s;background:var(--ti-spark,#e0903a);}
@keyframes ti-burst{
  0%{transform:translate(-50%,-50%) rotate(var(--a)) translateY(1px) scale(.3);opacity:0}
  18%{opacity:1}
  100%{transform:translate(-50%,-50%) rotate(var(--a)) translateY(-11px) scale(.25);opacity:0}}
.ti-label{font-size:14.5px;color:var(--ti-label,#6b7180);animation:ti-pulse 1.5s ease-in-out infinite;}
@keyframes ti-pulse{0%,100%{opacity:.55}50%{opacity:1}}
.ti-still .ti-fw span,.ti-still .ti-label{animation:none!important;}
@media (prefers-reduced-motion: reduce){.ti-fw span{animation-duration:2.6s}.ti-label{animation:none}}
`

function injectStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = CSS
  document.head.appendChild(el)
}

const BURST = [0, 45, 90, 135, 180, 225, 270, 315]
const SPARKS = [22, 112, 202, 292]

export interface ThinkingIndicatorProps {
  /** Text beside the burst. Pass `""` to hide. */
  label?: string
  /** Primary particle colour. Pass your accent. */
  color?: string
  /** Secondary (off-beat) particle colour. */
  spark?: string
  /** Burst diameter in px. */
  size?: number
  /** Respects prefers-reduced-motion. */
  animated?: boolean
  className?: string
  style?: React.CSSProperties
}

export default function ThinkingIndicator({
  label = 'Thinking…',
  color = '#4f73c4',
  spark = '#e0903a',
  size = 22,
  animated = true,
  className = '',
  style = {},
}: ThinkingIndicatorProps) {
  useEffect(injectStyles, [])
  const vars = {
    '--ti-color': color,
    '--ti-spark': spark,
    ...style,
  } as React.CSSProperties

  return (
    <div
      className={`ti-wrap ${animated ? '' : 'ti-still'} ${className}`}
      role="status"
      aria-label={label || 'Generating response'}
      style={vars}
    >
      <span className="ti-fw" style={{ width: size, height: size }} aria-hidden="true">
        {BURST.map((a) => <span key={a} style={{ ['--a' as string]: `${a}deg` } as React.CSSProperties} />)}
        {SPARKS.map((a) => <span key={`b${a}`} className="b" style={{ ['--a' as string]: `${a}deg` } as React.CSSProperties} />)}
      </span>
      {label ? <span className="ti-label">{label}</span> : null}
    </div>
  )
}
