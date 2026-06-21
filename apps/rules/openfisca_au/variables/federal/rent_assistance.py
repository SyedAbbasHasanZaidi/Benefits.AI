from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class rent_assistance_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Commonwealth Rent Assistance"
    reference = "https://www.servicesaustralia.gov.au/rent-assistance"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        tenure = person("tenure_type", period)
        is_renting = (tenure == "renting") | (tenure == "boarding")
        rent = person("rent_paid_fortnightly", period)
        min_rent = parameters(period).federal.rent_assistance.min_rent_fortnightly
        pays_enough_rent = rent > min_rent
        return is_resident * is_renting * pays_enough_rent


class rent_assistance_fortnightly_rate(Variable):
    value_type = float
    entity = Person
    definition_period = YEAR
    label = "Commonwealth Rent Assistance fortnightly payment rate (AUD)"
    reference = "https://www.servicesaustralia.gov.au/rent-assistance"

    def formula(person, period, parameters):  # noqa: N805
        eligible = person("rent_assistance_eligible", period)
        max_rate = parameters(period).federal.rent_assistance.max_rate_single
        return eligible * max_rate
