'use client'

import { useChat } from 'ai/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { JSONValue, Message } from 'ai'
import { mergeProfile, type ProfileVariables } from '@/lib/orchestrator/profile'
import type { EligibilityResult } from '@/lib/orchestrator/turn'
import type { VariableGuidance } from '@/lib/orchestrator/guidance'
import { useAuth } from '@/lib/auth/context'
import { AppHeader, useToasts, ToastStack } from './AppHeader'
import { ChatHistory } from './ChatHistory'
import { MessageList } from './MessageList'
import { Discovery } from './Discovery'
import { Results } from './Results'
import type { ResultsData } from '@/lib/eligibility/types'
import type { SchemeMetadata } from './SchemeCard'

type Stage = 'conversation' | 'discovering' | 'results'

const SESSION_KEY = 'benefits_chat_state'

interface PersistedState {
  messages: Message[]
  profile: ProfileVariables
  chips: string[]
  guidance: VariableGuidance | null
  lastAskedVariable: keyof ProfileVariables | null
  eligibility: EligibilityResult | null
}

function loadSession(): PersistedState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedState
  } catch { return null }
}

function saveSession(state: PersistedState) {
  if (typeof window === 'undefined') return
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(state)) } catch {}
}

interface StreamPayload {
  profileDelta?: Partial<ProfileVariables>
  eligibility?: EligibilityResult
  chips?: string[]
  guidance?: VariableGuidance | null
  guidanceVariable?: keyof ProfileVariables | null
}

