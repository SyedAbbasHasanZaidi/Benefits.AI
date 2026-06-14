interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

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
        color: 'var(--text-soft)', whiteSpace: 'pre-wrap', flex: 1, minWidth: 0,
      }}>
        {content}
        {streaming && <span className="caret" />}
      </div>
    </div>
  )
}
