import type { EligibilityResult } from '@/lib/orchestrator/turn'
import type { ProfileVariables } from '@/lib/orchestrator/profile'
import type { SchemeMetadata } from '@/components/SchemeCard'
import type { Program, ResultsData } from './types'
import { valueFor } from './values'

/**
 * Translates a friendly variable name + value into a one-line audit statement.
 * Used to build the `matchedCriteria[]` array the design's claim-pathway modal
 * surfaces so users see exactly why they qualified.
 */
const CRITERION_TEXT: Partial<Record<keyof ProfileVariables, (v: unknown) => string>> = {
  is_australian_resident: (v) => v ? "You're an Australian resident" : '',
  age:                    (v) => `You're ${v as number} years old`,
  state:                  (v) => `You live in ${v as string}`,
  council_lga:            (v) => `You live in ${v as string}`,
  tenure_type:            (v) => v === 'renting' ? "You're renting"
                              : v === 'owner'   ? "You own your home"
                              : v === 'boarding' ? "You're boarding"
                              : '',
  employment_status:      (v) => v === 'employed'   ? "You're employed"
                              : v === 'unemployed' ? "You're looking for work"
                              : v === 'retired'    ? "You're retired"
                              : v === 'student'    ? "You're a full-time student"
                              : '',
  annual_income:          (v) => `Annual income $${(v as number).toLocaleString()}`,
  has_partner:            (v) => v ? "You have a partner" : "You don't have a partner",
  number_of_children:     (v) => `${v as number} dependent ${(v as number) === 1 ? 'child' : 'children'}`,
  youngest_child_age:     (v) => `Youngest child is ${v as number}`,
  rent_paid_fortnightly:  (v) => `Rent ~$${v as number}/fortnight`,
  has_disability:         (v) => v ? "You have a disability or chronic condition" : '',
  is_carer:               (v) => v ? "You're a carer" : '',
  has_financial_hardship: (v) => v ? "You're experiencing financial hardship" : '',
  uses_life_support_equipment: (v) => v ? "Household uses life support equipment" : '',
}

function buildMatchedCriteria(
  scheme: SchemeMetadata & { required_inputs?: string[] },
  profile: ProfileVariables,
): string[] {
  const required = (scheme as { required_inputs?: string[] }).required_inputs ?? []
  const out: string[] = []
  for (const varName of required) {
    const value = (profile as Record<string, unknown>)[varName]
    if (value === undefined || value === null || value === '') continue
    const formatter = CRITERION_TEXT[varName as keyof ProfileVariables]
    if (formatter) {
      const text = formatter(value)
      if (text) out.push(text)
    }
  }
  return out
}

/**
 * Maps the OpenFisca rules engine's binary eligibility result into the design's
 * three-tier ResultsData shape with confidence badges and annual $ values.
 *
 * Tier mapping:
 *   eligible[]     → conf: "strong"  (verified — passes all OpenFisca rules)
 *   needs_info[]   → conf: "info"    (missing required variables)
 *   ineligible[]   → excluded        (don't surface failed matches)
 *
 * The "likely" tier is reserved for a future v2 enhancement where we check
 * whether the user's income is within a margin of the cutoff. For now,
 * everything OpenFisca returns as eligible is treated as "strong".
 */
export function transformToResults(
  eligibility: EligibilityResult,
  schemes: SchemeMetadata[],
  profile: ProfileVariables,
): ResultsData {
  const schemeMap = new Map(schemes.map((s) => [s.id, s]))
  const programs: Program[] = []

  // Strong matches — verified eligible
  for (const id of eligibility.eligible) {
    const scheme = schemeMap.get(id)
    if (!scheme) continue
    programs.push({
      schemeId: id,
      name: scheme.name,
      agency: scheme.agency,
      value: valueFor(id),
      conf: 'strong',
      desc: scheme.plain_description ?? '',
      claimUrl: scheme.apply_url,
      matchedCriteria: buildMatchedCriteria(scheme, profile),
    })
  }

  // Info — needs more data
  for (const item of eligibility.needs_info) {
    const scheme = schemeMap.get(item.schemeId)
    if (!scheme) continue
    programs.push({
      schemeId: item.schemeId,
      name: scheme.name,
      agency: scheme.agency,
      value: 0,
      conf: 'info',
      desc: scheme.plain_description ?? '',
      claimUrl: scheme.apply_url,
    })
  }

  // Sort: strong first, then likely, then info — preserving order within each
  const order: Record<Program['conf'], number> = { strong: 0, likely: 1, info: 2 }
  programs.sort((a, b) => order[a.conf] - order[b.conf])

  // total = sum of value for non-info; claimable = count of non-info
  const nonInfo = programs.filter((p) => p.conf !== 'info')
  const total = nonInfo.reduce((sum, p) => sum + p.value, 0)
  const claimable = nonInfo.length

  return { programs, total, claimable }
}
