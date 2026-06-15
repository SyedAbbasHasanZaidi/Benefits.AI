'use client'

import { useEffect, useRef } from 'react'
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

/** Assistant avatar shown next to the thinking indicator (matches bubble layout). */
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, showGuidance, isLoading, chips.length])

  const visible = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
  const lastMsg = visible[visible.length - 1]

  // Show the thinking indicator only while we're waiting for the assistant
  // to start a response — once the streaming assistant message exists (even
  // with empty content), the indicator unmounts so the streaming bubble takes
  // over. Streaming presence is checked via the loading state + last message
  // role (still `user` → assistant hasn't started yet).
  const showThinking = isLoading && lastMsg?.role === 'user'

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '34px 0', minHeight: 0 }}>
      <div style={{
        maxWidth: 720, margin: '0 auto', padding: '0 26px',
        display: 'flex', flexDirection: 'column', gap: 26,
      }}>
        {visible.map((m, i) => {
          const isLastAssistant = i === visible.length - 1 && m.role === 'assistant'
          const isStreaming = isLoading && isLastAssistant
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <MessageBubble
                role={m.role as 'user' | 'assistant'}
                content={m.content}
                streaming={isStreaming}
              />
              {isLastAssistant && !isLoading && (
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
