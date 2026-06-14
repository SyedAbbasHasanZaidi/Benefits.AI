/**
 * Contract types matching the design's `BACKEND_INTEGRATION.md` (seam 3).
 * The UI depends on these shapes exactly — do not rename fields.
 */

/** A single program/scheme in the results view. */
export interface Program {
  /** Program/scheme title — e.g. "JobSeeker Payment" */
  name: string
  /** Responsible body — e.g. "Services Australia" */
  agency: string
  /** Estimated annual $ value; 0 when unknown or for "info" tier */
  value: number
  /**
   * Confidence tier — drives the UI badge + CTA:
   * - strong: VERIFIED ELIGIBLE (green badge, "View claim pathway")
   * - likely: probable, pending confirmation ("View claim pathway")
   * - info:   needs more data ("Tell us more" → routes to profile)
   */
  conf: 'strong' | 'likely' | 'info'
  /** One-line plain-English explanation */
  desc: string

  // Extended fields (optional — threaded into the claim modal)
  /** Deep-link to the agency's official claim page */
  claimUrl?: string
  /** Plain-English statements explaining why this scheme matched */
  matchedCriteria?: string[]
  /** Internal scheme id — used for audit and refetch */
  schemeId?: string
}

/** The full ResultsData payload returned by `/api/eligibility/assess`. */
export interface ResultsData {
  /** Ordered list, strongest matches first */
  programs: Program[]
  /** Sum of `value` for all non-"info" programs */
  total: number
  /** Count of non-"info" programs */
  claimable: number
}
