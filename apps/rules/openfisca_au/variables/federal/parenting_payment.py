from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person

SINGLE_CHILD_AGE_LIMIT = 8   # Under 8 for single parents
PARTNERED_CHILD_AGE_LIMIT = 6  # Under 6 for partnered


class parenting_payment_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Parenting Payment"
    reference = "https://www.servicesaustralia.gov.au/parenting-payment"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        has_children = person("number_of_children", period) >= 1
        youngest_age = person("youngest_child_age", period)
        has_partner = person("has_partner", period)

        # Single parents: youngest child must be under 8
        single_child_ok = (~has_partner) & (youngest_age < SINGLE_CHILD_AGE_LIMIT)
        # Partnered parents: youngest child must be under 6
        partnered_child_ok = has_partner & (youngest_age < PARTNERED_CHILD_AGE_LIMIT)
        child_age_ok = single_child_ok | partnered_child_ok

        income = person("annual_income", period)
        # MVP simplification: uses single threshold for both single and partnered parents
        threshold = parameters(period).federal.parenting_payment.income_threshold_single_annual
        income_ok = income <= threshold

        return is_resident * has_children * child_age_ok * income_ok
