"""
Eligibility tests for NSW council concession schemes.
All council schemes require council_lga to match the specific LGA.
"""
import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def post_calculate(client, variables: dict) -> dict:
    return client.post("/calculate", json={"variables": variables}).json()


# ── Pensioner Rates Rebate helpers ────────────────────────────────────────────

def pensioner_owner_payload(lga: str) -> dict:
    """Age Pension-eligible owner-occupier in the given LGA."""
    return {
        "council_lga": lga,
        "tenure_type": "owning",
        "age": 70,
        "annual_income": 25000.0,
    }


def renter_pensioner_payload(lga: str) -> dict:
    """Pensioner who rents — ineligible for rates rebate."""
    return {
        "council_lga": lga,
        "tenure_type": "renting",
        "age": 70,
        "annual_income": 25000.0,
    }


# ── Sydney Pensioner Rates Rebate ─────────────────────────────────────────────

class TestSydneyPensionerRatesRebate:
    SCHEME = "COUNCIL_SYDNEY_PENSIONER_RATES_REBATE"

    def test_eligible_pensioner_owner(self, client):
        data = post_calculate(client, pensioner_owner_payload("SYDNEY"))
        assert self.SCHEME in data["eligible"]

    def test_ineligible_renter(self, client):
        data = post_calculate(client, renter_pensioner_payload("SYDNEY"))
        assert self.SCHEME in data["ineligible"]

    def test_ineligible_wrong_lga(self, client):
        data = post_calculate(client, pensioner_owner_payload("BLACKTOWN"))
        assert self.SCHEME in data["ineligible"]


# ── Blacktown Pensioner Rates Rebate ──────────────────────────────────────────

class TestBlacktownPensionerRatesRebate:
    SCHEME = "COUNCIL_BLACKTOWN_PENSIONER_RATES_REBATE"

    def test_eligible_pensioner_owner(self, client):
        data = post_calculate(client, pensioner_owner_payload("BLACKTOWN"))
        assert self.SCHEME in data["eligible"]

    def test_ineligible_renter(self, client):
        data = post_calculate(client, renter_pensioner_payload("BLACKTOWN"))
        assert self.SCHEME in data["ineligible"]

    def test_ineligible_wrong_lga(self, client):
        data = post_calculate(client, pensioner_owner_payload("SYDNEY"))
        assert self.SCHEME in data["ineligible"]


# ── Canterbury-Bankstown Pensioner Rates Rebate ───────────────────────────────

class TestCanterburyBankstonPensionerRatesRebate:
    SCHEME = "COUNCIL_CANTERBURY_BANKSTOWN_PENSIONER_RATES_REBATE"

    def test_eligible_pensioner_owner(self, client):
        data = post_calculate(client, pensioner_owner_payload("CANTERBURY_BANKSTOWN"))
        assert self.SCHEME in data["eligible"]

    def test_ineligible_renter(self, client):
        data = post_calculate(client, renter_pensioner_payload("CANTERBURY_BANKSTOWN"))
        assert self.SCHEME in data["ineligible"]

    def test_ineligible_wrong_lga(self, client):
        data = post_calculate(client, pensioner_owner_payload("SYDNEY"))
        assert self.SCHEME in data["ineligible"]


# ── Central Coast Pensioner Rates Rebate ─────────────────────────────────────

class TestCentralCoastPensionerRatesRebate:
    SCHEME = "COUNCIL_CENTRAL_COAST_PENSIONER_RATES_REBATE"

    def test_eligible_pensioner_owner(self, client):
        data = post_calculate(client, pensioner_owner_payload("CENTRAL_COAST"))
        assert self.SCHEME in data["eligible"]

    def test_ineligible_renter(self, client):
        data = post_calculate(client, renter_pensioner_payload("CENTRAL_COAST"))
        assert self.SCHEME in data["ineligible"]

    def test_ineligible_wrong_lga(self, client):
        data = post_calculate(client, pensioner_owner_payload("SYDNEY"))
        assert self.SCHEME in data["ineligible"]


# ── Northern Beaches Pensioner Rates Rebate ───────────────────────────────────

class TestNorthernBeachesPensionerRatesRebate:
    SCHEME = "COUNCIL_NORTHERN_BEACHES_PENSIONER_RATES_REBATE"

    def test_eligible_pensioner_owner(self, client):
        data = post_calculate(client, pensioner_owner_payload("NORTHERN_BEACHES"))
        assert self.SCHEME in data["eligible"]

    def test_ineligible_renter(self, client):
        data = post_calculate(client, renter_pensioner_payload("NORTHERN_BEACHES"))
        assert self.SCHEME in data["ineligible"]

    def test_ineligible_wrong_lga(self, client):
        data = post_calculate(client, pensioner_owner_payload("BLACKTOWN"))
        assert self.SCHEME in data["ineligible"]


