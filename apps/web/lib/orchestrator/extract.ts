import type { LlmProvider } from '@/lib/llm/LlmProvider'
import type { ProfileVariables } from './profile'

const KNOWN_KEYS = new Set<keyof ProfileVariables>([
  'is_australian_resident',
  'age',
  'annual_income',
  'state',
  'council_lga',
  'tenure_type',
  'rent_paid_fortnightly',
  'number_of_children',
  'youngest_child_age',
  'has_partner',
  'employment_status',
  'hours_worked_per_week',
  'has_disability',
  'is_carer',
  'has_financial_hardship',
  'uses_life_support_equipment',
])

const EXTRACTION_SYSTEM = `You extract eligibility variables from a user message. Return ONLY a JSON object containing variables you can extract with confidence. Omit variables that are not clearly stated or strongly implied. Do not guess. Do not add keys outside this schema.

Schema (extract only these keys):
  is_australian_resident  boolean
  age                     number
  annual_income           number          (annual AUD)
  state                   string          (e.g. "NSW", "VIC")
  council_lga             string          (e.g. "Blacktown", "Sydney")
  tenure_type             "renting" | "owner" | "boarding"
  rent_paid_fortnightly   number          (AUD per fortnight)
  number_of_children      number
  youngest_child_age      number
  has_partner             boolean
  employment_status       "employed" | "retired" | "unemployed" | "student"
  hours_worked_per_week   number
  has_disability          boolean
  is_carer                boolean
  has_financial_hardship  boolean
  uses_life_support_equipment boolean

---

Example 1 — explicit info mixed with irrelevant noise:
User: "I'm 68, retired, renting in Blacktown for $400 a fortnight. I love gardening."
Output: {"age":68,"employment_status":"retired","tenure_type":"renting","council_lga":"Blacktown","state":"NSW","rent_paid_fortnightly":400}

Example 2 — implicit signal ("on the pension" implies retired but NOT a specific age):
User: "I've been on the age pension for two years, I live alone in Victoria."
Output: {"employment_status":"retired","has_partner":false,"state":"VIC"}

Example 3 — chip/short answer with no prose context:
User: "Yes"
Output: {}

Example 4 — nothing extractable:
User: "What kind of help can I get?"
Output: {}`

export async function extract(
  userMessage: string,
  currentProfile: ProfileVariables,
  llm: LlmProvider,
): Promise<Partial<ProfileVariables>> {
  const profileJson = JSON.stringify(currentProfile, null, 2)
  const userContent = `Current profile (already known — do NOT re-extract these):\n${profileJson}\n\nNow extract from:\nUser: ${userMessage}\nOutput:`

  const response = await llm.generate({
    system: EXTRACTION_SYSTEM,
    messages: [{ role: 'user', content: userContent }],
    maxTokens: 256,
  })

  try {
    const raw: unknown = JSON.parse(response.text.trim())
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}

    const valid: Partial<ProfileVariables> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (KNOWN_KEYS.has(k as keyof ProfileVariables)) {
        ;(valid as Record<string, unknown>)[k] = v
      }
    }
    return valid
  } catch {
    return {}
  }
}
