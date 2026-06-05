from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person

DSP_MIN_AGE = 16
DSP_MAX_AGE = 67  # exclusive — Age Pension takes over at qualifying_age


class dsp_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Disability Support Pension"
    reference = "https://www.servicesaustralia.gov.au/disability-support-pension"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        age = person("age", period)
        in_age_range = (age >= DSP_MIN_AGE) & (age < DSP_MAX_AGE)
        has_disability = person("has_disability", period)
        income = person("annual_income", period)
        threshold = parameters(period).federal.dsp.income_threshold_annual
        income_ok = income <= threshold
        return is_resident * in_age_range * has_disability * income_ok
