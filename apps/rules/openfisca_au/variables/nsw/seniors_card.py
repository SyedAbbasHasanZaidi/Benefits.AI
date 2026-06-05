from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class seniors_card_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for NSW Seniors Card"
    reference = "https://www.service.nsw.gov.au/transaction/apply-for-a-seniors-card"

    def formula(person, period, parameters):  # noqa: N805
        is_nsw = person("state", period) == "NSW"
        age = person("age", period)
        qualifying_age = parameters(period).nsw.seniors_card.qualifying_age
        old_enough = age >= qualifying_age
        hours = person("hours_worked_per_week", period)
        max_hours = parameters(period).nsw.seniors_card.max_hours_per_week
        works_few_hours = hours <= max_hours
        return is_nsw * old_enough * works_few_hours
