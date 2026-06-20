export type TenureType = 'renting' | 'owning' | 'boarding'
export type EmploymentStatus = 'employed' | 'retired' | 'unemployed' | 'student'

export interface ProfileVariables {
  is_australian_resident?: boolean
  age?: number
  annual_income?: number
  state?: string
  council_lga?: string
  tenure_type?: TenureType
  rent_paid_fortnightly?: number
  number_of_children?: number
  youngest_child_age?: number
  has_partner?: boolean
  employment_status?: EmploymentStatus
  hours_worked_per_week?: number
  has_disability?: boolean
  is_carer?: boolean
  has_financial_hardship?: boolean
  uses_life_support_equipment?: boolean
}

export function mergeProfile(
  current: ProfileVariables,
  delta: Partial<ProfileVariables>,
): ProfileVariables {
  return { ...current, ...delta }
}
