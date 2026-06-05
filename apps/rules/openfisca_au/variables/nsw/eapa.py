from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class eapa_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for NSW Energy Accounts Payment Assistance (EAPA)"
    reference = "https://www.service.nsw.gov.au/transaction/apply-for-energy-accounts-payment-assistance-eapa"

    def formula(person, period, parameters):  # noqa: N805
        is_nsw = person("state", period) == "NSW"
        hardship = person("has_financial_hardship", period)
        return is_nsw * hardship