# ── Hardship helpers ──────────────────────────────────────────────────────────

def hardship_owner_payload(lga: str) -> dict:
    return {
        "council_lga": lga,
        "tenure_type": "owning",
        "has_financial_hardship": True,
    }


# ── Sydney Rates Hardship ─────────────────────────────────────────────────────

class TestSydneyRatesHardship:
    SCHEME = "COUNCIL_SYDNEY_RATES_HARDSHIP"

    def test_eligible_hardship_owner(self, client):
        data = post_calculate(client, hardship_owner_payload("SYDNEY"))
        assert self.SCHEME in data["eligible"]

    def test_ineligible_no_hardship(self, client):
        data = post_calculate(client, {
            "council_lga": "SYDNEY",
            "tenure_type": "owning",
            "has_financial_hardship": False,
        })
        assert self.SCHEME in data["ineligible"]

    def test_ineligible_wrong_lga(self, client):
        data = post_calculate(client, hardship_owner_payload("BLACKTOWN"))
        assert self.SCHEME in data["ineligible"]


# ── Blacktown Rates Hardship ──────────────────────────────────────────────────

class TestBlacktownRatesHardship:
    SCHEME = "COUNCIL_BLACKTOWN_RATES_HARDSHIP"

    def test_eligible_hardship_owner(self, client):
        data = post_calculate(client, hardship_owner_payload("BLACKTOWN"))
        assert self.SCHEME in data["eligible"]

    def test_ineligible_wrong_lga(self, client):
        data = post_calculate(client, hardship_owner_payload("SYDNEY"))
        assert self.SCHEME in data["ineligible"]


# ── Canterbury-Bankstown Rates Hardship ───────────────────────────────────────

class TestCanterburyBankstonRatesHardship:
    SCHEME = "COUNCIL_CANTERBURY_BANKSTOWN_RATES_HARDSHIP"

    def test_eligible_hardship_owner(self, client):
        data = post_calculate(client, hardship_owner_payload("CANTERBURY_BANKSTOWN"))
        assert self.SCHEME in data["eligible"]

    def test_ineligible_wrong_lga(self, client):
        data = post_calculate(client, hardship_owner_payload("SYDNEY"))
        assert self.SCHEME in data["ineligible"]


# ── Central Coast Rates Hardship ─────────────────────────────────────────────

class TestCentralCoastRatesHardship:
    SCHEME = "COUNCIL_CENTRAL_COAST_RATES_HARDSHIP"

    def test_eligible_hardship_owner(self, client):
        data = post_calculate(client, hardship_owner_payload("CENTRAL_COAST"))
        assert self.SCHEME in data["eligible"]

    def test_ineligible_wrong_lga(self, client):
        data = post_calculate(client, hardship_owner_payload("SYDNEY"))
        assert self.SCHEME in data["ineligible"]


# ── Northern Beaches Rates Hardship ───────────────────────────────────────────

class TestNorthernBeachesRatesHardship:
    SCHEME = "COUNCIL_NORTHERN_BEACHES_RATES_HARDSHIP"

    def test_eligible_hardship_owner(self, client):
        data = post_calculate(client, hardship_owner_payload("NORTHERN_BEACHES"))
        assert self.SCHEME in data["eligible"]

    def test_ineligible_wrong_lga(self, client):
        data = post_calculate(client, hardship_owner_payload("SYDNEY"))
        assert self.SCHEME in data["ineligible"]


# ── Sydney Aquatic Access ─────────────────────────────────────────────────────

class TestSydneyAquaticAccess:
    SCHEME = "COUNCIL_SYDNEY_AQUATIC_ACCESS"

    def test_eligible_pensioner_sydney(self, client):
        """Age Pension recipient in Sydney → has_pensioner_concession_card → eligible."""
        data = post_calculate(client, {
            "council_lga": "SYDNEY",
            "age": 70,
            "annual_income": 25000.0,
            "number_of_children": 0,
        })
        assert self.SCHEME in data["eligible"]

    def test_eligible_lihcc_sydney(self, client):
        """Low-income single person qualifies via LIHCC pathway."""
        data = post_calculate(client, {
            "council_lga": "SYDNEY",
            "age": 40,
            "annual_income": 15000.0,
            "number_of_children": 0,
        })
        assert self.SCHEME in data["eligible"]

    def test_ineligible_wrong_lga(self, client):
        data = post_calculate(client, {
            "council_lga": "BLACKTOWN",
            "age": 70,
            "annual_income": 25000.0,
            "number_of_children": 0,
        })
        assert self.SCHEME in data["ineligible"]

    def test_ineligible_no_qualifying_card(self, client):
        """High-income non-pensioner — no qualifying card."""
        data = post_calculate(client, {
            "council_lga": "SYDNEY",
            "age": 40,
            "annual_income": 80000.0,
            "number_of_children": 0,
        })
        assert self.SCHEME in data["ineligible"]
