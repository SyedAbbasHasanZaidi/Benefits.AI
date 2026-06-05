from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class northern_beaches_pensioner_rates_rebate_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Northern Beaches Council Pensioner Rates Rebate"
    reference = "https://www.northernbeaches.nsw.gov.au/council/rates-and-council-fees/pensioner-concession-information"

    def formula(person, period, parameters):  # noqa: N805
        is_nb = person("council_lga", period) == "NORTHERN_BEACHES"
        has_pcc = person("has_pensioner_concession_card", period)
        is_owner = person("tenure_type", period) == "owning"
        return is_nb * has_pcc * is_owner


class northern_beaches_rates_hardship_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Northern Beaches Council Rates Hardship Assistance"
    reference = "https://www.northernbeaches.nsw.gov.au/council/rates-and-fees"

    def formula(person, period, parameters):  # noqa: N805
        is_nb = person("council_lga", period) == "NORTHERN_BEACHES"
        hardship = person("has_financial_hardship", period)
        is_owner = person("tenure_type", period) == "owning"
        return is_nb * hardship * is_owner
