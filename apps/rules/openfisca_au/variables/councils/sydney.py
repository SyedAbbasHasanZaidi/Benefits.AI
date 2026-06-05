from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person

REBATE_AMOUNT = 250  # Legislated maximum — Local Government Act 1993 s575


class sydney_pensioner_rates_rebate_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for City of Sydney Pensioner Rates Rebate"
    reference = "https://www.cityofsydney.nsw.gov.au/rates/apply-pensioner-rebate-rates"

    def formula(person, period, parameters):  # noqa: N805
        is_sydney = person("council_lga", period) == "SYDNEY"
        has_pcc = person("has_pensioner_concession_card", period)
        is_owner = person("tenure_type", period) == "owning"
        return is_sydney * has_pcc * is_owner
