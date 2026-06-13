import type { ProfileVariables } from './profile'

export interface VariableGuidance {
  explanation: string
  links: { label: string; url: string }[]
}

export const VARIABLE_GUIDANCE: Partial<Record<keyof ProfileVariables, VariableGuidance>> = {
  is_australian_resident: {
    explanation:
      'This means you hold Australian citizenship, a permanent visa, or certain protected visas. Temporary visa holders generally do not qualify for Centrelink payments.',
    links: [
      {
        label: 'Check your visa type — Home Affairs',
        url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing',
      },
      {
        label: 'Residence rules for payments — Services Australia',
        url: 'https://www.servicesaustralia.gov.au/residence-descriptions',
      },
    ],
  },

  annual_income: {
    explanation:
      'Your total income before tax for the current financial year — including wages, investment income, and government payments. Centrelink uses your combined household income if you have a partner.',
    links: [
      { label: 'View your income statement — myGov / ATO', url: 'https://my.gov.au' },
      {
        label: 'What counts as income — Services Australia',
        url: 'https://www.servicesaustralia.gov.au/income-and-assets',
      },
    ],
  },

  council_lga: {
    explanation:
      'Your Local Government Area — the council responsible for where you live. This determines which council concession schemes you may qualify for.',
    links: [
      {
        label: 'Find your LGA — Local Government Directory',
        url: 'https://www.localgovernment.nsw.gov.au/find-your-council',
      },
      {
        label: 'Find your council — NSW Government',
        url: 'https://www.nsw.gov.au/find-your-council',
      },
    ],
  },

  rent_paid_fortnightly: {
    explanation:
      'The rent you pay every two weeks (fortnightly). Check your lease agreement or rental receipts. If you pay weekly, multiply by 2.',
    links: [
      {
        label: 'Understanding your lease — NSW Fair Trading',
        url: 'https://www.fairtrading.nsw.gov.au/housing-and-property/renting',
      },
    ],
  },

  has_disability: {
    explanation:
      'Whether you have a physical, intellectual, or psychiatric condition that substantially reduces your ability to work or participate in daily life. You do not need a formal diagnosis — self-assessment is the starting point.',
    links: [
      {
        label: 'Disability Support Pension eligibility — Services Australia',
        url: 'https://www.servicesaustralia.gov.au/disability-support-pension',
      },
      {
        label: 'Am I eligible — NDIS',
        url: 'https://www.ndis.gov.au/applying-access-ndis/am-i-eligible',
      },
    ],
  },

  is_carer: {
    explanation:
      'Whether you provide regular, ongoing care to someone with a disability, serious illness, or frailty due to age. This includes caring for a family member or friend — formal registration is not required.',
    links: [
      { label: 'Am I a carer — Carer Gateway', url: 'https://www.carergateway.gov.au/am-i-a-carer' },
      {
        label: 'Carer Payment eligibility — Services Australia',
        url: 'https://www.servicesaustralia.gov.au/carer-payment',
      },
    ],
  },

  has_financial_hardship: {
    explanation:
      'Whether you are struggling to meet basic living costs — for example, difficulty paying rent, utilities, or food. There is no formal threshold; it is based on your circumstances.',
    links: [
      {
        label: 'Financial hardship assistance — Services Australia',
        url: 'https://www.servicesaustralia.gov.au/if-you-are-in-financial-crisis-or-emergency',
      },
      { label: 'National Debt Helpline', url: 'https://ndh.org.au' },
    ],
  },

  uses_life_support_equipment: {
    explanation:
      'Whether anyone in your household depends on electrically powered medical equipment — such as a ventilator, oxygen concentrator, or dialysis machine. Your energy retailer needs to be notified separately.',
    links: [
      {
        label: 'Life support protections — AER',
        url: 'https://www.aer.gov.au/consumers/my-energy-contract/life-support-protections',
      },
      {
        label: 'Medical Energy Rebate — NSW Government',
        url: 'https://www.service.nsw.gov.au/transaction/apply-for-the-medical-energy-rebate',
      },
    ],
  },

  hours_worked_per_week: {
    explanation:
      'The average number of hours you work each week across all jobs. Check your employment contract or recent payslips.',
    links: [
      {
        label: 'Understanding your hours — Fair Work',
        url: 'https://www.fairwork.gov.au/employee-entitlements/hours-of-work-breaks-and-rosters',
      },
    ],
  },

  employment_status: {
    explanation:
      'Your current work situation: employed (working for pay), retired (stopped working), unemployed (looking for work), or student (studying full-time).',
    links: [
      {
        label: 'Payments while looking for work — Services Australia',
        url: 'https://www.servicesaustralia.gov.au/payments-while-looking-for-work',
      },
    ],
  },

  tenure_type: {
    explanation:
      'Whether you rent your home, own it (with or without a mortgage), or board with someone else. Check your lease or property title if unsure.',
    links: [
      {
        label: 'Renting vs owning — MoneySmart',
        url: 'https://moneysmart.gov.au/living-costs/renting-vs-buying',
      },
    ],
  },
}
