# Auth + Sidebar Gating Design

**Date:** 2026-06-14  
**Status:** Approved  
**Scope:** Supabase auth (Google OAuth + email magic link), client-side auth context, chat history sidebar gated behind login on both Landing and Chat pages.

---

## Problem

The chat history sidebar (`ChatHistory`) is currently always visible on the landing page with static seed data. There is no auth system, no real session persistence, and the "Sign in" button in `SettingsMenu` does nothing. Guests should not be able to access the history sidebar; logged-in users should see it.

---

## Approach: Client-Side AuthContext (Approach B)

`AuthProvider` wraps the entire app in `layout.tsx`. It subscribes to Supabase's `onAuthStateChange` and hydrates immediately from `getSession()`. Every component reaches auth state via `useAuth()` — no prop drilling, no middleware, no SSR complexity. Natural fit since all UI is `'use client'`.

---

## Architecture

```
layout.tsx
  └── AuthProvider                  (lib/auth/context.tsx)
        ├── LandingPage             reads useAuth()
        │     ├── SettingsMenu      shows sign-in or user avatar
        │     ├── SignInModal       triggered by SettingsMenu
        │     └── ChatHistory       only rendered when user !== null
        └── ChatPage                reads useAuth()
              ├── SettingsMenu      (same)
              ├── SignInModal        (same)
              └── ChatHistory       only rendered when user !== null
```

---

## Files

| File | Action | Purpose |
|------|--------|---------|
| `lib/auth/context.tsx` | NEW | `AuthProvider` + `useAuth()` hook |
| `app/auth/callback/route.ts` | NEW | OAuth + magic link code exchange |
| `components/SignInModal.tsx` | NEW | Email + Google sign-in UI |
| `components/ChatHistory.tsx` | NEW (extracted) | Shared sidebar, moved out of LandingPage |
| `app/layout.tsx` | EDIT | Wrap body with `AuthProvider` |
| `components/LandingPage.tsx` | EDIT | `useAuth()`, gate sidebar, wire sign-in |
| `components/ChatPage.tsx` | EDIT | Add sidebar, gate, wire sign-in |

---

## Component Specs

### `lib/auth/context.tsx`

```
interface AuthContextValue {
  user: User | null      // Supabase User object, null = guest
  isLoading: boolean     // true only during initial session hydration
}
```

- On mount: `supabase.auth.getSession()` → sets `user` synchronously from stored session cookie, sets `isLoading = false`.
- Subscribes to `onAuthStateChange` for live sign-in / sign-out / token refresh.
- Unsubscribes on unmount.
- Exports: `AuthProvider`, `useAuth`.

### `app/auth/callback/route.ts`

- Handles `GET /auth/callback?code=<code>`.
- Calls `supabase.auth.exchangeCodeForSession(code)`.
- On success: `redirect('/')`.
- On error: `redirect('/?auth_error=1')` (landing page handles the query param in a future iteration; for now just redirects home).
- Required for both Google OAuth and email magic link flows.

### `components/SignInModal.tsx`

Two-section modal using existing `.modal-scrim` / `.modal-card` CSS:

**Google section**
```
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${window.location.origin}/auth/callback` }
})
```

**Email magic link section**
- Controlled `<input type="email">`.
- On submit:
  ```
  supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
  })
  ```
- After success: show "Check your inbox" confirmation state within the same modal (no redirect).
- Validation: non-empty, basic email format check before calling Supabase.

Props: `{ open: boolean; onClose: () => void }`.

### `components/ChatHistory.tsx` (extracted)

Moved from `LandingPage.tsx`. Contains:
- `ChatItem` type
- `relTime()` helper
- `groupChats()` helper
- `ChatHistory` component

Props unchanged from current implementation:
```
{
  open: boolean
  onToggle: () => void
  chats: ChatItem[]
  activeId: string | null
  onSelect: (c: ChatItem) => void
  onNew: () => void
}
```

No auth logic inside the component — the parent decides whether to render it.

### `LandingPage.tsx` changes

- Import `useAuth`.
- Import `ChatHistory` from `components/ChatHistory.tsx` (remove inline definition).
- Import `SignInModal`.
- Add `signInOpen` state.
- Render `<ChatHistory>` only when `user !== null`.
- Wire SettingsMenu "Sign in" button → `setSignInOpen(true)`.
- SettingsMenu: when `user !== null`, show user initials avatar + email; add "Sign out" item that calls `supabase.auth.signOut()`.

### `ChatPage.tsx` changes

- Import `useAuth`.
- Import `ChatHistory`.
- Import `SignInModal`.
- Add `histOpen`, `signInOpen` state.
- Render `<ChatHistory>` only when `user !== null` (empty `chats={[]}` until Supabase persistence is wired).
- Add sign-in affordance in the header (the existing header already has a logo link; add a subtle "Sign in" text link or reuse the SettingsMenu pattern from LandingPage).

---

## Auth Flows

### Google OAuth
```
User clicks "Sign in with Google"
  → signInWithOAuth({ provider: 'google', redirectTo: '/auth/callback' })
  → Browser redirects to Google consent screen
  → Google redirects to /auth/callback?code=<code>
  → exchangeCodeForSession(code) → session stored in cookie
  → redirect('/') → AuthProvider.onAuthStateChange fires → user is set
```

### Email Magic Link
```
User enters email, clicks "Send link"
  → signInWithOtp({ email, emailRedirectTo: '/auth/callback' })
  → Modal shows "Check your inbox"
  → User clicks link in email → browser opens /auth/callback?code=<code>
  → exchangeCodeForSession(code) → session stored in cookie
  → redirect('/') → AuthProvider.onAuthStateChange fires → user is set
```

### Sign Out
```
User clicks "Sign out" in SettingsMenu
  → supabase.auth.signOut()
  → onAuthStateChange fires with null session
  → user = null → ChatHistory unmounts from DOM
```

---

## Sidebar Gating Rules

| State | hist-tab visible | Sidebar opens | ChatHistory in DOM |
|-------|-----------------|---------------|--------------------|
| Guest (not logged in) | No | No | No |
| Loading (hydrating) | No | No | No |
| Logged in | Yes | Yes | Yes |

The `isLoading` state prevents a flash of the sidebar during initial hydration before the session is confirmed.

---

## Storage Strategy

| Data | Guest | Logged In |
|------|-------|-----------|
| `benefits_initial_message` (landing → chat handoff) | `sessionStorage` (already in place) | `sessionStorage` (same — transient, not worth persisting) |
| Chat history | Not stored | Supabase `sessions` table (future milestone — schema already exists) |
| User profile variables | In-memory React state only | Supabase `sessions.variables` (future milestone) |

---

## Supabase Dashboard Config Required

Before this works in production, the developer must configure in the Supabase dashboard:
1. **Authentication → Providers → Google**: enable, add OAuth client ID + secret from Google Cloud Console.
2. **Authentication → URL Configuration → Redirect URLs**: add `http://localhost:3000/auth/callback` (dev) and the production URL.
3. **Authentication → Email**: magic link is enabled by default — no change needed.

These are manual steps outside the codebase; document in `README.md` or `.env.local.example`.

---

## Out of Scope

- Persisting chat history to Supabase `sessions` table (future milestone).
- Profile page (auth-gated settings, notification prefs, privacy) — exists in the design prototype but not yet in the codebase.
- Rate limiting or abuse prevention on the magic link endpoint.
- Account deletion.
