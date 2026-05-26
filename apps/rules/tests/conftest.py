"""
Suppress the openfisca-core logging bug that fires a TypeError when it tries to
format a warning about missing package metadata for the local `openfisca_au`
package.  The bug is in openfisca_core.taxbenefitsystems.tax_benefit_system and
affects openfisca-core>=44 when the country package is installed under a
different distribution name (e.g. 'benefits-ai-rules').  TBS initialisation
still succeeds; only the log message is malformed.
"""
import logging


class _SuppressOpenfiscaMetadataWarning(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Drop the malformed "Unable to load package metadata" warning that
        # triggers a TypeError inside logging.emit in openfisca-core 44.x.
        if (
            record.name == "openfisca_core.taxbenefitsystems.tax_benefit_system"
            and record.levelno == logging.WARNING
        ):
            return False
        return True


logging.getLogger(
    "openfisca_core.taxbenefitsystems.tax_benefit_system"
).addFilter(_SuppressOpenfiscaMetadataWarning())
