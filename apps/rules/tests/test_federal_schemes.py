"""
Eligibility tests for federal schemes using known worked examples.
Each test mirrors a real-world scenario from Services Australia policy.
"""
import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def post_calculate(client: TestClient, variables: dict) -> dict:
    return client.post("/calculate", json={"variables": variables}).json()


# ── FTB-A ────────────────────────────────────────────────────────────────────

class TestFtbA:
    def test_eligible_family_low_income(self, client):
        """Family with 2 children and income well below threshold is eligible."""
        data = post_calculate(client, {
            "is_australian_resident": True,
            "number_of_children": 2,
            "youngest_child_age": 5,
            "annual_income": 45000.0,
        })
        assert "FTB_A" in data["eligible"]

    def test_ineligible_high_income(self, client):
        """Income above $80,478 higher income free area → ineligible."""
        data = post_calculate(client, {
            "is_australian_resident": True,
            "number_of_children": 1,
            "youngest_child_age": 8,
            "annual_income": 95000.0,
        })
        assert "FTB_A" in data["ineligible"]

    def test_ineligible_no_children(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "number_of_children": 0,
            "youngest_child_age": 0,
            "annual_income": 40000.0,
        })
        assert "FTB_A" in data["ineligible"]

    def test_ineligible_child_too_old(self, client):
        """Children aged 16+ do not qualify at MVP."""
        data = post_calculate(client, {
            "is_australian_resident": True,
            "number_of_children": 1,
            "youngest_child_age": 17,
            "annual_income": 40000.0,
        })
        assert "FTB_A" in data["ineligible"]

    def test_missing_variables_when_income_absent(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "number_of_children": 2,
            "youngest_child_age": 4,
            # annual_income deliberately omitted
        })
        assert "annual_income" in data["missing_variables"]
        assert "FTB_A" not in data["eligible"]
        assert "FTB_A" not in data["ineligible"]


# ── Rent Assistance ───────────────────────────────────────────────────────────

class TestRentAssistance:
    def test_eligible_private_renter(self, client):
        """Private renter paying above minimum threshold is eligible."""
        data = post_calculate(client, {
            "is_australian_resident": True,
            "tenure_type": "renting",
            "rent_paid_fortnightly": 600.0,
        })
        assert "RENT_ASSISTANCE" in data["eligible"]

    def test_ineligible_owner(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "tenure_type": "owning",
            "rent_paid_fortnightly": 0.0,
        })
        assert "RENT_ASSISTANCE" in data["ineligible"]

    def test_ineligible_low_rent(self, client):
        """Rent below the minimum fortnightly threshold → ineligible."""
        data = post_calculate(client, {
            "is_australian_resident": True,
            "tenure_type": "renting",
            "rent_paid_fortnightly": 10.0,
        })
        assert "RENT_ASSISTANCE" in data["ineligible"]

    def test_non_resident_ineligible(self, client):
        data = post_calculate(client, {
            "is_australian_resident": False,
            "tenure_type": "renting",
            "rent_paid_fortnightly": 600.0,
        })
        assert "RENT_ASSISTANCE" in data["ineligible"]
