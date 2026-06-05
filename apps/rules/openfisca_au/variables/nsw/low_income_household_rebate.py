from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class low_income_household_rebate_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for NSW Low Income Household Rebate"
    reference = "https://www.service.nsw.gov.au/transaction/apply-for-low-income-household-rebate"

    def formula(person, period, parameters):  # noqa: N805
        is_nsw = person("state", period) == "NSW"

        # Card-holder pathway
        has_pcc = person("has_pensioner_concession_card", period)
        has_lihcc = person("low_income_health_care_card_eligible", period)
        has_qualifying_card = has_pcc | has_lihcc

        # Income-only pathway (no card required)
        income = person("annual_income", period)
        threshold = parameters(period).nsw.low_income_household_rebate.household_income_threshold
        low_income = income <= threshold

        return is_nsw * (has_qualifying_card | low_income)
