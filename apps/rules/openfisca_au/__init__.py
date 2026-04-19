import os
from openfisca_core.taxbenefitsystems import TaxBenefitSystem
from .entities import entities

COUNTRY_DIR = os.path.dirname(os.path.abspath(__file__))


class AustraliaTaxBenefitSystem(TaxBenefitSystem):
    """
    OpenFisca country package for Australia.

    Covers three tiers of government:
      - Federal: Centrelink / Services Australia schemes
      - State:   NSW concessions
      - Council: Top-5 NSW LGAs (Sydney, Blacktown, Canterbury-Bankstown,
                 Central Coast, Northern Beaches)

    Variable formulas live in openfisca_au/variables/{federal,nsw,councils}/.
    Income thresholds and other time-varying parameters live in
    openfisca_au/parameters/.
    """

    def __init__(self) -> None:
        super().__init__(entities)

        variables_dir = os.path.join(COUNTRY_DIR, "variables")
        if os.path.isdir(variables_dir):
            self.add_variables_from_directory(variables_dir)

        params_dir = os.path.join(COUNTRY_DIR, "parameters")
        if os.path.isdir(params_dir):
            self.load_parameters(params_dir)
