from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR, ETERNITY
from openfisca_au.entities import Person


class age(Variable):
    value_type = int
    entity = Person
    definition_period = YEAR
    label = "Age in years"
    reference = "Universal input — no tier interpretation required"


class is_australian_resident(Variable):
    value_type = bool
    entity = Person
    definition_period = ETERNITY
    label = "Lives in Australia"
    reference = "Universal input — whether the person resides in Australia"
    default_value = True
