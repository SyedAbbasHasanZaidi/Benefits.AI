/**
 * Estimated annual dollar value per scheme — used by the eligibility
 * transformer to populate `Program.value` in the design's ResultsData shape.
 *
 * These are INDICATIVE figures only (Australian welfare 2025 baseline rates,
 * average household scenarios). The actual amount depends on the user's
 * specific income, family size, tenure, location, and the relevant agency's
 * determination. The UI clearly states these are estimates, not promises.
 *
 * 0 means "value unknown without further data" — these schemes get the
 * "info" tier in the design.
 */

export const SCHEME_ANNUAL_VALUE: Record<string, number> = {
  // ── Federal — Centrelink income support ──
  AGE_PENSION:        25_000,  // max single rate ≈ $1,096 fortnight × 26
  CARER_ALLOWANCE:     4_200,  // ≈ $162/fn × 26
  CARER_PAYMENT:      24_000,
  DSP:                26_000,  // Disability Support Pension
  JOBSEEKER:          18_400,  // ≈ $708/fn × 26 (single, no children)
  PARENTING_PAYMENT:  24_000,  // single-parent rate
  YOUTH_ALLOWANCE:    13_000,  // student rate

  // ── Federal — family ──
  FTB_A:               5_300,  // per child, max base rate
  FTB_B:               4_500,  // single-income family max

  // ── Federal — rent / health ──
  RENT_ASSISTANCE:     1_820,  // max single, no dependants
  LIHCC:                 620,  // Low Income Health Care Card — concession value est.

  // ── NSW — energy & utilities ──
  NSW_LOW_INCOME_HOUSEHOLD_REBATE: 350,
  NSW_GAS_REBATE:                  110,
  NSW_LIFE_SUPPORT_REBATE:         290,
  NSW_EAPA:                         50,  // Energy Accounts Payment Assistance voucher
  NSW_SENIORS_CARD:                  0,  // travel concessions, no cash value

  // ── Council rates rebates (NSW LGAs) ──
  COUNCIL_SYDNEY_PENSIONER_RATES_REBATE:             250,
  COUNCIL_SYDNEY_RATES_HARDSHIP:                       0,
  COUNCIL_SYDNEY_AQUATIC_ACCESS:                       0,
  COUNCIL_BLACKTOWN_PENSIONER_RATES_REBATE:          250,
  COUNCIL_BLACKTOWN_RATES_HARDSHIP:                    0,
  COUNCIL_CANTERBURY_BANKSTOWN_PENSIONER_RATES_REBATE: 250,
  COUNCIL_CANTERBURY_BANKSTOWN_RATES_HARDSHIP:         0,
  COUNCIL_CENTRAL_COAST_PENSIONER_RATES_REBATE:      250,
  COUNCIL_CENTRAL_COAST_RATES_HARDSHIP:                0,
  COUNCIL_NORTHERN_BEACHES_PENSIONER_RATES_REBATE:   250,
  COUNCIL_NORTHERN_BEACHES_RATES_HARDSHIP:             0,
}

/** Returns the estimated annual value for a scheme, defaulting to 0. */
export function valueFor(schemeId: string): number {
  return SCHEME_ANNUAL_VALUE[schemeId] ?? 0
}
