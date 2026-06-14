/**
 * Persisted user profile shape — mirrors the `profiles` table in Supabase
 * (migration 0003) and the form state shape used by the design's profile.jsx.
 */

export interface UserProfile {
  full_name: string | null
  preferred_name: string | null
  dob: string | null         // ISO YYYY-MM-DD
  language: string

  relationship: string | null  // single / couple / parent
  dependents: number
  living: string | null        // renting / owner / boarding
  state: string | null         // NSW / VIC / ...

  employment: string | null    // employed / unemployed / retired / student
  occupation: string | null
  study: string | null

  email_notif: boolean
  assessment_upd: boolean
  program_alerts: boolean
  improve_data: boolean
}

export const DEFAULT_PROFILE: UserProfile = {
  full_name: null,
  preferred_name: null,
  dob: null,
  language: 'English',
  relationship: null,
  dependents: 0,
  living: null,
  state: null,
  employment: null,
  occupation: null,
  study: null,
  email_notif: true,
  assessment_upd: true,
  program_alerts: false,
  improve_data: true,
}

/** All keys the PATCH endpoint accepts. Anything else is dropped. */
export const PATCHABLE_FIELDS: (keyof UserProfile)[] = [
  'full_name', 'preferred_name', 'dob', 'language',
  'relationship', 'dependents', 'living', 'state',
  'employment', 'occupation', 'study',
  'email_notif', 'assessment_upd', 'program_alerts', 'improve_data',
]
