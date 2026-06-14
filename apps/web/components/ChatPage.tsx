'use client'

import { useChat } from 'ai/react'
import { useEffect, useRef, useState } from 'react'
import type { JSONValue } from 'ai'
import { mergeProfile, type ProfileVariables } from '@/lib/orchestrator/profile'
import type { EligibilityResult } from '@/lib/orchestrator/turn'
import type { VariableGuidance } from '@/lib/orchestrator/guidance'
import { useAuth } from '@/lib/auth/context'
import { ChatHistory } from './ChatHistory'
import { SignInModal } from './SignInModal'
import { ResultsDrawer } from './ResultsDrawer'
import { MessageList } from './MessageList'
import type { SchemeMetadata } from './SchemeCard'

interface StreamPayload {
  profileDelta?: Partial<ProfileVariables>
  eligibility?: EligibilityResult
  chips?: string[]
  guidance?: VariableGuidance | null
  guidanceVariable?: keyof ProfileVariables | null
}

interface ChatPageProps {
  schemes: SchemeMetadata[]
}

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant' as const,
  content:
    "Hi! I'm Benefits.AI. Tell me a bit about yourself — your age, work situation, where you live, and whether you rent or own. I'll check what Australian government entitlements you may qualify for.",
}

export function ChatPage({ schemes }: ChatPageProps) {
  const { user, isLoading: authLoading } = useAuth()
  const [profile, setProfile] = useState<ProfileVariables>({})
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null)
  const [chips, setChips] = useState<string[]>([])
  const [guidance, setGuidance] = useState<VariableGuidance | null>(null)
  const [lastAskedVariable, setLastAskedVariable] = useState<keyof ProfileVariables | null>(null)
  const [showGuidance, setShowGuidance] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [histOpen, setHistOpen] = useState(false)
  const [signInOpen, setSignInOpen] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const initialSentRef = useRef(false)

  const profileRef = useRef(profile)
  const lastAskedRef = useRef(lastAskedVariable)
  profileRef.current = profile
  lastAskedRef.current = lastAskedVariable

  const { messages, append, isLoading, data } = useChat({
    api: '/api/chat',
    initialMessages: [WELCOME_MESSAGE],
    fetch: async (url, options) => {
      const body = JSON.parse((options?.body as string) ?? '{}') as Record<string, unknown>
      body.profile = profileRef.current
      body.lastAskedVariable = lastAskedRef.current
      return fetch(url, { ...options, body: JSON.stringify(body) })
    },
  })

  // Auto-send the message the user typed on the landing page.
  // Runs once after mount; append is stable in the AI SDK.
  useEffect(() => {
    if (initialSentRef.current) return
    const msg = sessionStorage.getItem('benefits_initial_message')
    if (!msg) return
    initialSentRef.current = true
    sessionStorage.removeItem('benefits_initial_message')
    void append({ role: 'user', content: msg })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!data || data.length === 0) return
    const latest = data[data.length - 1] as JSONValue
    if (!latest || typeof latest !== 'object' || Array.isArray(latest)) return

    const payload = latest as unknown as StreamPayload

    if (payload.profileDelta) {
      setProfile((prev) => mergeProfile(prev, payload.profileDelta!))
    }
    if (payload.eligibility) {
      setEligibility(payload.eligibility)
      const hasResults =
        payload.eligibility.eligible.length > 0 || payload.eligibility.needs_info.length > 0
      if (hasResults) setDrawerOpen(true)
    }
    if (payload.chips !== undefined) {
      setChips(payload.chips)
      setShowGuidance(false)
    }
    if (payload.guidance !== undefined) {
      setGuidance(payload.guidance ?? null)
    }
    if (payload.guidanceVariable !== undefined) {
      setLastAskedVariable(payload.guidanceVariable ?? null)
    }
  }, [data])

  function handleChipClick(value: string) {
    if (value === 'Not sure? →') {
      setShowGuidance(true)
      return
    }
    setChips([])
    setShowGuidance(false)
    void append({ role: 'user', content: value })
  }

  function handleDismissGuidance() {
    setShowGuidance(false)
    inputRef.current?.focus()
  }

  function handleAnswerInChat(question: string) {
    setDrawerOpen(false)
    setInput(question)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleAskMore(schemeId: string) {
    setDrawerOpen(false)
    const question = `Tell me more about the ${schemeId.replace(/_/g, ' ').toLowerCase()} scheme`
    setInput(question)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    setChips([])
    setShowGuidance(false)
    void append({ role: 'user', content: text })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-gray-100">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-800 px-4">
        <a href="/" className="text-lg font-semibold tracking-tight text-white">
          Benefits.AI
        </a>
        <div className="flex items-center gap-2">
          {!authLoading && !user && (
            <button
              onClick={() => setSignInOpen(true)}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Sign in
            </button>
          )}
          <button
            onClick={() => setDrawerOpen((o) => !o)}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Results {drawerOpen ? '▲' : '▼'}
          </button>
        </div>
      </header>

      <ResultsDrawer
        eligibility={eligibility}
        schemes={schemes}
        open={drawerOpen}
        onToggle={() => setDrawerOpen((o) => !o)}
        onAskMore={handleAskMore}
        onAnswerInChat={handleAnswerInChat}
      />

      <MessageList
        messages={messages}
        chips={chips}
        guidance={guidance}
        showGuidance={showGuidance}
        isLoading={isLoading}
        onChipClick={handleChipClick}
        onDismissGuidance={handleDismissGuidance}
      />

      <div className="shrink-0 border-t border-gray-800 bg-gray-950 px-4 py-3">
        <div className="mx-auto flex max-w-2xl gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me about yourself…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-600 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* Chat history — logged-in users only */}
      {!authLoading && user && (
        <ChatHistory
          open={histOpen}
          onToggle={() => setHistOpen((o) => !o)}
          chats={[]}
          activeId={null}
          onSelect={() => setHistOpen(false)}
          onNew={() => setHistOpen(false)}
        />
      )}

      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  )
}
