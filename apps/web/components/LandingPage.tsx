'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuth } from '@/lib/auth/context'
import { AppHeader, useToasts, ToastStack } from './AppHeader'
import { ChatHistory } from './ChatHistory'
import type { ChatItem } from './ChatHistory'

// ── Static data ───────────────────────────────────────────────────────────────

const PROMPTS = [
  { cat: 'Family support',  text: 'I have two children under 18.' },
  { cat: 'Employment',      text: 'I recently lost my job.' },
  { cat: 'Student support', text: "I'm studying full-time." },
  { cat: 'Retirement',      text: "I'm retired and receiving a pension." },
  { cat: 'Housing',         text: "I'm renting and struggling with costs." },
]

const TRUST = [
  { icon: 'Shield', label: 'Federal, state & local programs' },
  { icon: 'Gauge',  label: 'Real-time eligibility assessment' },
  { icon: 'Link',   label: 'Links to official claim pathways' },
]

const PLACEHOLDERS = [
  'I recently lost my job and have two children.',
  "I'm retired and struggling with electricity bills.",
  "I'm a student working part-time and paying rent.",
  'My family income has recently changed.',
]

// ── Icons ─────────────────────────────────────────────────────────────────────

const Icon = {
  Shield: ({ size = 17 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z" />
      <path d="m9.2 11.6 1.9 1.9 3.7-3.8" />
    </svg>
  ),
  Gauge: ({ size = 17 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 17a8 8 0 1 1 16 0" /><path d="m12 13 4-3" />
      <circle cx="12" cy="13" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  Link: ({ size = 17 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a4 4 0 0 0 5.7.4l2.6-2.6a4 4 0 0 0-5.7-5.7L11.3 6.4" />
      <path d="M14 11a4 4 0 0 0-5.7-.4L5.7 13.2a4 4 0 0 0 5.7 5.7l1.3-1.3" />
    </svg>
  ),
  Send: ({ size = 20 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" /><path d="m5 12 7-7 7 7" />
    </svg>
  ),
}

type IconName = keyof typeof Icon

// ── Landing page ──────────────────────────────────────────────────────────────

export function LandingPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const { toasts, addToast, dismiss } = useToasts()

  // MVP: wipe the chat session whenever the user lands here so every new
  // conversation starts fresh instead of restoring the previous one.
  useEffect(() => {
    localStorage.removeItem('benefits_chat_state')
    router.prefetch('/chat')
  }, [])

  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)
  const [shift, setShift] = useState(0)
  const [voiceOn, setVoiceOn] = useState(false)
  const [phIndex, setPhIndex] = useState(0)
  const [phVis, setPhVis] = useState(true)
  const [histOpen, setHistOpen] = useState(false)
  const [navigatingAway, setNavigatingAway] = useState(false)
  const navAwayRef = useRef(false)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setInterval(() => {
      setPhVis(false)
      setTimeout(() => { setPhIndex((i) => (i + 1) % PLACEHOLDERS.length); setPhVis(true) }, 430)
    }, 3600)
    return () => clearInterval(id)
  }, [])

  function enterFocus() {
    setFocused(true)
    setTimeout(() => {
      const el = heroRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setShift(Math.min(window.innerHeight / 2 - (r.top + r.height / 2), 0))
    }, 0)
  }

  function exitFocus() {
    // Hold the focused state through a navigation away — prevents the input
    // from snapping back to its centred position while the page is fading out.
    if (navAwayRef.current) return
    setShift(0); setFocused(false)
  }

  function fillPrompt(text: string) {
    // Append with a space if there's existing user text, otherwise just fill.
    // This avoids overwriting what the user already typed.
    setInput((prev) => {
      const trimmed = prev.trim()
      return trimmed ? `${trimmed} ${text}` : text
    })
    const ta = heroRef.current?.querySelector('textarea')
    if (ta) {
      // Focus on next tick so the new value is settled
      setTimeout(() => {
        ta.focus()
        ta.setSelectionRange(ta.value.length, ta.value.length)
      }, 0)
    }
  }

  function handleSubmit() {
    const text = input.trim()
    if (!text) return
    sessionStorage.setItem('benefits_initial_message', text)
    // Hold focus state and play the exit transition before navigating away —
    // keeps continuity between the lifted/dimmed input and the chat view.
    navAwayRef.current = true
    setNavigatingAway(true)
    setTimeout(() => router.push('/chat'), 280)
  }

  function onHeroKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  function handleVoiceToggle() {
    setVoiceOn((v) => !v)
    if (!voiceOn) addToast({ title: 'Listening…', message: 'Voice input is a demo in this preview.' })
  }

  // Real conversations from Supabase (logged-in users only)
  const [chats, setChats] = useState<ChatItem[]>([])
  useEffect(() => {
    if (!user || isLoading) return
    void (async () => {
      try {
        const res = await fetch('/api/conversations')
        if (!res.ok) return
        const list = (await res.json()) as Array<{ id: string; title: string; status: string | null; ts: number }>
        setChats(list)
      } catch (err) {
        console.error('load conversations failed', err)
      }
    })()
  }, [user, isLoading])

  function openConversation(c: ChatItem) {
    setHistOpen(false)
    // Route to /chat with the conversation id; ChatPage will hydrate it
    sessionStorage.setItem('benefits_open_conversation', c.id)
    router.push('/chat')
  }

  return (
    <div className={`landing-shell${focused ? ' input-focused' : ''}${navigatingAway ? ' navigating-away' : ''}`}>

      {/* ── Header ── */}
      <div className="dimmable" style={{ '--d': '0ms' } as React.CSSProperties}>
        <AppHeader onToast={addToast} />
      </div>

      {/* ── Main hero ── */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '20px 24px 40px', textAlign: 'center',
      }}>
        <div style={{ width: '100%', maxWidth: 720 }}>

          {/* Title */}
          <h1 className="dimmable" style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 'clamp(40px, 6.4vw, 68px)', lineHeight: 1.02,
            letterSpacing: '-0.035em', margin: '0 0 18px', color: 'var(--text)',
            '--d': '80ms',
          } as React.CSSProperties}>
            Benefits<span style={{ color: 'var(--accent)' }}>.AI</span>
          </h1>

          {/* Tagline */}
          <p className="dimmable" style={{
            fontSize: 'clamp(17px, 2.1vw, 20px)', lineHeight: 1.5,
            color: 'var(--muted)', margin: '0 auto 38px', maxWidth: 520,
            '--d': '140ms',
          } as React.CSSProperties}>
            Discover government benefits you may be entitled to.
          </p>

          {/* Input pill */}
          <div className="hero-wrap" style={{
            position: 'relative', zIndex: focused ? 5 : 'auto',
            transform: focused ? `translateY(${shift}px) scale(1.03)` : 'translateY(0) scale(1)',
          }}>
            <div ref={heroRef} className="hero-input floating" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--surface)', borderRadius: 26,
              padding: '7px 10px 7px 22px', textAlign: 'left',
            }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                {input === '' && (
                  <div className="ph-rotate" aria-hidden="true" style={{
                    position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none',
                    fontSize: 16.5, lineHeight: '26px', color: 'var(--faint)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    opacity: phVis ? 1 : 0,
                  }}>
                    {PLACEHOLDERS[phIndex]}
                  </div>
                )}
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onHeroKey}
                  onFocus={enterFocus}
                  onBlur={exitFocus}
                  rows={1}
                  placeholder=""
                  aria-label="Describe your situation"
                  style={{
                    position: 'relative', display: 'block', width: '100%',
                    resize: 'none', border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 16.5, lineHeight: '26px', color: 'var(--text)',
                    padding: 0, maxHeight: 130, fontFamily: 'inherit',
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                <button type="button" className="wave-btn"
                  aria-label={voiceOn ? 'Voice input on' : 'Voice input'}
                  aria-pressed={voiceOn} onClick={handleVoiceToggle}>
                  <span className={`wave${voiceOn ? ' active' : ''}`} aria-hidden="true">
                    <span /><span /><span /><span /><span />
                  </span>
                </button>
                <motion.button type="button" onClick={handleSubmit} disabled={!input.trim()}
                  aria-label="Send" className="send-btn"
                  style={{ color: input.trim() ? 'var(--accent)' : 'var(--faint)' }}
                  whileHover={input.trim() ? { scale: 1.08 } : {}}
                  whileTap={input.trim() ? { scale: 0.93 } : {}}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <Icon.Send size={20} />
                </motion.button>
              </div>
            </div>
          </div>

          {/* Prompt pills — hide ONLY while the textarea is focused.
              Restore on blur, regardless of whether the user has typed
              anything. */}
          <div
            className="dimmable no-pointer"
            style={{
              '--d': '200ms',
              opacity: focused ? 0 : 1,
              pointerEvents: focused ? 'none' : 'auto',
              transition: 'opacity 280ms ease',
            } as React.CSSProperties}
            aria-hidden={focused}
          >
            <div style={{ marginTop: 22, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 9 }}>
              {PROMPTS.map((p) => (
                <button key={p.text} className="prompt-pill" title={p.cat} onClick={() => fillPrompt(p.text)} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 999, padding: '9px 16px',
                  fontSize: 13.5, fontWeight: 500, color: 'var(--text-soft)', cursor: 'pointer',
                }}>
                  {p.text}
                </button>
              ))}
            </div>
          </div>

          {/* Trust indicators */}
          <div className="dimmable no-pointer" style={{
            marginTop: 40, display: 'flex', flexWrap: 'wrap',
            justifyContent: 'center', gap: '12px 26px', '--d': '260ms',
          } as React.CSSProperties}>
            {TRUST.map((tr) => {
              const C = Icon[tr.icon as IconName]
              return (
                <div key={tr.label} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}>
                  <span style={{ color: 'var(--accent)', display: 'grid', placeItems: 'center' }}><C /></span>
                  <span style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap' }}>{tr.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="dimmable" style={{ padding: '0 24px 26px', textAlign: 'center', '--d': '320ms' } as React.CSSProperties}>
        <p style={{ fontSize: 12, color: 'var(--faint)', maxWidth: 560, margin: '0 auto', lineHeight: 1.5 }}>
          Benefits.AI helps you explore what you may qualify for. It doesn&apos;t make formal determinations — the relevant government agency does.
        </p>
      </footer>

      {/* ── Chat history sidebar — logged-in only ── */}
      {!isLoading && user && (
        <ChatHistory
          open={histOpen}
          onToggle={() => setHistOpen((o) => !o)}
          chats={chats}
          activeId={null}
          onSelect={openConversation}
          onNew={() => setHistOpen(false)}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
