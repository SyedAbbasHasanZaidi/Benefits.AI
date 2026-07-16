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
import EligibilityOrb from './EligibilityOrb'
import type { ResultsData } from '@/lib/eligibility/types'
import type { ConversationSummary } from '@/lib/conversations/types'
import type { ChatItem } from './ChatHistory'
import type { SchemeMetadata } from './SchemeCard'
import { AnimatePresence, motion } from 'framer-motion'
import { DURATION, EASE } from '@/lib/animations'

type Stage = 'conversation' | 'discovering' | 'results'

const SESSION_KEY = 'benefits_chat_state'

interface PersistedState {
  messages: Message[]
  profile: ProfileVariables
  chips: string[]
  guidance: VariableGuidance | null
  lastAskedVariable: keyof ProfileVariables | null
  eligibility: EligibilityResult | null
  askedStreak: Record<string, number>
  skippedAt: Record<string, number>
}

function loadSession(): PersistedState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedState
  } catch { return null }
}

function saveSession(state: PersistedState) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(state)) } catch {}
}

interface StreamPayload {
  profileDelta?: Partial<ProfileVariables>
  eligibility?: EligibilityResult
  chips?: string[]
  guidance?: VariableGuidance | null
  guidanceVariable?: keyof ProfileVariables | null
  askedStreak?: Record<string, number>
  skippedAt?: Record<string, number>
}

interface ChatPageProps {
  // schemes kept for future results view — not used in conversation view
  schemes: SchemeMetadata[]
}

// No welcome message — the user's first turn is the first thing in the thread.
// If a user arrives at /chat directly (no initial message), the composer's
// placeholder text serves as the prompt.

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

