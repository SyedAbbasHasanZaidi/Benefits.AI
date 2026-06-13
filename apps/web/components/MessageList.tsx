'use client'

import { useEffect, useRef } from 'react'
import type { Message } from 'ai'
import { GuidanceCard } from './GuidanceCard'
import { MessageBubble } from './MessageBubble'
import { QuickReplyChips } from './QuickReplyChips'
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
  }, [messages, showGuidance])

  const visible = messages.filter((m) => m.role === 'user' || m.role === 'assistant')

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
      {visible.map((m, i) => {
        const isLastAssistant = i === visible.length - 1 && m.role === 'assistant'
        return (
          <div key={m.id} className="flex flex-col gap-3">
            <MessageBubble role={m.role as 'user' | 'assistant'} content={m.content} />
            {isLastAssistant && !isLoading && (
              <>
                {showGuidance && guidance ? (
                  <GuidanceCard guidance={guidance} onDismiss={onDismissGuidance} />
                ) : (
                  <QuickReplyChips chips={chips} onChipClick={onChipClick} />
                )}
              </>
            )}
          </div>
        )
      })}
      {isLoading && (
        <div className="flex justify-start">
          <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">
            B
          </div>
          <div className="rounded-2xl rounded-bl-sm bg-gray-800 px-4 py-2.5">
            <span className="flex gap-1">
              <span className="animate-bounce text-gray-400" style={{ animationDelay: '0ms' }}>•</span>
              <span className="animate-bounce text-gray-400" style={{ animationDelay: '150ms' }}>•</span>
              <span className="animate-bounce text-gray-400" style={{ animationDelay: '300ms' }}>•</span>
            </span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
