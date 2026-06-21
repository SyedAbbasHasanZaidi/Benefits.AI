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
// requestAnimationFrame. Continues running even after `streaming` flips false,
// so the closing flush of tokens from the LLM doesn't dump into the bubble.
// Lifted into MessageList so the parent knows when reveal is finished and can
// gate quick-reply chips behind it.
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
    // Message identity changed (new assistant turn) — reset state.
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

    // Animate to completion — runs regardless of `streaming` so the trailing
    // flush of tokens still plays out smoothly.
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

        // Adaptive speed: 26 cps baseline, up to 90 cps when the buffer is large
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
  const bottomRef = useRef<HTMLDivElement>(null)

  const visible = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
  const lastMsg = visible[visible.length - 1]
  const lastIsAssistant = lastMsg?.role === 'assistant'
  const streamingLast = isLoading && lastIsAssistant

  // Smooth-reveal the last assistant message only. Other messages render whole.
  const { displayed: lastDisplay, done: revealDone } = useSmoothReveal(
    lastIsAssistant ? lastMsg.content : '',
    lastIsAssistant ? lastMsg.id : undefined,
    streamingLast,
  )

  // Thinking indicator while waiting for the FIRST token of an assistant turn
  // (i.e. last message is still the user's). It unmounts the moment the
  // streaming assistant bubble appears.
  const showThinking = isLoading && lastMsg?.role === 'user'

  // Chips only render once the typewriter has finished AND streaming is done,
  // plus a 120ms breathing gap so the chips don't snap in the same frame as
  // the final typewriter character — gives the reader a beat to register the
  // end of the message before the reply options arrive.
  const chipsReady = lastIsAssistant && !isLoading && revealDone
  const [chipsVisible, setChipsVisible] = useState(false)
  useEffect(() => {
    if (!chipsReady) { setChipsVisible(false); return }
    const t = setTimeout(() => setChipsVisible(true), 120)
    return () => clearTimeout(t)
  }, [chipsReady])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lastDisplay, showGuidance, isLoading, chips.length])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '34px 0', minHeight: 0 }}>
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
