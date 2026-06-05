from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class canterbury_bankstown_pensioner_rates_rebate_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Canterbury-Bankstown Council Pensioner Rates Rebate"
    reference = "https://www.cbcity.nsw.gov.au/your-council/forms/application-council-pensioner-concession-rates-rebate"

    def formula(person, period, parameters):  # noqa: N805
        is_cb = person("council_lga", period) == "CANTERBURY_BANKSTOWN"
        has_pcc = person("has_pensioner_concession_card", period)
        is_owner = person("tenure_type", period) == "owning"
        return is_cb * has_pcc * is_owner


class canterbury_bankstown_rates_hardship_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Canterbury-Bankstown Council Rates Hardship Assistance"
    reference = "https://www.cbcity.nsw.gov.au/residents/rates/rates-hardship-assistance"

    def formula(person, period, parameters):  # noqa: N805
        is_cb = person("council_lga", period) == "CANTERBURY_BANKSTOWN"
        hardship = person("has_financial_hardship", period)
        is_owner = person("tenure_type", period) == "owning"
        return is_cb * hardship * is_owner
