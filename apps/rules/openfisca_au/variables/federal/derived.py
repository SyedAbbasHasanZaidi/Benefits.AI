from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class federal_adjusted_income(Variable):
    value_type = float
    entity = Person
    definition_period = YEAR
    label = "Federal adjusted taxable income (ATI)"
    reference = (
        "MVP simplification: ATI equals annual_income with no deductions. "
        "Reportable fringe benefits, investment losses, and super contributions "
        "are deferred post-MVP."
    )
    default_value = 0.0

    def formula(person, period, parameters):  # noqa: N805
        return person("annual_income", period) # MVP simplification: no deductions or adjustments


class federal_has_qualifying_child(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Has at least one FTB qualifying child"
    reference = (
        "A child qualifies if under 16. "
        "16-19 in full-time study is deferred post-MVP."
    )
    default_value = False

    def formula(person, period, parameters):  # noqa: N805
        has_children = person("number_of_children", period) >= 1
        child_is_young = person("youngest_child_age", period) < 16
        return has_children * child_is_young


class has_pensioner_concession_card(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Holds a Pensioner Concession Card (issued automatically with qualifying payments)"
    reference = (
        "PCC is automatically issued with: Age Pension, DSP, Carer Payment. "
        "MVP: derived from federal eligibility variables."
    )
    default_value = False

    def formula(person, period, parameters):  # noqa: N805
        return (
            person("age_pension_eligible", period)
            | person("dsp_eligible", period)
            | person("carer_payment_eligible", period)
        )
