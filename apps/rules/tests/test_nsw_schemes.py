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
            "age": 40,
            "number_of_children": 0,
        })
        assert "NSW_LOW_INCOME_HOUSEHOLD_REBATE" in data["eligible"]

    def test_eligible_nsw_pensioner(self, client):
        """Pensioner Concession Card holder in NSW is eligible regardless of rebate income threshold."""
        data = post_calculate(client, {
            "state": "NSW",
            "annual_income": 60000.0,
            "age": 70,
            "number_of_children": 0,
            # age >= 67, income <= 65281 → age_pension_eligible → has_pensioner_concession_card
        })
        assert "NSW_LOW_INCOME_HOUSEHOLD_REBATE" in data["eligible"]

    def test_eligible_nsw_pensioner_no_children_field(self, client):
        """Pensioner should qualify without number_of_children being provided at all.
        Previously blocked because number_of_children was in required_inputs."""
        data = post_calculate(client, {
            "state": "NSW",
            "annual_income": 22000.0,
            "age": 72,
            "employment_status": "retired",
            # number_of_children deliberately omitted
        })
        assert "NSW_LOW_INCOME_HOUSEHOLD_REBATE" in data["eligible"]

    def test_ineligible_not_nsw(self, client):
        data = post_calculate(client, {
            "state": "VIC",
            "annual_income": 20000.0,
            "age": 40,
            "number_of_children": 0,
        })
        assert "NSW_LOW_INCOME_HOUSEHOLD_REBATE" in data["ineligible"]

    def test_ineligible_high_income_no_card(self, client):
        data = post_calculate(client, {
            "state": "NSW",
            "annual_income": 80000.0,
            "age": 45,
            "number_of_children": 0,
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


class TestNswGasRebate:
    def test_eligible_pensioner_nsw(self, client):
        """Age Pension recipient in NSW → has_pensioner_concession_card → eligible."""
        data = post_calculate(client, {
            "state": "NSW",
            "age": 70,
            "annual_income": 20000.0,
            "number_of_children": 0,
        })
        assert "NSW_GAS_REBATE" in data["eligible"]

    def test_ineligible_not_nsw(self, client):
        data = post_calculate(client, {
            "state": "VIC",
            "age": 70,
            "annual_income": 20000.0,
            "number_of_children": 0,
        })
        assert "NSW_GAS_REBATE" in data["ineligible"]

    def test_ineligible_no_card_high_income(self, client):
        data = post_calculate(client, {
            "state": "NSW",
            "age": 45,
            "annual_income": 80000.0,
            "number_of_children": 0,
        })
        assert "NSW_GAS_REBATE" in data["ineligible"]


class TestNswLifeSupportRebate:
    def test_eligible_life_support_nsw(self, client):
        data = post_calculate(client, {
            "state": "NSW",
            "uses_life_support_equipment": True,
        })
        assert "NSW_LIFE_SUPPORT_REBATE" in data["eligible"]

    def test_ineligible_no_equipment(self, client):
        data = post_calculate(client, {
            "state": "NSW",
            "uses_life_support_equipment": False,
        })
        assert "NSW_LIFE_SUPPORT_REBATE" in data["ineligible"]

    def test_ineligible_not_nsw(self, client):
        data = post_calculate(client, {
            "state": "QLD",
            "uses_life_support_equipment": True,
        })
        assert "NSW_LIFE_SUPPORT_REBATE" in data["ineligible"]


class TestNswSeniorsCard:
    def test_eligible_senior_part_time(self, client):
        data = post_calculate(client, {
            "state": "NSW",
            "age": 65,
            "hours_worked_per_week": 10.0,
        })
        assert "NSW_SENIORS_CARD" in data["eligible"]

    def test_eligible_senior_retired(self, client):
        data = post_calculate(client, {
            "state": "NSW",
            "age": 70,
            "hours_worked_per_week": 0.0,
        })
        assert "NSW_SENIORS_CARD" in data["eligible"]

    def test_ineligible_too_young(self, client):
        data = post_calculate(client, {
            "state": "NSW",
            "age": 55,
            "hours_worked_per_week": 0.0,
        })
        assert "NSW_SENIORS_CARD" in data["ineligible"]

    def test_ineligible_fulltime_work(self, client):
        data = post_calculate(client, {
            "state": "NSW",
            "age": 62,
            "hours_worked_per_week": 25.0,
        })
        assert "NSW_SENIORS_CARD" in data["ineligible"]

    def test_ineligible_not_nsw(self, client):
        data = post_calculate(client, {
            "state": "VIC",
            "age": 65,
            "hours_worked_per_week": 0.0,
        })
        assert "NSW_SENIORS_CARD" in data["ineligible"]
