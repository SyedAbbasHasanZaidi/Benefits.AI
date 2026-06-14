'use client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatItem {
  id: string
  title: string
  ts: number
  status: string | null
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronLeft({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14 6-6 6 6 6" />
    </svg>
  )
}

function Plus({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function relTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.round(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d}d ago`
  const w = Math.round(d / 7)
  if (w < 5) return `${w}w ago`
  return `${Math.round(d / 30)}mo ago`
}

export function groupChats(list: ChatItem[]) {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const t0 = start.getTime(), day = 86400000
  const order = ['Today', 'Yesterday', 'Last 7 days', 'Earlier'] as const
  const buckets: Record<string, ChatItem[]> = { Today: [], Yesterday: [], 'Last 7 days': [], Earlier: [] }
  ;[...list].sort((a, b) => b.ts - a.ts).forEach((c) => {
    if (c.ts >= t0) buckets.Today.push(c)
    else if (c.ts >= t0 - day) buckets.Yesterday.push(c)
    else if (c.ts >= t0 - 7 * day) buckets['Last 7 days'].push(c)
    else buckets.Earlier.push(c)
  })
  return order.filter((k) => buckets[k].length).map((k) => ({ label: k, items: buckets[k] }))
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ChatHistoryProps {
  open: boolean
  onToggle: () => void
  chats: ChatItem[]
  activeId: string | null
  onSelect: (c: ChatItem) => void
  onNew: () => void
}

export function ChatHistory({ open, onToggle, chats, activeId, onSelect, onNew }: ChatHistoryProps) {
  const groups = groupChats(chats)

  return (
    <>
      <button
        className={`hist-tab${open ? ' open' : ''}`}
        aria-label={open ? 'Close conversation history' : 'Open conversation history'}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span style={{
          display: 'grid', placeItems: 'center',
          transform: open ? 'none' : 'rotate(180deg)',
          transition: 'transform 260ms cubic-bezier(.22,.61,.36,1)',
        }}>
          <ChevronLeft size={16} />
        </span>
      </button>

      <div className={`hist-scrim${open ? ' open' : ''}`} onClick={onToggle} aria-hidden="true" />

      <aside className={`hist-panel${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="hist-head">
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Your conversations
          </span>
          <button className="hist-new" onClick={onNew} aria-label="New conversation" title="New conversation">
            <Plus size={18} />
          </button>
        </div>

        <div className="hist-scroll">
          {groups.length === 0 && (
            <div style={{ padding: '30px 18px', textAlign: 'center', fontSize: 13.5, color: 'var(--faint)', lineHeight: 1.5 }}>
              No conversations yet. Start by telling us your situation.
            </div>
          )}
          {groups.map((g) => (
            <div key={g.label} style={{ marginBottom: 14 }}>
              <div className="hist-group-label">{g.label}</div>
              {g.items.map((c) => {
                const active = c.id === activeId
                return (
                  <button
                    key={c.id}
                    className={`hist-item${active ? ' active' : ''}`}
                    onClick={() => onSelect(c)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span className="hist-dot" style={{ background: c.status ? 'var(--accent)' : 'var(--border-strong)' }} />
                      <span className="hist-title">{c.title}</span>
                    </div>
                    <div className="hist-meta">
                      <span>{relTime(c.ts)}</span>
                      {c.status && <span className="hist-status">{c.status}</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </aside>
    </>
  )
}
