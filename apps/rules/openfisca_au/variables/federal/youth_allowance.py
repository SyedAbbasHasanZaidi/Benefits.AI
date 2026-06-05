from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person

YOUTH_ALLOWANCE_MIN_AGE = 16


class youth_allowance_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Youth Allowance"
    reference = "https://www.servicesaustralia.gov.au/youth-allowance"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        age = person("age", period)
        max_age = parameters(period).federal.youth_allowance.max_age
        in_age_range = (age >= YOUTH_ALLOWANCE_MIN_AGE) & (age < max_age)
        status = person("employment_status", period)
        qualifying_status = (
            (status == "unemployed")
            | (status == "part_time")
            | (status == "student")
        )
        income = person("annual_income", period)
        threshold = parameters(period).federal.youth_allowance.income_threshold_annual
        income_ok = income <= threshold
        return is_resident * in_age_range * qualifying_status * income_ok
