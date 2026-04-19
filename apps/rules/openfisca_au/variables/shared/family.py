from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR, ETERNITY
from openfisca_au.entities import Person


class has_partner(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Living with a partner or spouse"
    reference = (
        "Universal input — raw fact only. Tier-specific couple definitions "
        "(e.g. federal de facto rules) are derived in federal/derived.py."
    )
    default_value = False


class number_of_children(Variable):
    value_type = int
    entity = Person
    definition_period = YEAR
    label = "Number of dependent children in care"
    default_value = 0


class youngest_child_age(Variable):
    value_type = int
    entity = Person
    definition_period = YEAR
    label = "Age of youngest dependent child (years)"
    reference = "Universal input — 0 if no children"
    default_value = 0


class has_disability(Variable):
    value_type = bool
    entity = Person
    definition_period = ETERNITY
    label = "Has a recognised disability or medical condition"
    default_value = False


class is_carer(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Provides unpaid care to another person"
    default_value = False
