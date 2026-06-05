"""
Eligibility tests for NSW state concession schemes.
All NSW schemes require state == "NSW".
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


class TestNswLowIncomeRebate:
    def test_eligible_nsw_low_income(self, client):
        data = post_calculate(client, {
            "state": "NSW",
            "annual_income": 35000.0,
        })
        assert "NSW_LOW_INCOME_HOUSEHOLD_REBATE" in data["eligible"]

    def test_eligible_nsw_pensioner(self, client):
        """Pensioner Concession Card holder in NSW is eligible regardless of rebate income threshold."""
        data = post_calculate(client, {
            "state": "NSW",
            "annual_income": 60000.0,
            "age": 70,
            # age >= 67, income <= 65281 → age_pension_eligible → has_pensioner_concession_card
        })
        assert "NSW_LOW_INCOME_HOUSEHOLD_REBATE" in data["eligible"]

    def test_ineligible_not_nsw(self, client):
        data = post_calculate(client, {
            "state": "VIC",
            "annual_income": 20000.0,
        })
        assert "NSW_LOW_INCOME_HOUSEHOLD_REBATE" in data["ineligible"]

    def test_ineligible_high_income_no_card(self, client):
        data = post_calculate(client, {
            "state": "NSW",
            "annual_income": 80000.0,
        })
        assert "NSW_LOW_INCOME_HOUSEHOLD_REBATE" in data["ineligible"]


class TestNswEapa:
    def test_eligible_nsw_hardship(self, client):
        data = post_calculate(client, {
            "state": "NSW",
            "has_financial_hardship": True,
        })
        assert "NSW_EAPA" in data["eligible"]

    def test_ineligible_not_nsw(self, client):
        data = post_calculate(client, {
            "state": "QLD",
            "has_financial_hardship": True,
        })
        assert "NSW_EAPA" in data["ineligible"]

    def test_ineligible_no_hardship(self, client):
        data = post_calculate(client, {
            "state": "NSW",
            "has_financial_hardship": False,
        })
        assert "NSW_EAPA" in data["ineligible"]
