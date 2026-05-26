from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR, ETERNITY
from openfisca_au.entities import Person


class employment_status(Variable):
    value_type = str
    entity = Person
    definition_period = YEAR
    label = "Current employment status"
    reference = (
        "Universal input — full_time | part_time | unemployed | "
        "self_employed | retired | student | not_seeking"
    )
    default_value = ""


class is_fulltime_student(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Enrolled full-time in a recognised course of study"
    default_value = False


class hours_worked_per_week(Variable):
    value_type = float
    entity = Person
    definition_period = YEAR
    label = "Average hours worked per week"
    default_value = 0.0


class has_financial_hardship(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Experiencing financial hardship (unable to pay essential energy bills)"
    default_value = False


class uses_life_support_equipment(Variable):
    value_type = bool
    entity = Person
    definition_period = ETERNITY
    label = "Requires approved life support equipment powered by electricity or gas"
    default_value = False
