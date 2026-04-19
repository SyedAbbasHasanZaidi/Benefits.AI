from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class annual_income(Variable):
    value_type = float
    entity = Person
    definition_period = YEAR
    label = "Total annual income before tax, all sources (AUD)"
    reference = (
        "Universal input — raw fact with no tier interpretation. "
        "Tier-specific income definitions (e.g. federal ATI, NSW household income) "
        "are derived in each tier's derived.py."
    )
    default_value = 0.0
