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
        assert data["traces"].get("FTB_A", {}).get("missing") is not None


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


# ── JobSeeker Payment ─────────────────────────────────────────────────────────

class TestJobSeeker:
    def test_eligible_unemployed_low_income(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "age": 30,
            "employment_status": "unemployed",
            "annual_income": 10000.0,
        })
        assert "JOBSEEKER" in data["eligible"]

    def test_eligible_part_time(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "age": 28,
            "employment_status": "part_time",
            "annual_income": 15000.0,
        })
        assert "JOBSEEKER" in data["eligible"]

    def test_ineligible_too_young(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "age": 20,
            "employment_status": "unemployed",
            "annual_income": 0.0,
        })
        assert "JOBSEEKER" in data["ineligible"]

    def test_ineligible_pension_age(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "age": 68,
            "employment_status": "unemployed",
            "annual_income": 0.0,
        })
        assert "JOBSEEKER" in data["ineligible"]

    def test_ineligible_income_too_high(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "age": 35,
            "employment_status": "part_time",
            "annual_income": 70000.0,
        })
        assert "JOBSEEKER" in data["ineligible"]

    def test_ineligible_fulltime_employed(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "age": 35,
            "employment_status": "full_time",
            "annual_income": 50000.0,
        })
        assert "JOBSEEKER" in data["ineligible"]


# ── Age Pension ───────────────────────────────────────────────────────────────

class TestAgePension:
    def test_eligible_retiree(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "age": 70,
            "annual_income": 20000.0,
        })
        assert "AGE_PENSION" in data["eligible"]

    def test_ineligible_too_young(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "age": 65,
            "annual_income": 0.0,
        })
        assert "AGE_PENSION" in data["ineligible"]

    def test_ineligible_income_too_high(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "age": 72,
            "annual_income": 80000.0,
        })
        assert "AGE_PENSION" in data["ineligible"]


# ── Disability Support Pension ────────────────────────────────────────────────

class TestDsp:
    def test_eligible_person_with_disability(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "age": 35,
            "has_disability": True,
            "annual_income": 10000.0,
        })
        assert "DSP" in data["eligible"]

    def test_ineligible_no_disability(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "age": 35,
            "has_disability": False,
            "annual_income": 10000.0,
        })
        assert "DSP" in data["ineligible"]

    def test_ineligible_pension_age(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "age": 68,
            "has_disability": True,
            "annual_income": 10000.0,
        })
        assert "DSP" in data["ineligible"]

    def test_ineligible_high_income(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "age": 40,
            "has_disability": True,
            "annual_income": 80000.0,
        })
        assert "DSP" in data["ineligible"]


# ── Carer Payment ─────────────────────────────────────────────────────────────

class TestCarerPayment:
    def test_eligible_carer_low_income(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "is_carer": True,
            "annual_income": 20000.0,
        })
        assert "CARER_PAYMENT" in data["eligible"]

    def test_ineligible_not_carer(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "is_carer": False,
            "annual_income": 20000.0,
        })
        assert "CARER_PAYMENT" in data["ineligible"]

    def test_ineligible_high_income(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "is_carer": True,
            "annual_income": 90000.0,
        })
        assert "CARER_PAYMENT" in data["ineligible"]


# ── Carer Allowance ───────────────────────────────────────────────────────────

class TestCarerAllowance:
    def test_eligible_carer(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "is_carer": True,
            "annual_income": 100000.0,
        })
        assert "CARER_ALLOWANCE" in data["eligible"]

    def test_ineligible_income_over_250k(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "is_carer": True,
            "annual_income": 260000.0,
        })
        assert "CARER_ALLOWANCE" in data["ineligible"]


# ── Youth Allowance ───────────────────────────────────────────────────────────

class TestYouthAllowance:
    def test_eligible_young_unemployed(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "age": 20,
            "employment_status": "unemployed",
            "annual_income": 8000.0,
        })
        assert "YOUTH_ALLOWANCE" in data["eligible"]

    def test_eligible_student(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "age": 22,
            "employment_status": "student",
            "annual_income": 12000.0,
        })
        assert "YOUTH_ALLOWANCE" in data["eligible"]

    def test_ineligible_over_24(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "age": 25,
            "employment_status": "unemployed",
            "annual_income": 5000.0,
        })
        assert "YOUTH_ALLOWANCE" in data["ineligible"]

    def test_ineligible_fulltime_work(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "age": 21,
            "employment_status": "full_time",
            "annual_income": 50000.0,
        })
        assert "YOUTH_ALLOWANCE" in data["ineligible"]


# ── Low Income Health Care Card ───────────────────────────────────────────────

class TestLihcc:
    def test_eligible_single_low_income(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "annual_income": 15000.0,
            "number_of_children": 0,
        })
        assert "LIHCC" in data["eligible"]

    def test_eligible_family_low_income(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "annual_income": 28000.0,
            "number_of_children": 2,
        })
        assert "LIHCC" in data["eligible"]

    def test_ineligible_single_high_income(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "annual_income": 25000.0,
            "number_of_children": 0,
        })
        assert "LIHCC" in data["ineligible"]

    def test_ineligible_family_high_income(self, client):
        data = post_calculate(client, {
            "is_australian_resident": True,
            "annual_income": 40000.0,
            "number_of_children": 2,
        })
        assert "LIHCC" in data["ineligible"]
