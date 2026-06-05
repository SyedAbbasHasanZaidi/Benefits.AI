from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class life_support_rebate_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for NSW Life Support Rebate"
    reference = "https://www.service.nsw.gov.au/transaction/apply-for-life-support-rebate"

    def formula(person, period, parameters):  # noqa: N805
        is_nsw = person("state", period) == "NSW"
        life_support = person("uses_life_support_equipment", period)
        return is_nsw * life_support
