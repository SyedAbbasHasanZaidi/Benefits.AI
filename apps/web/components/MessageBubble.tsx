import React from 'react'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

// ── Minimal markdown renderer ────────────────────────────────────────────────
// Handles **bold**, *italic*, `code`, and line breaks.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
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
// Presentational only. The typewriter lives in MessageList so it can gate
// quick-reply chips on the reveal actually finishing.

export function MessageBubble({ role, content, streaming }: MessageBubbleProps) {
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
        {renderMarkdown(content)}
        {streaming && <span className="caret" />}
      </div>
    </div>
  )
}
