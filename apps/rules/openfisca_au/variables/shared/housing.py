from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class tenure_type(Variable):
    value_type = str
    entity = Person
    definition_period = YEAR
    label = "Housing tenure type"
    reference = "Universal input — renting | owning | boarding | other"
    default_value = ""


class rent_paid_fortnightly(Variable):
    value_type = float
    entity = Person
    definition_period = YEAR
    label = "Rent actually paid (AUD per fortnight)"
    reference = "Universal input — 0.0 if not renting"
    default_value = 0.0