export function ChatPage({ schemes }: ChatPageProps) {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const { toasts, addToast, dismiss } = useToasts()

  // Restore prior session on mount (localStorage) — survives tab close + browser restart.
  // Temporary until Supabase persistence lands; swap loadSession/saveSession back to
  // sessionStorage (or remove entirely) once profile is server-side per user.
  const restored = useMemo(() => loadSession(), [])

  const [profile, setProfile] = useState<ProfileVariables>(restored?.profile ?? {})
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(restored?.eligibility ?? null)
  const [chips, setChips] = useState<string[]>(restored?.chips ?? [])
  const [guidance, setGuidance] = useState<VariableGuidance | null>(restored?.guidance ?? null)
  const [lastAskedVariable, setLastAskedVariable] = useState<keyof ProfileVariables | null>(restored?.lastAskedVariable ?? null)
  const [askedStreak, setAskedStreak] = useState<Record<string, number>>(restored?.askedStreak ?? {})
  const [skippedAt, setSkippedAt] = useState<Record<string, number>>(restored?.skippedAt ?? {})
  const [showGuidance, setShowGuidance] = useState(false)
  const [histOpen, setHistOpen] = useState(false)
  const [voiceOn, setVoiceOn] = useState(false)
  const [input, setInput] = useState('')
  const [stage, setStage] = useState<Stage>('conversation')
  const [discoveryDone, setDiscoveryDone] = useState(false)
  // Guards against double-fire from concurrent click + animation-complete callback.
  const assessmentTriggeredRef = useRef(false)
  // Discovery animation plays once per session — subsequent unlocks skip it.
  const hasShownDiscoveryRef = useRef(false)
  // Tracks eligible count so we can detect new scheme additions silently.
  const prevEligibleCountRef = useRef(0)
  // Orb new-unlock glow: counter increments each time to force re-mount of the ring element.
  const [unlockGlowKey, setUnlockGlowKey] = useState(0)
  const [orbNewUnlock, setOrbNewUnlock] = useState(false)
  const [results, setResults] = useState<ResultsData | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [chats, setChats] = useState<ChatItem[]>([])
  const [chatsLoading, setChatsLoading] = useState(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const initialSentRef = useRef(false)
  const lastPersistedRef = useRef<Set<string>>(new Set())

  const profileRef = useRef(profile)
  const lastAskedRef = useRef(lastAskedVariable)
  const askedStreakRef = useRef(askedStreak)
  const skippedAtRef = useRef(skippedAt)
  profileRef.current = profile
  lastAskedRef.current = lastAskedVariable
  askedStreakRef.current = askedStreak
  skippedAtRef.current = skippedAt

  const { messages, append, isLoading, data, setMessages } = useChat({
    api: '/api/chat',
    initialMessages: restored?.messages && restored.messages.length > 0 ? restored.messages : [],
    fetch: async (url, options) => {
      const body = JSON.parse((options?.body as string) ?? '{}') as Record<string, unknown>
      body.profile = profileRef.current
      body.lastAskedVariable = lastAskedRef.current
      body.askedStreak = askedStreakRef.current
      body.skippedAt = skippedAtRef.current
      return fetch(url, { ...options, body: JSON.stringify(body) })
    },
  })

  // Persist every state change to sessionStorage
  useEffect(() => {
    if (messages.length > 1 || profile && Object.keys(profile).length > 0) {
      saveSession({ messages, profile, chips, guidance, lastAskedVariable, eligibility, askedStreak, skippedAt })
    }
  }, [messages, profile, chips, guidance, lastAskedVariable, eligibility])

  // ── Global Enter-to-send ───────────────────────────────────────────────────
  // When focus is anywhere on the page that isn't an interactive element
  // (e.g. after clicking a chip or tapping the message thread), pressing
  // Enter should still send — matching the UX of standard chat apps.
  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
      const tag = (e.target as HTMLElement).tagName
      // Let Enter work normally inside other textareas, inputs, selects, and buttons
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON') return
      e.preventDefault()
      inputRef.current?.focus()
      // Flush synchronously so handleSend reads the current input value
      handleSend()
    }
    window.addEventListener('keydown', onGlobalKey)
    return () => window.removeEventListener('keydown', onGlobalKey)
  // handleSend reads input via closure; re-register whenever it changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isLoading])

  // Auto-send initial message from landing page, or open a saved conversation
  useEffect(() => {
    if (initialSentRef.current) return
    initialSentRef.current = true

    // Priority 1: sidebar requested we open a specific past conversation
    const openId = sessionStorage.getItem('benefits_open_conversation')
    if (openId) {
      sessionStorage.removeItem('benefits_open_conversation')
      void openConversation({ id: openId, title: '', ts: 0, status: null })
      return
    }

    // Priority 2: user typed a message on the landing page
    const msg = sessionStorage.getItem('benefits_initial_message')
    if (msg) {
      sessionStorage.removeItem('benefits_initial_message')
      void append({ role: 'user', content: msg })
    }
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
    if (payload.askedStreak !== undefined) {
      setAskedStreak(payload.askedStreak)
    }
    if (payload.skippedAt !== undefined) {
      setSkippedAt(payload.skippedAt)
    }
  }, [data])

  // ── Load conversation list for sidebar (logged-in users only) ──────────────
  useEffect(() => {
    if (!user || authLoading) return
    void (async () => {
      try {
        const res = await fetch('/api/conversations')
        if (!res.ok) return
        const list = (await res.json()) as ConversationSummary[]
        setChats(list.map((c) => ({ id: c.id, title: c.title, ts: c.ts, status: c.status })))
      } catch (err) {
        console.error('load conversations failed', err)
      } finally {
        setChatsLoading(false)
      }
    })()
  }, [user, authLoading, conversationId, results])

  // ── Load a past conversation when user clicks one in the sidebar ───────────
  const openConversation = useCallback(async (c: ChatItem) => {
    setHistOpen(false)
    if (c.id === conversationId) return
    try {
      const res = await fetch(`/api/conversations/${c.id}`)
      if (!res.ok) throw new Error(`open ${res.status}`)
      const detail = await res.json()
      lastPersistedRef.current = new Set((detail.messages as { id: string }[]).map((m) => m.id))
      setMessages(detail.messages.length > 0 ? detail.messages : [])
      setProfile(detail.variables ?? {})
      setConversationId(c.id)
      if (detail.latestAssessment) {
        setResults(detail.latestAssessment)
        setStage('results')
      } else {
        setStage('conversation')
      }
    } catch (err) {
      console.error('open conversation failed', err)
      addToast({ title: "Couldn't open conversation", message: 'Please try again.' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  // ── Conversation persistence (logged-in users only) ────────────────────────
  // On each new message (post-welcome), create a conversation if we don't have
  // one, then append the message to /api/conversations/:id/messages. The
  // sessionStorage path keeps working for guests.
  useEffect(() => {
    if (!user || authLoading) return
    if (messages.length <= 1) return  // only WELCOME — nothing to persist yet
    if (isLoading) return              // wait for stream to finish before saving

    const lastMsg = messages[messages.length - 1]
    if (!lastMsg || lastPersistedRef.current.has(lastMsg.id)) return

    void (async () => {
      try {
        let cid = conversationId
        if (!cid) {
          // First persisted turn — create the conversation record
          const firstUser = messages.find((m) => m.role === 'user')
          if (!firstUser) return
          const res = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstMessage: firstUser.content }),
          })
          if (!res.ok) throw new Error(`create conversation ${res.status}`)
          const { id } = (await res.json()) as { id: string }
          cid = id
          setConversationId(id)
        }

        await fetch(`/api/conversations/${cid}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: lastMsg.role,
            content: lastMsg.content,
            variables: profileRef.current,
          }),
        })
        lastPersistedRef.current.add(lastMsg.id)
      } catch (err) {
        console.error('persist conversation failed', err)
      }
    })()
  }, [messages, isLoading, user, authLoading, conversationId])

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

  const runAssessment = useCallback(async () => {
    const firstTime = !hasShownDiscoveryRef.current
    hasShownDiscoveryRef.current = true

    // Stamp the moment Discovery mounts so we can guarantee the full
    // 5-step animation plays regardless of how fast the API responds.
    // The last step-advance timer fires at 700ms × 4 = 2800ms.
    const discoveryStart = firstTime ? Date.now() : 0

    if (firstTime) {
      setStage('discovering')
      setDiscoveryDone(false)
    }

    try {
      const res = await fetch('/api/eligibility/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: profileRef.current,
          conversationId: conversationId ?? undefined,
        }),
      })
      if (!res.ok) throw new Error(`assess ${res.status}`)
      const data = (await res.json()) as ResultsData
      setResults(data)

      if (firstTime) {
        // Wait until the animation's last step-advance has fired (2800ms from mount),
        // then signal done and hold so the user sees all 5 ticks before moving on.
        const LAST_STEP_MS = 700 * 4  // 4 timers for 5 steps
        const elapsed = Date.now() - discoveryStart
        const remaining = Math.max(0, LAST_STEP_MS - elapsed)
        if (remaining > 0) await new Promise<void>((r) => setTimeout(r, remaining))
        setDiscoveryDone(true)
        // Hold with all ticks checked so the user registers the completion.
        await new Promise<void>((r) => setTimeout(r, 650))
      }
      setStage('results')
    } catch (err) {
      console.error('assessment failed', err)
      addToast({
        title: "Couldn't run assessment",
        message: 'Something went wrong while checking your eligibility. Please try again.',
      })
      if (firstTime) {
        setStage('conversation')
        hasShownDiscoveryRef.current = false
      }
      assessmentTriggeredRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  // Silent results refresh — used when a new scheme is unlocked while results are
  // already on screen. No stage transition; just updates the ResultsData in place.
  const runSilentAssessment = useCallback(async () => {
    try {
      const res = await fetch('/api/eligibility/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: profileRef.current,
          conversationId: conversationId ?? undefined,
        }),
      })
      if (!res.ok) return
      const data = (await res.json()) as ResultsData
      setResults(data)
    } catch { /* non-fatal — results will still show previous data */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  // Guards against double-fire: both the orb's animation-complete callback and a
  // user click can call this. Only the first call proceeds; subsequent calls are no-ops.
  // The guard resets whenever eligibility is lost (see meterState effect below).
  const triggerAssessment = useCallback(() => {
    if (assessmentTriggeredRef.current) return
    assessmentTriggeredRef.current = true
    void runAssessment()
  }, [runAssessment])

  function restartAssessment() {
    localStorage.removeItem(SESSION_KEY)
    setMessages([])
    setProfile({}); setEligibility(null); setChips([]); setGuidance(null); setLastAskedVariable(null)
    setAskedStreak({}); setSkippedAt({})
    setResults(null)
    setStage('conversation')
    setConversationId(null)
    lastPersistedRef.current = new Set()
    router.push('/')
  }

  // ── EligibilityOrb signal — proximity to nearest eligible scheme ──────────
  // Maps the rules engine output to the orb's contract:
  //   - if any scheme is verified eligible → eligible=true (orb fills + turns green)
  //   - else find the needs_info scheme with the smallest missing list,
  //     score = ((required - missing) / required) * 100
  // Hidden on landing/empty state (no eligibility payload yet).
  const meterState = (() => {
    if (!eligibility) return { value: 0, eligible: false, show: false }

    if (eligibility.eligible.length > 0) {
      return { value: 100, eligible: true, show: true }
    }

    // Closest needs_info scheme = highest progress = lowest missing/required ratio
    let best = 0
    for (const item of eligibility.needs_info) {
      const scheme = schemes.find((s) => s.id === item.schemeId) as
        (typeof schemes)[number] & { required_inputs?: string[] } | undefined
      const required = scheme?.required_inputs?.length ?? 4
      const missing = item.missingVars.length
      const provided = Math.max(0, required - missing)
      const score = Math.round((provided / required) * 100)
      if (score > best) best = score
    }

    if (best === 0) return { value: 0, eligible: false, show: false }
    return { value: best, eligible: false, show: true }
  })()
  const showMeter = stage === 'conversation' && meterState.show

  // Reset the double-fire guard whenever eligibility is lost (e.g. restartAssessment).
  useEffect(() => {
    if (!meterState.eligible) assessmentTriggeredRef.current = false
  }, [meterState.eligible])

  // Detect a new scheme being added while the user is already eligible.
  // First eligibility is handled by the orb animation → triggerAssessment flow.
  // Subsequent additions get a silent refresh + brief orb glow instead of Discovery.
  const eligibleCount = eligibility?.eligible.length ?? 0
  useEffect(() => {
    const prev = prevEligibleCountRef.current
    prevEligibleCountRef.current = eligibleCount
    if (prev > 0 && eligibleCount > prev && hasShownDiscoveryRef.current) {
      // New scheme added while already in eligible state — skip Discovery, just glow + refresh.
      setUnlockGlowKey((k) => k + 1)
      setOrbNewUnlock(true)
      void runSilentAssessment()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleCount])

  // Auto-clear the glow flag after the animation (700ms × 2 pulses + margin).
  useEffect(() => {
    if (!orbNewUnlock) return
    const t = setTimeout(() => setOrbNewUnlock(false), 1600)
    return () => clearTimeout(t)
  }, [orbNewUnlock])

  const backButton = (
    <button
      onClick={() => router.push('/')}
      aria-label="Back to home"
      className="icon-btn"
      style={{
        display: 'grid', placeItems: 'center',
        width: 32, height: 32, borderRadius: 9,
        background: 'transparent', border: 'none',
        color: 'var(--muted)', cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" width={17} height={17} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5" /><path d="m12 5-7 7 7 7" />
      </svg>
    </button>
  )

  const shellStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
    background: 'radial-gradient(1200px 620px at 50% -8%, var(--bg-grad) 0%, transparent 70%), var(--bg)',
    color: 'var(--text)', fontFamily: 'var(--font-body)',
  }

  const stageMotion = {
    initial:    { opacity: 0, y: 12, filter: 'blur(4px)' },
    animate:    { opacity: 1, y: 0,  filter: 'blur(0px)' },
    exit:       { opacity: 0, y: -8, filter: 'blur(4px)' },
    transition: { duration: DURATION.slow, ease: EASE.standard },
    style:      { display: 'flex', flexDirection: 'column' as const, flex: 1, minHeight: 0, overflow: 'hidden' },
  }

  return (
    <div className="chat-shell" style={shellStyle}>

      {/* AppHeader: shown for conversation + discovering, not results */}
      {stage !== 'results' && (
        <AppHeader
          onToast={addToast}
          leftExtra={stage === 'conversation' ? backButton : undefined}
        />
      )}

      <AnimatePresence mode="wait">
        {stage === 'discovering' && (
          <motion.div key="discovering" {...stageMotion}>
            <Discovery done={discoveryDone} />
          </motion.div>
        )}

        {stage === 'results' && results && (
          <motion.div key="results" {...stageMotion}>
            <Results
              data={results}
              onRestart={restartAssessment}
              onBack={() => setStage('conversation')}
            />
          </motion.div>
        )}

        {stage === 'conversation' && (
          <motion.div key="conversation" {...stageMotion}>
            <MessageList
              messages={messages}
              chips={chips}
              guidance={guidance}
              showGuidance={showGuidance}
              isLoading={isLoading}
              onChipClick={handleChipClick}
              onDismissGuidance={handleDismissGuidance}
            />

            {/* Composer dock + EligibilityOrb */}
            <div style={{ padding: '0 26px 20px', flexShrink: 0 }}>
              <div style={{ maxWidth: 720, margin: '0 auto' }}>
                <div style={{ position: 'relative' }}>
                  {showMeter && (
                    <div style={{
                      position: 'absolute',
                      left: '100%', top: '50%',
                      transform: 'translateY(calc(-50% + 2px))',
                      marginLeft: 16, zIndex: 5,
                    }}>
                      <EligibilityOrb
                        key={unlockGlowKey}
                        value={meterState.value}
                        eligible={meterState.eligible}
                        onClick={triggerAssessment}
                        onEligibleAnimationComplete={
                          hasShownDiscoveryRef.current ? undefined : triggerAssessment
                        }
                        newUnlock={orbNewUnlock}
                        size={34}
                        accent="var(--accent)"
                      />
                    </div>
                  )}
                  <div
                    className="dock floating"
                    style={{ display: 'flex', alignItems: 'flex-end', gap: 6, padding: '7px 8px 7px 18px' }}
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
                      <motion.button
                        type="button"
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        aria-label="Send"
                        className="send-btn"
                        style={{ color: input.trim() && !isLoading ? 'var(--accent)' : 'var(--faint)' }}
                        whileHover={input.trim() && !isLoading ? { scale: 1.08 } : {}}
                        whileTap={input.trim() && !isLoading ? { scale: 0.93 } : {}}
                        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                      >
                        <SendIcon size={20} />
                      </motion.button>
                    </div>
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
          </motion.div>
        )}
      </AnimatePresence>

      {!authLoading && user && (
        <ChatHistory
          open={histOpen}
          onToggle={() => setHistOpen((o) => !o)}
          chats={chats}
          activeId={conversationId}
          onSelect={openConversation}
          onNew={() => { setHistOpen(false); restartAssessment() }}
          isLoading={chatsLoading}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
