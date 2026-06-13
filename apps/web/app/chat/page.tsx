import { ChatPage } from '@/components/ChatPage'
import type { SchemeMetadata } from '@/components/SchemeCard'

const RULES_URL = process.env.RULES_SERVICE_URL ?? 'http://localhost:8001'

async function fetchSchemes(): Promise<SchemeMetadata[]> {
  try {
    const res = await fetch(`${RULES_URL}/schemes`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    const data = (await res.json()) as { schemes?: SchemeMetadata[] }
    return data.schemes ?? []
  } catch {
    return []
  }
}

export default async function ChatRoute() {
  const schemes = await fetchSchemes()
  return <ChatPage schemes={schemes} />
}
