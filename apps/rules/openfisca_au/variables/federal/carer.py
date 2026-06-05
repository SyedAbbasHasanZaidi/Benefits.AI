from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class carer_payment_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Carer Payment"
    reference = "https://www.servicesaustralia.gov.au/carer-payment"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        is_carer = person("is_carer", period)
        income = person("annual_income", period)
        threshold = parameters(period).federal.carer_payment.income_threshold_annual
        income_ok = income <= threshold
        return is_resident * is_carer * income_ok


class carer_allowance_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Carer Allowance"
    reference = "https://www.servicesaustralia.gov.au/carer-allowance"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        is_carer = person("is_carer", period)
        income = person("annual_income", period)
        threshold = parameters(period).federal.carer_allowance.income_threshold_annual
        income_ok = income <= threshold
        return is_resident * is_carer * income_ok
