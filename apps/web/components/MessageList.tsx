'use client'

import { useEffect, useRef, useState } from 'react'
import type { Message } from 'ai'
import { GuidanceCard } from './GuidanceCard'
import { MessageBubble } from './MessageBubble'
import { QuickReplyChips } from './QuickReplyChips'
import ThinkingIndicator from './ThinkingIndicator'
import type { VariableGuidance } from '@/lib/orchestrator/guidance'

interface MessageListProps {
  messages: Message[]
  chips: string[]
  guidance: VariableGuidance | null
  showGuidance: boolean
  isLoading: boolean
  onChipClick: (value: string) => void
  onDismissGuidance: () => void
}

// ── Smooth typewriter ────────────────────────────────────────────────────────
// Reveals streamed assistant text at a steady character rate via
// requestAnimationFrame. Continues running after `streaming` flips false so
// the trailing flush of tokens still plays out smoothly.
//
// Speed design: 48–72 cps narrow range prevents the burst–stall pattern that
// makes streaming feel choppy. Rather than aggressively chasing the LLM's
// burst rate (which causes visible speed changes), we let the buffer absorb
// variance and render at a pace close to comfortable reading speed.
function useSmoothReveal(
  target: string,
  messageId: string | undefined,
  streaming: boolean,
): { displayed: string; done: boolean } {
  const [displayed, setDisplayed] = useState(streaming ? '' : target)
  const targetRef = useRef(target)
  targetRef.current = target
  const everStreamedRef = useRef(streaming)
  const lastIdRef = useRef<string | undefined>(messageId)

  if (streaming) everStreamedRef.current = true

  useEffect(() => {
    // Message identity changed (new assistant turn) — reset.
    if (messageId !== lastIdRef.current) {
      lastIdRef.current = messageId
      everStreamedRef.current = streaming
      setDisplayed(streaming ? '' : target)
      if (!streaming) return
    }

    // Restored from history (never streamed) — show full text immediately.
    if (!everStreamedRef.current) {
      if (displayed !== target) setDisplayed(target)
      return
    }

    // Target shrank or diverged → reset (shouldn't happen mid-stream).
    if (target.length < displayed.length || !target.startsWith(displayed)) {
      setDisplayed('')
    }

    let cancelled = false
    let lastTime: number | null = null

    const tick = (now: number) => {
      if (cancelled) return
      if (lastTime === null) lastTime = now
      const deltaMs = Math.min(now - lastTime, 50) // clamp to 50ms to survive tab switches
      lastTime = now

      setDisplayed((prev) => {
        const targetNow = targetRef.current
        const buffered = targetNow.length - prev.length
        if (buffered <= 0) return prev

        // Narrow speed range: 48 cps baseline, gentle ramp up to 72 cps when
        // the buffer exceeds 18 chars. This absorbs LLM token bursts without
        // producing the fast-then-slow rhythm that feels choppy.
        const BASE_CPS = 48
        const MAX_CPS  = 72
        const cps = Math.min(MAX_CPS, BASE_CPS + Math.max(0, buffered - 18) * 1.3)
        const charsToAdd = Math.max(1, Math.round((deltaMs / 1000) * cps))
        return targetNow.slice(0, prev.length + charsToAdd)
      })

      requestAnimationFrame(tick)
    }

    const id = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, streaming, messageId])

  return { displayed, done: displayed.length >= target.length }
}

/** Assistant avatar shown next to the thinking indicator. */
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

export function MessageList({
  messages,
  chips,
  guidance,
  showGuidance,
  isLoading,
  onChipClick,
  onDismissGuidance,
}: MessageListProps) {
  // Ref to the scrollable container — used for instant scroll during streaming.
  const scrollableRef = useRef<HTMLDivElement>(null)
  // Ref to a sentinel div at the very bottom — used for smooth scroll on events.
  const bottomRef = useRef<HTMLDivElement>(null)

  const visible = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
  const lastMsg = visible[visible.length - 1]
  const lastIsAssistant = lastMsg?.role === 'assistant'
  const streamingLast = isLoading && lastIsAssistant

  const { displayed: lastDisplay, done: revealDone } = useSmoothReveal(
    lastIsAssistant ? lastMsg.content : '',
    lastIsAssistant ? lastMsg.id : undefined,
    streamingLast,
  )

  const showThinking = isLoading && lastMsg?.role === 'user'

  const chipsReady = lastIsAssistant && !isLoading && revealDone

  // 120ms breathing gap — chips appear slightly after the last typewriter
  // character so the reader has a beat to register the end of the message.
  const [chipsVisible, setChipsVisible] = useState(false)
  useEffect(() => {
    if (!chipsReady) { setChipsVisible(false); return }
    const t = setTimeout(() => setChipsVisible(true), 120)
    return () => clearTimeout(t)
  }, [chipsReady])

  // ── Scroll strategy ────────────────────────────────────────────────────────
  // During streaming: assign scrollTop directly (instant, no animation) so the
  // view stays pinned to the bottom without fighting a smooth-scroll animation.
  // Calling scrollIntoView('smooth') 60× per second restarts the browser's
  // scroll animation each frame, which produces jitter rather than smooth motion.
  //
  // Discrete events (new message, chips appearing): one smooth scroll.
  const revealing = !revealDone || isLoading

  useEffect(() => {
    if (!revealing) return
    const el = scrollableRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lastDisplay, revealing])

  useEffect(() => {
    if (revealing) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [visible.length, showGuidance, chipsVisible, revealing])

  return (
    <div
      ref={scrollableRef}
      style={{ flex: 1, overflowY: 'auto', padding: '34px 0', minHeight: 0 }}
    >
      <div style={{
        maxWidth: 720, margin: '0 auto', padding: '0 26px',
        display: 'flex', flexDirection: 'column', gap: 26,
      }}>
        {visible.map((m, i) => {
          const isLast = i === visible.length - 1 && m.role === 'assistant'
          const content = isLast ? lastDisplay : m.content
          const stillRevealing = isLast && !revealDone
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <MessageBubble
                role={m.role as 'user' | 'assistant'}
                content={content}
                streaming={isLast && (isLoading || stillRevealing)}
              />
              {isLast && chipsVisible && (
                showGuidance && guidance ? (
                  <GuidanceCard guidance={guidance} onDismiss={onDismissGuidance} />
                ) : (
                  <QuickReplyChips chips={chips} onChipClick={onChipClick} />
                )
              )}
            </div>
          )
        })}

        {showThinking && (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <AssistantMark />
            <ThinkingIndicator color="var(--accent)" />
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
