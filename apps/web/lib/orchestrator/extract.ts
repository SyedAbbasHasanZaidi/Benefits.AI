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

const EXTRACTION_SYSTEM = `You extract eligibility variables from a user message. Return ONLY a JSON object containing variables you can extract with confidence. Omit variables that are not clearly stated or strongly implied. Do not guess. Do not add keys outside this schema. If the user did not literally state or strongly imply a fact, OMIT that key entirely. An empty {} is the correct answer when nothing extractable was said.

Schema (extract only these keys):
  is_australian_resident  boolean
  age                     number
  annual_income           number          (annual AUD)
  state                   string          (e.g. "NSW", "VIC")
  council_lga             string          (e.g. "Blacktown", "Sydney")
  tenure_type             "renting" | "owning" | "boarding"
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

Example 1:explicit info mixed with irrelevant noise:
User: "I'm 68, retired, renting in Blacktown for $400 a fortnight. I love gardening."
Output: {"age":68,"employment_status":"retired","tenure_type":"renting","council_lga":"Blacktown","state":"NSW","rent_paid_fortnightly":400}

Example 2:implicit signal ("on the pension" implies retired but NOT a specific age):
User: "I've been on the age pension for two years, I live alone in Victoria."
Output: {"employment_status":"retired","has_partner":false,"state":"VIC"}

Example 3:chip/short answer with no prose context:
User: "Yes"
Output: {}

Example 4:nothing extractable:
User: "What kind of help can I get?"
Output: {}

Example 5:sparse statement, no inferred residency/age/income/location:
User: "I recently lost my job."
Output: {"employment_status":"unemployed"}

Example 6:vague frequency, omit numeric (do NOT set hours_worked_per_week or employment_status):
User: "I've been picking up shifts here and there."
Output: {}

Example 7:super/pension drawdowns and employment income both count as annual_income for Centrelink. Extract the total annual income from all regular sources:
User: "I'm 70, retired. Super pays me $30k a year."
Output: {"age":70,"employment_status":"retired","annual_income":30000}

Example 8:refusal / "don't know" never re-fills from prior turns:
User: "I'd rather not say."
Output: {}

Example 9:city-to-state mapping is deterministic and welcome (Sydney→NSW, Melbourne/melbs→VIC, Brisbane/brissy→QLD, Perth→WA, Adelaide→SA, Hobart→TAS, Canberra→ACT, Darwin→NT):
User: "im 28 living in melbs, no job rn"
Output: {"age":28,"state":"VIC","employment_status":"unemployed"}

Example 10:travel ≠ residency claim. Only set is_australian_resident when user says citizen / permanent resident / "I'm Australian":
User: "just got back from overseas"
Output: {}

Example 11:"just had my birthday" / "just turned" implies age + 1:
User: "I was 17 but just had my birthday"
Output: {"age":18}

Example 12:user-typed RANGES are ambiguous, never collapse them to a midpoint. Only a literally stated single value counts. Ranges must be OMITTED so the bot can ask for clarification. This rule applies to every numeric field (age, annual_income, rent_paid_fortnightly, number_of_children, youngest_child_age, hours_worked_per_week):
User: "18-23"
Output: {}
User: "somewhere between 25 and 30"
Output: {}
User: "I earn $40-60k"
Output: {}
User: "I'm in my late 20s"
Output: {}
User: "around 30 hours a week"
Output: {"hours_worked_per_week":30}   // a single approximate value is fine; a RANGE is not

Example 13:abbreviated income amounts ("k" suffix, with or without "$"):
User: "i get bout 25k a yr frm super"
Output: {"annual_income":25000,"employment_status":"retired"}
User: "earnt maybe 5k since i got made redundant, before that was on 75k"
Output: {"annual_income":5000,"employment_status":"unemployed"}
Note: when two income figures are present (a prior job and a current situation), extract the CURRENT/MOST RECENT one only.

Example 14:statements of no income or near-zero — do NOT set annual_income:0 unless a specific zero figure is given:
User: "no income coming in basically, just that small cash work"
Output: {"employment_status":"unemployed"}
User: "I'm not working at all right now"
Output: {"employment_status":"unemployed"}
Note: "no income" alone is not sufficient to set annual_income:0 — the user may have other income sources not yet mentioned. Only set annual_income when a specific figure is given.`

export async function extract(
  userMessage: string,
  currentProfile: ProfileVariables,
  llm: LlmProvider,
): Promise<Partial<ProfileVariables>> {
  const profileJson = JSON.stringify(currentProfile, null, 2)
  const userContent = `Current profile (already known:do NOT re-extract these):\n${profileJson}\n\nNow extract from:\nUser: ${userMessage}\nOutput:`

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
