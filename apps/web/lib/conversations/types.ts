import type { Message } from 'ai'
import type { ProfileVariables } from '@/lib/orchestrator/profile'
import type { ResultsData } from '@/lib/eligibility/types'

export interface ConversationSummary {
  id: string
  title: string
  status: string | null   // e.g. "4 matches" — populated after assessment
  ts: number              // ms since epoch (updated_at)
}

export interface ConversationDetail {
  id: string
  title: string
  status: string | null
  variables: ProfileVariables
  messages: Message[]
  latestAssessment: ResultsData | null
  createdAt: string
  updatedAt: string
}

export function titleFromFirstMessage(text: string): string {
  const t = text.trim()
  return t.length > 38 ? t.slice(0, 36).trim() + '…' : t
}
