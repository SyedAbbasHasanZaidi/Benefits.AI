from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class blacktown_pensioner_rates_rebate_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Blacktown City Council Pensioner Rates Rebate"
    reference = "https://www.blacktown.nsw.gov.au/About-Council/Your-rates/Pensioner-rebates"

    def formula(person, period, parameters):  # noqa: N805
        is_blacktown = person("council_lga", period) == "BLACKTOWN"
        has_pcc = person("has_pensioner_concession_card", period)
        is_owner = person("tenure_type", period) == "owning"
        return is_blacktown * has_pcc * is_owner
