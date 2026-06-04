from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person

AGE_PENSION_AGE = 67


class jobseeker_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for JobSeeker Payment"
    reference = "https://www.servicesaustralia.gov.au/jobseeker-payment"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        age = person("age", period)
        min_age = parameters(period).federal.jobseeker.min_age
        in_age_range = (age >= min_age) & (age < AGE_PENSION_AGE)
        status = person("employment_status", period)
        is_seeking_work = (status == "unemployed") | (status == "part_time")
        income = person("annual_income", period)
        threshold = parameters(period).federal.jobseeker.income_threshold_single_annual
        income_ok = income <= threshold
        return is_resident * in_age_range * is_seeking_work * income_ok
