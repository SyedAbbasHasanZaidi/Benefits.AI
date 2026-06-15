import React, { useEffect, useRef, useState } from 'react'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

// ── Smooth typewriter ────────────────────────────────────────────────────────
// The Vercel AI SDK delivers tokens in irregular chunks (sometimes 1 char,
// sometimes 20+, often followed by a flush of the remaining tokens when the
// stream closes). Rendering each chunk directly causes visible stutter, and
// the closing flush causes the whole tail to "dump" into the bubble at once.
//
// This hook buffers the target text and reveals it at a steady character rate
// via requestAnimationFrame. Critically, the animation continues running even
// after `streaming` flips false — it only stops once the displayed text has
// caught up to the target. That way the closing flush types out instead of
// appearing instantly.
//
// History-restored messages (which never streamed) skip the animation and
// show their full content immediately — tracked via `everStreamedRef`.
function useSmoothText(target: string, streaming: boolean): string {
  const [displayed, setDisplayed] = useState(streaming ? '' : target)
  const targetRef = useRef(target)
  targetRef.current = target

  // Latches true the moment streaming first turns on for this instance.
  // Stays true forever after — so finishing tokens still play out.
  const everStreamedRef = useRef(streaming)
  if (streaming) everStreamedRef.current = true

  useEffect(() => {
    // Never streamed (history restore) → just show full text, no animation.
    if (!everStreamedRef.current) {
      if (displayed !== target) setDisplayed(target)
      return
    }

    // If target diverged (new message replaced this one), reset.
    if (target.length < displayed.length || !target.startsWith(displayed)) {
      setDisplayed('')
    }

    // Animate to completion. Runs regardless of `streaming` — even after the
    // stream closes, we keep ticking until displayed catches up to target.
    let cancelled = false
    let lastTime: number | null = null

    const tick = (now: number) => {
      if (cancelled) return
      if (lastTime === null) lastTime = now
      const deltaMs = now - lastTime
      lastTime = now

      setDisplayed((prev) => {
        const targetNow = targetRef.current
        const buffered = targetNow.length - prev.length
        if (buffered <= 0) return prev

        // Adaptive speed: 26 cps baseline (≈ relaxed reading pace), up to 90 cps
        // only when the buffer gets very large so display never lags too far.
        const baseCps = 26
        const cps = Math.min(90, baseCps + buffered * 1.5)
        const charsToAdd = Math.max(1, Math.round((deltaMs / 1000) * cps))
        const nextLen = Math.min(targetNow.length, prev.length + charsToAdd)
        return targetNow.slice(0, nextLen)
      })

      requestAnimationFrame(tick)
    }

    const id = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, streaming])

  return displayed
}

// ── Minimal markdown renderer ────────────────────────────────────────────────
// Handles **bold**, *italic*, `code`, and line breaks. Avoids pulling in a
// full markdown library — the LLM only uses these four markers reliably.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  // Tokeniser: matches **bold**, *italic*, `code`, or plain text run.
  const re = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)/g
  let last = 0
  let m: RegExpExecArray | null
  let idx = 0

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push(<React.Fragment key={`${keyPrefix}-t${idx++}`}>{text.slice(last, m.index)}</React.Fragment>)
    }
    const tok = m[0]
    if (tok.startsWith('**')) {
      out.push(<strong key={`${keyPrefix}-b${idx++}`} style={{ fontWeight: 700, color: 'var(--text)' }}>{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('`')) {
      out.push(
        <code key={`${keyPrefix}-c${idx++}`} style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.92em',
          background: 'var(--bg)', padding: '1px 5px', borderRadius: 4,
        }}>{tok.slice(1, -1)}</code>,
      )
    } else {
      out.push(<em key={`${keyPrefix}-i${idx++}`}>{tok.slice(1, -1)}</em>)
    }
    last = m.index + tok.length
  }
  if (last < text.length) {
    out.push(<React.Fragment key={`${keyPrefix}-t${idx++}`}>{text.slice(last)}</React.Fragment>)
  }
  return out
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  return lines.map((line, i) => (
    <React.Fragment key={i}>
      {renderInline(line, `l${i}`)}
      {i < lines.length - 1 && <br />}
    </React.Fragment>
  ))
}

// ── Assistant avatar ─────────────────────────────────────────────────────────

function AssistantMark() {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 9, flexShrink: 0,
      display: 'grid', placeItems: 'center',
      background: 'var(--accent-tint)', color: 'var(--accent)',
      border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '-0.02em',
    }}>B</div>
  )
}

// ── Bubble ───────────────────────────────────────────────────────────────────

export function MessageBubble({ role, content, streaming }: MessageBubbleProps) {
  // Smooth typewriter for assistant bubbles only; user messages render instantly.
  const display = useSmoothText(content, role === 'assistant' && !!streaming)
  // Keep the caret visible while the typewriter is still catching up, even if
  // the underlying stream has already closed.
  const stillRevealing = role === 'assistant' && display.length < content.length

  if (role === 'user') {
    return (
      <div style={{ alignSelf: 'flex-end', maxWidth: '82%' }}>
        <div style={{
          background: 'var(--accent-tint)', color: 'var(--text)',
          border: '1px solid color-mix(in srgb, var(--accent) 16%, transparent)',
          padding: '12px 16px', borderRadius: '16px 16px 5px 16px',
          fontSize: 15.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {content}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <AssistantMark />
      <div style={{
        paddingTop: 3, fontSize: 15.5, lineHeight: 1.62,
        color: 'var(--text-soft)', flex: 1, minWidth: 0,
      }}>
        {renderMarkdown(display)}
        {(streaming || stillRevealing) && <span className="caret" />}
      </div>
    </div>
  )
}