interface ChatPageProps {
  // schemes kept for future results view — not used in conversation view
  schemes: SchemeMetadata[]
}

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant' as const,
  content:
    "Hi! I'm Benefits.AI. Tell me a bit about yourself — your age, work situation, where you live, and whether you rent or own. I'll check what Australian government entitlements you may qualify for.",
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function SendIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}
      stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" /><path d="m5 12 7-7 7 7" />
    </svg>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function ChatPage(_: ChatPageProps) {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const { toasts, addToast, dismiss } = useToasts()

  // Restore prior session on mount (sessionStorage) — survives navigation within tab
  const restored = useMemo(() => loadSession(), [])

  const [profile, setProfile] = useState<ProfileVariables>(restored?.profile ?? {})
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(restored?.eligibility ?? null)
  const [chips, setChips] = useState<string[]>(restored?.chips ?? [])
  const [guidance, setGuidance] = useState<VariableGuidance | null>(restored?.guidance ?? null)
  const [lastAskedVariable, setLastAskedVariable] = useState<keyof ProfileVariables | null>(restored?.lastAskedVariable ?? null)
  const [showGuidance, setShowGuidance] = useState(false)
  const [histOpen, setHistOpen] = useState(false)
  const [voiceOn, setVoiceOn] = useState(false)
  const [input, setInput] = useState('')
  const [stage, setStage] = useState<Stage>('conversation')
  const [results, setResults] = useState<ResultsData | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const initialSentRef = useRef(false)

  const profileRef = useRef(profile)
  const lastAskedRef = useRef(lastAskedVariable)
  profileRef.current = profile
  lastAskedRef.current = lastAskedVariable

  const { messages, append, isLoading, data, setMessages } = useChat({
    api: '/api/chat',
    initialMessages: restored?.messages && restored.messages.length > 0 ? restored.messages : [WELCOME_MESSAGE],
    fetch: async (url, options) => {
      const body = JSON.parse((options?.body as string) ?? '{}') as Record<string, unknown>
      body.profile = profileRef.current
      body.lastAskedVariable = lastAskedRef.current
      return fetch(url, { ...options, body: JSON.stringify(body) })
    },
  })

  // Persist every state change to sessionStorage
  useEffect(() => {
    if (messages.length > 1 || profile && Object.keys(profile).length > 0) {
      saveSession({ messages, profile, chips, guidance, lastAskedVariable, eligibility })
    }
  }, [messages, profile, chips, guidance, lastAskedVariable, eligibility])

  // Auto-send initial message from landing page
  useEffect(() => {
    if (initialSentRef.current) return
    const msg = sessionStorage.getItem('benefits_initial_message')
    if (!msg) return
    initialSentRef.current = true
    sessionStorage.removeItem('benefits_initial_message')
    void append({ role: 'user', content: msg })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Process stream data — profile + eligibility + chips + guidance
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

  function handleVoiceToggle() {
    setVoiceOn((v) => !v)
    if (!voiceOn) addToast({ title: 'Listening…', message: 'Voice input is a demo in this preview.' })
  }

  /**
   * Run the eligibility assessment — moves stage: conversation → discovering → results.
   * The Discovery loader stays up until the /api/eligibility/assess promise resolves.
   * On failure, falls back to conversation with a danger toast (per design contract).
   */
  const runAssessment = useCallback(async () => {
    setStage('discovering')
    try {
      const res = await fetch('/api/eligibility/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profileRef.current }),
      })
      if (!res.ok) throw new Error(`assess ${res.status}`)
      const data = (await res.json()) as ResultsData
      setResults(data)
      setStage('results')
    } catch (err) {
      console.error('assessment failed', err)
      addToast({
        title: "Couldn't run assessment",
        message: 'Something went wrong while checking your eligibility. Please try again.',
      })
      setStage('conversation')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function restartAssessment() {
    sessionStorage.removeItem(SESSION_KEY)
    setMessages([WELCOME_MESSAGE])
    setProfile({}); setEligibility(null); setChips([]); setGuidance(null); setLastAskedVariable(null)
    setResults(null)
    setStage('conversation')
    router.push('/')
  }

  // Show "See my matches" CTA when we have at least 4 user turns + some eligibility data
  const userTurns = messages.filter((m) => m.role === 'user').length
  const hasEligibilitySignal = (eligibility?.eligible.length ?? 0) + (eligibility?.needs_info.length ?? 0) > 0
  const canAssess = userTurns >= 3 && hasEligibilitySignal && stage === 'conversation'

  // Render Discovery / Results based on stage
  if (stage === 'discovering') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
        background: 'radial-gradient(1200px 620px at 50% -8%, var(--bg-grad) 0%, transparent 70%), var(--bg)',
        color: 'var(--text)', fontFamily: 'var(--font-body)',
      }}>
        <AppHeader onToast={addToast} bordered />
        <Discovery done={false} />
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </div>
    )
  }

  if (stage === 'results' && results) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
        background: 'radial-gradient(1200px 620px at 50% -8%, var(--bg-grad) 0%, transparent 70%), var(--bg)',
        color: 'var(--text)', fontFamily: 'var(--font-body)',
      }}>
        <Results data={results} onRestart={restartAssessment} />
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
      background: 'radial-gradient(1200px 620px at 50% -8%, var(--bg-grad) 0%, transparent 70%), var(--bg)',
      color: 'var(--text)', fontFamily: 'var(--font-body)',
    }}>

      {/* ── Header (same as landing) ── */}
      <AppHeader onToast={addToast} bordered />

      {/* ── Message thread ── */}
      <MessageList
        messages={messages}
        chips={chips}
        guidance={guidance}
        showGuidance={showGuidance}
        isLoading={isLoading}
        onChipClick={handleChipClick}
        onDismissGuidance={handleDismissGuidance}
      />

      {/* ── "See my matches" CTA — appears when enough info gathered ── */}
      {canAssess && (
        <div style={{ padding: '0 26px 12px', flexShrink: 0 }}>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={runAssessment}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'var(--accent)', color: 'var(--accent-ink)',
                border: 'none', borderRadius: 12, padding: '10px 18px',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-body)', boxShadow: 'var(--shadow-md)',
              }}
            >
              See my matches →
            </button>
          </div>
        </div>
      )}

      {/* ── Composer dock ── */}
      <div style={{ padding: '0 26px 20px', flexShrink: 0 }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div
            className="dock floating"
            style={{
              display: 'flex', alignItems: 'flex-end', gap: 6,
              padding: '7px 8px 7px 18px',
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Reply to Benefits.AI…"
              aria-label="Reply to Benefits.AI"
              style={{
                flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent',
                fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: '24px',
                color: 'var(--text)', padding: '7px 0', maxHeight: 132,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, paddingBottom: 1 }}>
              <button
                type="button"
                className="wave-btn"
                aria-label={voiceOn ? 'Voice input on' : 'Voice input'}
                aria-pressed={voiceOn}
                onClick={handleVoiceToggle}
              >
                <span className={`wave${voiceOn ? ' active' : ''}`} aria-hidden="true">
                  <span /><span /><span /><span /><span />
                </span>
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                aria-label="Send"
                className="send-btn"
                style={{ color: input.trim() && !isLoading ? 'var(--accent)' : 'var(--faint)' }}
              >
                <SendIcon size={20} />
              </button>
            </div>
          </div>
          <p style={{
            textAlign: 'center', fontSize: 12, color: 'var(--faint)',
            margin: '11px 0 0', lineHeight: 1.5,
          }}>
            Benefits.AI helps you explore what you may qualify for. It doesn&apos;t make formal determinations — the relevant agency does.
          </p>
        </div>
      </div>

      {/* ── Chat history sidebar — logged-in users only ── */}
      {!authLoading && user && (
        <ChatHistory
          open={histOpen}
          onToggle={() => setHistOpen((o) => !o)}
          chats={[]}
          activeId={null}
          onSelect={() => setHistOpen(false)}
          onNew={() => { setHistOpen(false); restartAssessment() }}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
