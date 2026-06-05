from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class central_coast_pensioner_rates_rebate_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Central Coast Council Pensioner Rates Rebate"
    reference = "https://www.centralcoast.nsw.gov.au/residents/property/pay-rates-and-water-bills/rebates-and-hardship-assistance"

    def formula(person, period, parameters):  # noqa: N805
        is_cc = person("council_lga", period) == "CENTRAL_COAST"
        has_pcc = person("has_pensioner_concession_card", period)
        is_owner = person("tenure_type", period) == "owning"
        return is_cc * has_pcc * is_owner


class central_coast_rates_hardship_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Central Coast Council Rates Hardship Assistance"
    reference = "https://www.centralcoast.nsw.gov.au/residents/property/pay-rates-and-water-bills/rebates-and-hardship-assistance"

    def formula(person, period, parameters):  # noqa: N805
        is_cc = person("council_lga", period) == "CENTRAL_COAST"
        hardship = person("has_financial_hardship", period)
        is_owner = person("tenure_type", period) == "owning"
        return is_cc * hardship * is_owner
