from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class age_pension_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Age Pension"
    reference = "https://www.servicesaustralia.gov.au/age-pension"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        age = person("age", period)
        qualifying_age = parameters(period).federal.age_pension.qualifying_age
        old_enough = age >= qualifying_age
        income = person("annual_income", period)
        threshold = parameters(period).federal.age_pension.income_threshold_single_annual
        income_ok = income <= threshold
        return is_resident * old_enough * income_ok
