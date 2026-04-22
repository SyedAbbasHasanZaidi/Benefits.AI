from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class ftb_a_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Family Tax Benefit Part A"
    reference = "https://www.servicesaustralia.gov.au/family-tax-benefit-part-a"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        has_qualifying_child = person("federal_has_qualifying_child", period)
        income = person("federal_adjusted_income", period)
        threshold = parameters(period).federal.ftb_a.higher_income_free_area
        income_test = income <= threshold
        return is_resident * has_qualifying_child * income_test
