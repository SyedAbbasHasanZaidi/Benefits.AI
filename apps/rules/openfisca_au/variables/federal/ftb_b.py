from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class ftb_b_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Family Tax Benefit Part B"
    reference = "https://www.servicesaustralia.gov.au/family-tax-benefit-part-b"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        has_qualifying_child = person("federal_has_qualifying_child", period)
        income = person("annual_income", period)
        threshold = parameters(period).federal.ftb_b.primary_income_threshold
        income_ok = income <= threshold
        return is_resident * has_qualifying_child * income_ok
