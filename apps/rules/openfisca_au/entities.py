from openfisca_core.entities import build_entity

Person = build_entity(
    key="person",
    plural="persons",
    label="An individual",
    doc="A single individual assessed for benefits eligibility.",
    roles=[],
    is_person=True,
)

Household = build_entity(
    key="household",
    plural="households",
    label="A household",
    doc="A group of individuals living together, used for household-level assessments.",
    roles=[
        {"key": "principal", "plural": "principals", "label": "Principal", "max": 1},
        {"key": "partner", "plural": "partners", "label": "Partner", "max": 1},
        {"key": "child", "plural": "children", "label": "Dependent child"},
    ],
)

entities = [Person, Household]
