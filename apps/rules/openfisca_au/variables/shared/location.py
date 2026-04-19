from openfisca_core.variables import Variable
from openfisca_core.periods import ETERNITY
from openfisca_au.entities import Person


class state(Variable):
    value_type = str
    entity = Person
    definition_period = ETERNITY
    label = "Australian state or territory of residence"
    reference = "Universal input — NSW | VIC | QLD | SA | WA | TAS | ACT | NT"
    default_value = ""


class postcode(Variable):
    value_type = str
    entity = Person
    definition_period = ETERNITY
    label = "Australian postcode"
    reference = "Universal input — used to infer council_lga when not supplied directly"
    default_value = ""


class council_lga(Variable):
    value_type = str
    entity = Person
    definition_period = ETERNITY
    label = "Local Government Area (council)"
    reference = (
        "Universal input — covered LGAs at MVP: SYDNEY, BLACKTOWN, "
        "CANTERBURY_BANKSTOWN, CENTRAL_COAST, NORTHERN_BEACHES"
    )
    default_value = ""
