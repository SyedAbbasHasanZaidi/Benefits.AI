from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class gas_rebate_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for NSW Gas Rebate"
    reference = "https://www.service.nsw.gov.au/transaction/apply-for-gas-rebate"

    def formula(person, period, parameters):  # noqa: N805
        is_nsw = person("state", period) == "NSW"
        has_pcc = person("has_pensioner_concession_card", period)
        has_lihcc = person("low_income_health_care_card_eligible", period)
        has_qualifying_card = has_pcc | has_lihcc
        return is_nsw * has_qualifying_card
