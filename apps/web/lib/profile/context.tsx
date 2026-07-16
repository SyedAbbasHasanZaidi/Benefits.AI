'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import type { UserProfile } from '@/lib/profile/types'

interface ProfileCache {
  data: UserProfile | null
  fetchedAt: number | null
}

interface ProfileContextValue {
  cache: ProfileCache
  setCache: (data: UserProfile) => void
  invalidate: () => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCacheState] = useState<ProfileCache>({ data: null, fetchedAt: null })

  const setCache = useCallback((data: UserProfile) => {
    setCacheState({ data, fetchedAt: Date.now() })
  }, [])

  const invalidate = useCallback(() => {
    setCacheState({ data: null, fetchedAt: null })
  }, [])

  return (
    <ProfileContext.Provider value={{ cache, setCache, invalidate }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfileCache() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfileCache must be used inside ProfileProvider')
  return ctx
}
