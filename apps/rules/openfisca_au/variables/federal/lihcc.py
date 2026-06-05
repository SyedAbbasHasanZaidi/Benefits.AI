from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class low_income_health_care_card_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Low Income Health Care Card (LIHCC)"
    reference = "https://www.servicesaustralia.gov.au/low-income-health-care-card"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        income = person("annual_income", period)
        has_children = person("number_of_children", period) >= 1
        single_threshold = parameters(period).federal.lihcc.income_threshold_single_annual
        family_threshold = parameters(period).federal.lihcc.income_threshold_family_annual
        # Families with children get the higher threshold
        threshold = has_children * family_threshold + (~has_children) * single_threshold
        income_ok = income <= threshold
        return is_resident * income_ok
