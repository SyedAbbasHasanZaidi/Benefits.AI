# Milestone 3: Real Eligibility Engine + 13 Schemes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the real `/calculate` and `/schemes` endpoints, add all 8 remaining federal and 5 NSW schemes, write eligibility tests against known worked examples, and create corpus markdown for every scheme.

**Architecture:** Each scheme YAML gains `eligibility_variable` + `required_inputs` fields. `/schemes` loads every `schemes/*.yaml`. `/calculate` builds a single-Person OpenFisca simulation, checks required inputs before computing, returns `eligible/ineligible/missing_variables/traces`. NSW formulas cross-tier-stack by importing federal derived variables (e.g. `has_pensioner_concession_card`).

**Tech Stack:** OpenFisca-core ≥43, FastAPI, PyYAML, pytest, Python 3.12

---

## File Map

**Shared variables (new file):**
- `apps/rules/openfisca_au/variables/shared/work.py` — employment_status, is_fulltime_student, hours_worked_per_week, has_financial_hardship, uses_life_support_equipment

**Federal variables (new files):**
- `apps/rules/openfisca_au/variables/federal/jobseeker.py`
- `apps/rules/openfisca_au/variables/federal/age_pension.py`
- `apps/rules/openfisca_au/variables/federal/dsp.py`
- `apps/rules/openfisca_au/variables/federal/carer.py` — carer_payment_eligible, carer_allowance_eligible
- `apps/rules/openfisca_au/variables/federal/youth_allowance.py`
- `apps/rules/openfisca_au/variables/federal/lihcc.py`
- `apps/rules/openfisca_au/variables/federal/ftb_b.py`
- `apps/rules/openfisca_au/variables/federal/parenting_payment.py`

**Federal derived (update existing):**
- `apps/rules/openfisca_au/variables/federal/derived.py` — add has_pensioner_concession_card

**NSW variables (new files):**
- `apps/rules/openfisca_au/variables/nsw/low_income_household_rebate.py`
- `apps/rules/openfisca_au/variables/nsw/eapa.py`
- `apps/rules/openfisca_au/variables/nsw/gas_rebate.py`
- `apps/rules/openfisca_au/variables/nsw/life_support_rebate.py`
- `apps/rules/openfisca_au/variables/nsw/seniors_card.py`

**Parameters (new directories + YAML files):**
- `apps/rules/openfisca_au/parameters/federal/jobseeker/income_threshold_single_annual.yaml`
- `apps/rules/openfisca_au/parameters/federal/jobseeker/min_age.yaml`
- `apps/rules/openfisca_au/parameters/federal/age_pension/qualifying_age.yaml`
- `apps/rules/openfisca_au/parameters/federal/age_pension/income_threshold_single_annual.yaml`
- `apps/rules/openfisca_au/parameters/federal/dsp/income_threshold_annual.yaml`
- `apps/rules/openfisca_au/parameters/federal/carer_payment/income_threshold_annual.yaml`
- `apps/rules/openfisca_au/parameters/federal/carer_allowance/income_threshold_annual.yaml`
- `apps/rules/openfisca_au/parameters/federal/youth_allowance/max_age.yaml`
- `apps/rules/openfisca_au/parameters/federal/youth_allowance/income_threshold_annual.yaml`
- `apps/rules/openfisca_au/parameters/federal/lihcc/income_threshold_single_annual.yaml`
- `apps/rules/openfisca_au/parameters/federal/lihcc/income_threshold_family_annual.yaml`
- `apps/rules/openfisca_au/parameters/federal/ftb_b/primary_income_threshold.yaml`
- `apps/rules/openfisca_au/parameters/federal/parenting_payment/income_threshold_single_annual.yaml`
- `apps/rules/openfisca_au/parameters/nsw/seniors_card/qualifying_age.yaml`
- `apps/rules/openfisca_au/parameters/nsw/seniors_card/max_hours_per_week.yaml`
- `apps/rules/openfisca_au/parameters/nsw/low_income_household_rebate/household_income_threshold.yaml`

**Scheme YAMLs (update existing + create):**
- `apps/rules/schemes/FTB_A.yaml` — add eligibility_variable, required_inputs
- `apps/rules/schemes/RENT_ASSISTANCE.yaml` — add eligibility_variable, required_inputs
- `apps/rules/schemes/JOBSEEKER.yaml`
- `apps/rules/schemes/AGE_PENSION.yaml`
- `apps/rules/schemes/DSP.yaml`
- `apps/rules/schemes/CARER_PAYMENT.yaml`
- `apps/rules/schemes/CARER_ALLOWANCE.yaml`
- `apps/rules/schemes/YOUTH_ALLOWANCE.yaml`
- `apps/rules/schemes/LIHCC.yaml`
- `apps/rules/schemes/FTB_B.yaml`
- `apps/rules/schemes/PARENTING_PAYMENT.yaml`
- `apps/rules/schemes/NSW_LOW_INCOME_HOUSEHOLD_REBATE.yaml`
- `apps/rules/schemes/NSW_EAPA.yaml`
- `apps/rules/schemes/NSW_GAS_REBATE.yaml`
- `apps/rules/schemes/NSW_LIFE_SUPPORT_REBATE.yaml`
- `apps/rules/schemes/NSW_SENIORS_CARD.yaml`

**Engine (update existing):**
- `apps/rules/main.py` — implement /schemes and /calculate

**Tests (new files):**
- `apps/rules/tests/test_federal_schemes.py`
- `apps/rules/tests/test_nsw_schemes.py`
- `apps/rules/tests/test_calculate_endpoint.py`

**Corpus (new files):**
- `corpus/federal/ftb_a.md`
- `corpus/federal/rent_assistance.md`
- `corpus/federal/jobseeker.md`
- `corpus/federal/age_pension.md`
- `corpus/federal/dsp.md`
- `corpus/federal/carer_payment.md`
- `corpus/federal/carer_allowance.md`
- `corpus/federal/youth_allowance.md`
- `corpus/federal/lihcc.md`
- `corpus/federal/ftb_b.md`
- `corpus/federal/parenting_payment.md`
- `corpus/nsw/low_income_household_rebate.md`
- `corpus/nsw/eapa.md`
- `corpus/nsw/gas_rebate.md`
- `corpus/nsw/life_support_rebate.md`
- `corpus/nsw/seniors_card.md`

---

## Task 1: Shared Work Variables

**Files:**
- Create: `apps/rules/openfisca_au/variables/shared/work.py`

- [ ] **Step 1: Create `work.py`**

```python
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
```

- [ ] **Step 2: Verify TBS loads the new variables**

```bash
cd apps/rules
python -c "from openfisca_au import AustraliaTaxBenefitSystem; tbs = AustraliaTaxBenefitSystem(); print('employment_status' in tbs.variables)"
```
Expected: `True`

- [ ] **Step 3: Commit**

```bash
git add apps/rules/openfisca_au/variables/shared/work.py
git commit -m "feat: add shared work variables (employment_status, hours_worked_per_week, etc.)"
```

---

## Task 2: Implement `/schemes` and `/calculate` Endpoints

**Files:**
- Modify: `apps/rules/main.py`

- [ ] **Step 1: Write tests first** (in `apps/rules/tests/test_calculate_endpoint.py`)

```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_schemes_loads_yaml_files():
    """After adding YAML files, /schemes must return a non-empty list."""
    response = client.get("/schemes")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["schemes"], list)
    # At least the two existing schemes should be present
    ids = {s["id"] for s in body["schemes"]}
    assert "FTB_A" in ids
    assert "RENT_ASSISTANCE" in ids


def test_calculate_all_missing():
    """Empty variables → all required inputs flagged as missing."""
    response = client.post("/calculate", json={"variables": {}})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["missing_variables"], list)
    assert len(data["missing_variables"]) > 0


def test_calculate_eligible_rent_assistance():
    response = client.post(
        "/calculate",
        json={
            "variables": {
                "is_australian_resident": True,
                "tenure_type": "renting",
                "rent_paid_fortnightly": 600.0,
            }
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "RENT_ASSISTANCE" in data["eligible"]


def test_calculate_ineligible_rent_assistance_owner():
    response = client.post(
        "/calculate",
        json={
            "variables": {
                "is_australian_resident": True,
                "tenure_type": "owning",
                "rent_paid_fortnightly": 0.0,
            }
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "RENT_ASSISTANCE" in data["ineligible"]


def test_calculate_traces_include_scheme_ids():
    response = client.post(
        "/calculate",
        json={
            "variables": {
                "is_australian_resident": True,
                "tenure_type": "renting",
                "rent_paid_fortnightly": 500.0,
            }
        },
    )
    data = response.json()
    assert "traces" in data
    assert isinstance(data["traces"], dict)
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/rules
pytest tests/test_calculate_endpoint.py -v
```
Expected: `test_schemes_loads_yaml_files` fails (returns empty list), others may pass or fail depending on stub.

- [ ] **Step 3: Replace the stub `/schemes` and `/calculate` in `main.py`**

Replace the entire `main.py` with:

```python
from contextlib import asynccontextmanager
import datetime
import os
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openfisca_core.periods import ETERNITY
from openfisca_core.simulation_builder import SimulationBuilder
from pydantic import BaseModel

load_dotenv()

from openfisca_au import AustraliaTaxBenefitSystem  # noqa: E402

tbs: AustraliaTaxBenefitSystem | None = None

SCHEMES_DIR = Path(__file__).parent / "schemes"
CURRENT_YEAR = str(datetime.date.today().year)


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    global tbs
    tbs = AustraliaTaxBenefitSystem()
    yield
    tbs = None


app = FastAPI(
    title="Benefits.AI Rules Service",
    version="0.1.0",
    description="Deterministic eligibility engine — OpenFisca country package for Australia.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("WEB_ORIGIN", "http://localhost:3000")],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_schemes() -> list[dict[str, Any]]:
    schemes: list[dict[str, Any]] = []
    if not SCHEMES_DIR.is_dir():
        return schemes
    for path in sorted(SCHEMES_DIR.glob("*.yaml")):
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            schemes.append(data)
    return schemes


def _period_key(var_name: str) -> str:
    """Return the period string to use when setting a variable in the simulation."""
    if tbs is None:
        return CURRENT_YEAR
    var = tbs.variables.get(var_name)
    if var is not None and var.definition_period == ETERNITY:
        return "ETERNITY"
    return CURRENT_YEAR


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/healthz", tags=["ops"])
def healthz() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "benefits-ai-rules",
        "tbs_loaded": tbs is not None,
    }


# ── Variable registry ─────────────────────────────────────────────────────────

@app.get("/variables", tags=["registry"])
def list_variables() -> dict[str, Any]:
    """Returns the full variable registry from OpenFisca."""
    if tbs is None:
        raise HTTPException(503, detail="Tax-benefit system not initialised")
    return {
        "variables": [
            {
                "name": name,
                "label": var.label or "",
                "value_type": var.value_type.__name__,
                "entity": var.entity.key,
                "definition_period": str(var.definition_period),
            }
            for name, var in tbs.variables.items()
        ]
    }


# ── Scheme metadata ───────────────────────────────────────────────────────────

@app.get("/schemes", tags=["registry"])
def list_schemes() -> dict[str, Any]:
    """Returns metadata for every codified scheme loaded from schemes/*.yaml."""
    return {"schemes": _load_schemes()}


# ── Eligibility calculation ───────────────────────────────────────────────────

class CalculateRequest(BaseModel):
    variables: dict[str, Any]


class CalculateResponse(BaseModel):
    eligible: list[str]
    ineligible: list[str]
    missing_variables: list[str]
    traces: dict[str, Any]


@app.post("/calculate", response_model=CalculateResponse, tags=["engine"])
def calculate(body: CalculateRequest) -> CalculateResponse:
    """
    Evaluates all codified schemes against the supplied variable values.

    missing_variables lists inputs needed by at least one scheme that were
    not provided — the orchestrator uses this list to ask the LLM to collect
    more information from the user.
    """
    if tbs is None:
        raise HTTPException(503, detail="Tax-benefit system not initialised")

    schemes = _load_schemes()
    provided_vars = set(body.variables.keys())

    # Build a single-person simulation from the provided inputs.
    person_input: dict[str, Any] = {}
    for var_name, value in body.variables.items():
        if var_name in tbs.variables:
            person_input[var_name] = {_period_key(var_name): value}

    try:
        simulation = SimulationBuilder().build_from_entities(
            tbs, {"persons": {"person1": person_input}}
        )
    except Exception as exc:
        raise HTTPException(422, detail=f"Simulation build failed: {exc}") from exc

    eligible: list[str] = []
    ineligible: list[str] = []
    all_missing: set[str] = set()
    traces: dict[str, Any] = {}

    for scheme in schemes:
        scheme_id: str = scheme.get("id", "")
        eligibility_var: str | None = scheme.get("eligibility_variable")
        required_inputs: list[str] = scheme.get("required_inputs", [])

        if not eligibility_var:
            continue

        scheme_missing = [v for v in required_inputs if v not in provided_vars]
        if scheme_missing:
            all_missing.update(scheme_missing)
            traces[scheme_id] = {"missing": scheme_missing}
            continue

        try:
            result = simulation.calculate(eligibility_var, CURRENT_YEAR)
            is_eligible = bool(result[0])
        except Exception as exc:
            traces[scheme_id] = {"error": str(exc)}
            continue

        if is_eligible:
            eligible.append(scheme_id)
        else:
            ineligible.append(scheme_id)

        traces[scheme_id] = {
            "result": is_eligible,
            "inputs": {k: body.variables[k] for k in required_inputs if k in body.variables},
        }

    return CalculateResponse(
        eligible=eligible,
        ineligible=ineligible,
        missing_variables=sorted(all_missing),
        traces=traces,
    )
```

- [ ] **Step 4: Update `FTB_A.yaml` and `RENT_ASSISTANCE.yaml` with `eligibility_variable` + `required_inputs`**

`apps/rules/schemes/FTB_A.yaml`:
```yaml
id: FTB_A
name: Family Tax Benefit Part A
tier: federal
agency: Services Australia
apply_url: https://www.servicesaustralia.gov.au/family-tax-benefit-part-a
delivery_channel: federal_direct
eligibility_variable: ftb_a_eligible
required_inputs:
  - is_australian_resident
  - number_of_children
  - youngest_child_age
  - annual_income
plain_description: >
  A fortnightly payment to help families with the cost of raising children.
  The amount depends on your family income and the ages of your children.
```

`apps/rules/schemes/RENT_ASSISTANCE.yaml`:
```yaml
id: RENT_ASSISTANCE
name: Commonwealth Rent Assistance
tier: federal
agency: Services Australia
apply_url: https://www.servicesaustralia.gov.au/rent-assistance
delivery_channel: federal_direct
eligibility_variable: rent_assistance_eligible
required_inputs:
  - is_australian_resident
  - tenure_type
  - rent_paid_fortnightly
plain_description: >
  Extra money for people who rent privately and already receive certain
  government payments. Paid automatically — no separate application needed
  once you receive a qualifying payment.
```

- [ ] **Step 5: Run tests**

```bash
cd apps/rules
pytest tests/test_calculate_endpoint.py tests/test_health.py -v
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/rules/main.py apps/rules/schemes/FTB_A.yaml apps/rules/schemes/RENT_ASSISTANCE.yaml apps/rules/tests/test_calculate_endpoint.py
git commit -m "feat: implement real /calculate and /schemes endpoints"
```

---

## Task 3: Eligibility Tests for Existing Schemes

**Files:**
- Create: `apps/rules/tests/test_federal_schemes.py`

- [ ] **Step 1: Create `test_federal_schemes.py`**

```python
"""
Eligibility tests for federal schemes using known worked examples.
Each test mirrors a real-world scenario from Services Australia policy.
"""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def post_calculate(variables: dict) -> dict:
    return client.post("/calculate", json={"variables": variables}).json()


# ── FTB-A ────────────────────────────────────────────────────────────────────

class TestFtbA:
    def test_eligible_family_low_income(self):
        """Family with 2 children and income well below threshold is eligible."""
        data = post_calculate({
            "is_australian_resident": True,
            "number_of_children": 2,
            "youngest_child_age": 5,
            "annual_income": 45000.0,
        })
        assert "FTB_A" in data["eligible"]

    def test_ineligible_high_income(self):
        """Family income above $80,478 makes base rate taper to zero — ineligible."""
        data = post_calculate({
            "is_australian_resident": True,
            "number_of_children": 1,
            "youngest_child_age": 8,
            "annual_income": 95000.0,
        })
        assert "FTB_A" in data["ineligible"]

    def test_ineligible_no_children(self):
        data = post_calculate({
            "is_australian_resident": True,
            "number_of_children": 0,
            "youngest_child_age": 0,
            "annual_income": 40000.0,
        })
        assert "FTB_A" in data["ineligible"]

    def test_ineligible_child_too_old(self):
        """Children aged 16+ do not qualify at MVP (post-16 study deferred)."""
        data = post_calculate({
            "is_australian_resident": True,
            "number_of_children": 1,
            "youngest_child_age": 17,
            "annual_income": 40000.0,
        })
        assert "FTB_A" in data["ineligible"]

    def test_missing_variables_when_income_absent(self):
        data = post_calculate({
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
    def test_eligible_private_renter(self):
        """Private renter paying above minimum threshold is eligible."""
        data = post_calculate({
            "is_australian_resident": True,
            "tenure_type": "renting",
            "rent_paid_fortnightly": 600.0,
        })
        assert "RENT_ASSISTANCE" in data["eligible"]

    def test_ineligible_owner(self):
        data = post_calculate({
            "is_australian_resident": True,
            "tenure_type": "owning",
            "rent_paid_fortnightly": 0.0,
        })
        assert "RENT_ASSISTANCE" in data["ineligible"]

    def test_ineligible_low_rent(self):
        """Rent below the minimum fortnightly threshold → ineligible."""
        data = post_calculate({
            "is_australian_resident": True,
            "tenure_type": "renting",
            "rent_paid_fortnightly": 10.0,
        })
        assert "RENT_ASSISTANCE" in data["ineligible"]

    def test_non_resident_ineligible(self):
        data = post_calculate({
            "is_australian_resident": False,
            "tenure_type": "renting",
            "rent_paid_fortnightly": 600.0,
        })
        assert "RENT_ASSISTANCE" in data["ineligible"]
```

- [ ] **Step 2: Run tests**

```bash
cd apps/rules
pytest tests/test_federal_schemes.py -v
```
Expected: all pass (FTB_A and RENT_ASSISTANCE formulas are already implemented).

- [ ] **Step 3: Commit**

```bash
git add apps/rules/tests/test_federal_schemes.py
git commit -m "test: eligibility tests for FTB-A and Rent Assistance"
```

---

## Task 4: JobSeeker Payment

**Files:**
- Create: `apps/rules/openfisca_au/parameters/federal/jobseeker/income_threshold_single_annual.yaml`
- Create: `apps/rules/openfisca_au/parameters/federal/jobseeker/min_age.yaml`
- Create: `apps/rules/openfisca_au/variables/federal/jobseeker.py`
- Create: `apps/rules/schemes/JOBSEEKER.yaml`

Policy: Australian resident, age 22–66, unemployed or part-time work, annual income ≤ $63,147 (2025 taper nil-rate; MVP uses this as the binary threshold).

- [ ] **Step 1: Write failing tests** (add to `test_federal_schemes.py`)

```python
class TestJobSeeker:
    def test_eligible_unemployed_low_income(self):
        data = post_calculate({
            "is_australian_resident": True,
            "age": 30,
            "employment_status": "unemployed",
            "annual_income": 10000.0,
        })
        assert "JOBSEEKER" in data["eligible"]

    def test_eligible_part_time(self):
        data = post_calculate({
            "is_australian_resident": True,
            "age": 28,
            "employment_status": "part_time",
            "annual_income": 15000.0,
        })
        assert "JOBSEEKER" in data["eligible"]

    def test_ineligible_too_young(self):
        data = post_calculate({
            "is_australian_resident": True,
            "age": 20,
            "employment_status": "unemployed",
            "annual_income": 0.0,
        })
        assert "JOBSEEKER" in data["ineligible"]

    def test_ineligible_pension_age(self):
        data = post_calculate({
            "is_australian_resident": True,
            "age": 68,
            "employment_status": "unemployed",
            "annual_income": 0.0,
        })
        assert "JOBSEEKER" in data["ineligible"]

    def test_ineligible_income_too_high(self):
        data = post_calculate({
            "is_australian_resident": True,
            "age": 35,
            "employment_status": "part_time",
            "annual_income": 70000.0,
        })
        assert "JOBSEEKER" in data["ineligible"]

    def test_ineligible_fulltime_employed(self):
        data = post_calculate({
            "is_australian_resident": True,
            "age": 35,
            "employment_status": "full_time",
            "annual_income": 50000.0,
        })
        assert "JOBSEEKER" in data["ineligible"]
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd apps/rules
pytest tests/test_federal_schemes.py::TestJobSeeker -v
```
Expected: `KeyError` or all fail (JOBSEEKER not in any list).

- [ ] **Step 3: Create parameter files**

`apps/rules/openfisca_au/parameters/federal/jobseeker/income_threshold_single_annual.yaml`:
```yaml
description: JobSeeker Payment income nil-rate threshold — single person (AUD per year, approx.)
values:
  2024-07-01:
    value: 63147.0
```

`apps/rules/openfisca_au/parameters/federal/jobseeker/min_age.yaml`:
```yaml
description: Minimum age to claim JobSeeker Payment (years)
values:
  2024-07-01:
    value: 22
```

- [ ] **Step 4: Create `jobseeker.py`**

```python
from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person

AGE_PENSION_AGE = 67


class jobseeker_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for JobSeeker Payment"
    reference = "https://www.servicesaustralia.gov.au/jobseeker-payment"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        age = person("age", period)
        min_age = parameters(period).federal.jobseeker.min_age
        in_age_range = (age >= min_age) & (age < AGE_PENSION_AGE)
        status = person("employment_status", period)
        is_seeking_work = (status == "unemployed") | (status == "part_time")
        income = person("annual_income", period)
        threshold = parameters(period).federal.jobseeker.income_threshold_single_annual
        income_ok = income <= threshold
        return is_resident * in_age_range * is_seeking_work * income_ok
```

- [ ] **Step 5: Create `JOBSEEKER.yaml`**

```yaml
id: JOBSEEKER
name: JobSeeker Payment
tier: federal
agency: Services Australia
apply_url: https://www.servicesaustralia.gov.au/jobseeker-payment
delivery_channel: federal_direct
eligibility_variable: jobseeker_eligible
required_inputs:
  - is_australian_resident
  - age
  - employment_status
  - annual_income
plain_description: >
  A fortnightly payment for people aged 22 and over who are looking for
  work or temporarily unable to work. Income and assets tests apply.
```

- [ ] **Step 6: Run tests**

```bash
cd apps/rules
pytest tests/test_federal_schemes.py::TestJobSeeker -v
```
Expected: all 6 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/rules/openfisca_au/parameters/federal/jobseeker/ \
        apps/rules/openfisca_au/variables/federal/jobseeker.py \
        apps/rules/schemes/JOBSEEKER.yaml \
        apps/rules/tests/test_federal_schemes.py
git commit -m "feat: JobSeeker Payment scheme (variable, parameters, YAML, tests)"
```

---

## Task 5: Age Pension

**Files:**
- Create: `apps/rules/openfisca_au/parameters/federal/age_pension/qualifying_age.yaml`
- Create: `apps/rules/openfisca_au/parameters/federal/age_pension/income_threshold_single_annual.yaml`
- Create: `apps/rules/openfisca_au/variables/federal/age_pension.py`
- Create: `apps/rules/schemes/AGE_PENSION.yaml`

Policy: Australian resident, age ≥ 67, annual income ≤ $65,281 (single, nil-rate threshold 2025).

- [ ] **Step 1: Write failing tests** (add to `test_federal_schemes.py`)

```python
class TestAgePension:
    def test_eligible_retiree(self):
        data = post_calculate({
            "is_australian_resident": True,
            "age": 70,
            "annual_income": 20000.0,
        })
        assert "AGE_PENSION" in data["eligible"]

    def test_ineligible_too_young(self):
        data = post_calculate({
            "is_australian_resident": True,
            "age": 65,
            "annual_income": 0.0,
        })
        assert "AGE_PENSION" in data["ineligible"]

    def test_ineligible_income_too_high(self):
        data = post_calculate({
            "is_australian_resident": True,
            "age": 72,
            "annual_income": 80000.0,
        })
        assert "AGE_PENSION" in data["ineligible"]
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd apps/rules
pytest tests/test_federal_schemes.py::TestAgePension -v
```

- [ ] **Step 3: Create parameter files**

`apps/rules/openfisca_au/parameters/federal/age_pension/qualifying_age.yaml`:
```yaml
description: Age Pension qualifying age (years)
values:
  2024-07-01:
    value: 67
```

`apps/rules/openfisca_au/parameters/federal/age_pension/income_threshold_single_annual.yaml`:
```yaml
description: Age Pension income nil-rate threshold — single (AUD per year)
values:
  2024-07-01:
    value: 65281.0
```

- [ ] **Step 4: Create `age_pension.py`**

```python
from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class age_pension_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Age Pension"
    reference = "https://www.servicesaustralia.gov.au/age-pension"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        age = person("age", period)
        qualifying_age = parameters(period).federal.age_pension.qualifying_age
        old_enough = age >= qualifying_age
        income = person("annual_income", period)
        threshold = parameters(period).federal.age_pension.income_threshold_single_annual
        income_ok = income <= threshold
        return is_resident * old_enough * income_ok
```

- [ ] **Step 5: Create `AGE_PENSION.yaml`**

```yaml
id: AGE_PENSION
name: Age Pension
tier: federal
agency: Services Australia
apply_url: https://www.servicesaustralia.gov.au/age-pension
delivery_channel: federal_direct
eligibility_variable: age_pension_eligible
required_inputs:
  - is_australian_resident
  - age
  - annual_income
plain_description: >
  A fortnightly payment to support older Australians in retirement.
  Available from age 67, subject to income and assets tests.
```

- [ ] **Step 6: Run tests**

```bash
cd apps/rules
pytest tests/test_federal_schemes.py::TestAgePension -v
```
Expected: all 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/rules/openfisca_au/parameters/federal/age_pension/ \
        apps/rules/openfisca_au/variables/federal/age_pension.py \
        apps/rules/schemes/AGE_PENSION.yaml \
        apps/rules/tests/test_federal_schemes.py
git commit -m "feat: Age Pension scheme (variable, parameters, YAML, tests)"
```

---

## Task 6: Disability Support Pension (DSP)

**Files:**
- Create: `apps/rules/openfisca_au/parameters/federal/dsp/income_threshold_annual.yaml`
- Create: `apps/rules/openfisca_au/variables/federal/dsp.py`
- Create: `apps/rules/schemes/DSP.yaml`

Policy: Australian resident, age 16–66, has a qualifying disability, income ≤ $65,281/year (same nil-rate as Age Pension for singles).

- [ ] **Step 1: Write failing tests** (add to `test_federal_schemes.py`)

```python
class TestDsp:
    def test_eligible_person_with_disability(self):
        data = post_calculate({
            "is_australian_resident": True,
            "age": 35,
            "has_disability": True,
            "annual_income": 10000.0,
        })
        assert "DSP" in data["eligible"]

    def test_ineligible_no_disability(self):
        data = post_calculate({
            "is_australian_resident": True,
            "age": 35,
            "has_disability": False,
            "annual_income": 10000.0,
        })
        assert "DSP" in data["ineligible"]

    def test_ineligible_pension_age(self):
        """At 67+, Age Pension takes over — DSP max age is 66."""
        data = post_calculate({
            "is_australian_resident": True,
            "age": 68,
            "has_disability": True,
            "annual_income": 10000.0,
        })
        assert "DSP" in data["ineligible"]

    def test_ineligible_high_income(self):
        data = post_calculate({
            "is_australian_resident": True,
            "age": 40,
            "has_disability": True,
            "annual_income": 80000.0,
        })
        assert "DSP" in data["ineligible"]
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd apps/rules
pytest tests/test_federal_schemes.py::TestDsp -v
```

- [ ] **Step 3: Create parameter file**

`apps/rules/openfisca_au/parameters/federal/dsp/income_threshold_annual.yaml`:
```yaml
description: DSP income nil-rate threshold — single person (AUD per year)
values:
  2024-07-01:
    value: 65281.0
```

- [ ] **Step 4: Create `dsp.py`**

```python
from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person

DSP_MIN_AGE = 16
DSP_MAX_AGE = 67  # exclusive — Age Pension takes over at qualifying_age


class dsp_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Disability Support Pension"
    reference = "https://www.servicesaustralia.gov.au/disability-support-pension"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        age = person("age", period)
        in_age_range = (age >= DSP_MIN_AGE) & (age < DSP_MAX_AGE)
        has_disability = person("has_disability", period)
        income = person("annual_income", period)
        threshold = parameters(period).federal.dsp.income_threshold_annual
        income_ok = income <= threshold
        return is_resident * in_age_range * has_disability * income_ok
```

- [ ] **Step 5: Create `DSP.yaml`**

```yaml
id: DSP
name: Disability Support Pension
tier: federal
agency: Services Australia
apply_url: https://www.servicesaustralia.gov.au/disability-support-pension
delivery_channel: federal_direct
eligibility_variable: dsp_eligible
required_inputs:
  - is_australian_resident
  - age
  - has_disability
  - annual_income
plain_description: >
  A fortnightly payment for people with a permanent physical, intellectual,
  or psychiatric condition that prevents them from working. Subject to
  medical assessment and income and assets tests.
```

- [ ] **Step 6: Run tests and commit**

```bash
cd apps/rules
pytest tests/test_federal_schemes.py::TestDsp -v
git add apps/rules/openfisca_au/parameters/federal/dsp/ \
        apps/rules/openfisca_au/variables/federal/dsp.py \
        apps/rules/schemes/DSP.yaml \
        apps/rules/tests/test_federal_schemes.py
git commit -m "feat: Disability Support Pension scheme (variable, parameters, YAML, tests)"
```

---

## Task 7: Carer Payment + Carer Allowance

**Files:**
- Create: `apps/rules/openfisca_au/parameters/federal/carer_payment/income_threshold_annual.yaml`
- Create: `apps/rules/openfisca_au/parameters/federal/carer_allowance/income_threshold_annual.yaml`
- Create: `apps/rules/openfisca_au/variables/federal/carer.py`
- Create: `apps/rules/schemes/CARER_PAYMENT.yaml`
- Create: `apps/rules/schemes/CARER_ALLOWANCE.yaml`

Policy:
- Carer Payment: is_carer, income ≤ $65,281/year (same as Age Pension single rate).
- Carer Allowance: is_carer, combined household income ≤ $250,000/year (MVP uses annual_income as proxy).

- [ ] **Step 1: Write failing tests** (add to `test_federal_schemes.py`)

```python
class TestCarerPayment:
    def test_eligible_carer_low_income(self):
        data = post_calculate({
            "is_australian_resident": True,
            "is_carer": True,
            "annual_income": 20000.0,
        })
        assert "CARER_PAYMENT" in data["eligible"]

    def test_ineligible_not_carer(self):
        data = post_calculate({
            "is_australian_resident": True,
            "is_carer": False,
            "annual_income": 20000.0,
        })
        assert "CARER_PAYMENT" in data["ineligible"]

    def test_ineligible_high_income(self):
        data = post_calculate({
            "is_australian_resident": True,
            "is_carer": True,
            "annual_income": 90000.0,
        })
        assert "CARER_PAYMENT" in data["ineligible"]


class TestCarerAllowance:
    def test_eligible_carer(self):
        data = post_calculate({
            "is_australian_resident": True,
            "is_carer": True,
            "annual_income": 100000.0,
        })
        assert "CARER_ALLOWANCE" in data["eligible"]

    def test_ineligible_income_over_250k(self):
        data = post_calculate({
            "is_australian_resident": True,
            "is_carer": True,
            "annual_income": 260000.0,
        })
        assert "CARER_ALLOWANCE" in data["ineligible"]
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd apps/rules
pytest tests/test_federal_schemes.py::TestCarerPayment tests/test_federal_schemes.py::TestCarerAllowance -v
```

- [ ] **Step 3: Create parameter files**

`apps/rules/openfisca_au/parameters/federal/carer_payment/income_threshold_annual.yaml`:
```yaml
description: Carer Payment income nil-rate threshold — single (AUD per year)
values:
  2024-07-01:
    value: 65281.0
```

`apps/rules/openfisca_au/parameters/federal/carer_allowance/income_threshold_annual.yaml`:
```yaml
description: Carer Allowance combined family income threshold (AUD per year)
values:
  2024-07-01:
    value: 250000.0
```

- [ ] **Step 4: Create `carer.py`**

```python
from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class carer_payment_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Carer Payment"
    reference = "https://www.servicesaustralia.gov.au/carer-payment"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        is_carer = person("is_carer", period)
        income = person("annual_income", period)
        threshold = parameters(period).federal.carer_payment.income_threshold_annual
        income_ok = income <= threshold
        return is_resident * is_carer * income_ok


class carer_allowance_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Carer Allowance"
    reference = "https://www.servicesaustralia.gov.au/carer-allowance"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        is_carer = person("is_carer", period)
        income = person("annual_income", period)
        threshold = parameters(period).federal.carer_allowance.income_threshold_annual
        income_ok = income <= threshold
        return is_resident * is_carer * income_ok
```

- [ ] **Step 5: Create scheme YAMLs**

`apps/rules/schemes/CARER_PAYMENT.yaml`:
```yaml
id: CARER_PAYMENT
name: Carer Payment
tier: federal
agency: Services Australia
apply_url: https://www.servicesaustralia.gov.au/carer-payment
delivery_channel: federal_direct
eligibility_variable: carer_payment_eligible
required_inputs:
  - is_australian_resident
  - is_carer
  - annual_income
plain_description: >
  A fortnightly payment for people who provide constant care for someone with
  a severe disability, medical condition, or who is frail aged. Subject to
  income and assets tests.
```

`apps/rules/schemes/CARER_ALLOWANCE.yaml`:
```yaml
id: CARER_ALLOWANCE
name: Carer Allowance
tier: federal
agency: Services Australia
apply_url: https://www.servicesaustralia.gov.au/carer-allowance
delivery_channel: federal_direct
eligibility_variable: carer_allowance_eligible
required_inputs:
  - is_australian_resident
  - is_carer
  - annual_income
plain_description: >
  A fortnightly supplementary payment for people providing daily care to
  someone with a disability or medical condition. Higher income threshold
  than Carer Payment — up to $250,000 combined family income.
```

- [ ] **Step 6: Run tests and commit**

```bash
cd apps/rules
pytest tests/test_federal_schemes.py::TestCarerPayment tests/test_federal_schemes.py::TestCarerAllowance -v
git add apps/rules/openfisca_au/parameters/federal/carer_payment/ \
        apps/rules/openfisca_au/parameters/federal/carer_allowance/ \
        apps/rules/openfisca_au/variables/federal/carer.py \
        apps/rules/schemes/CARER_PAYMENT.yaml \
        apps/rules/schemes/CARER_ALLOWANCE.yaml \
        apps/rules/tests/test_federal_schemes.py
git commit -m "feat: Carer Payment and Carer Allowance schemes"
```

---

## Task 8: Youth Allowance

**Files:**
- Create: `apps/rules/openfisca_au/parameters/federal/youth_allowance/max_age.yaml`
- Create: `apps/rules/openfisca_au/parameters/federal/youth_allowance/income_threshold_annual.yaml`
- Create: `apps/rules/openfisca_au/variables/federal/youth_allowance.py`
- Create: `apps/rules/schemes/YOUTH_ALLOWANCE.yaml`

Policy: resident, age 16–24, unemployed/student, annual income ≤ $29,000 (approximate nil rate for single independent).

- [ ] **Step 1: Write failing tests** (add to `test_federal_schemes.py`)

```python
class TestYouthAllowance:
    def test_eligible_young_unemployed(self):
        data = post_calculate({
            "is_australian_resident": True,
            "age": 20,
            "employment_status": "unemployed",
            "annual_income": 8000.0,
        })
        assert "YOUTH_ALLOWANCE" in data["eligible"]

    def test_eligible_student(self):
        data = post_calculate({
            "is_australian_resident": True,
            "age": 22,
            "employment_status": "student",
            "annual_income": 12000.0,
        })
        assert "YOUTH_ALLOWANCE" in data["eligible"]

    def test_ineligible_over_24(self):
        data = post_calculate({
            "is_australian_resident": True,
            "age": 25,
            "employment_status": "unemployed",
            "annual_income": 5000.0,
        })
        assert "YOUTH_ALLOWANCE" in data["ineligible"]

    def test_ineligible_fulltime_work(self):
        data = post_calculate({
            "is_australian_resident": True,
            "age": 21,
            "employment_status": "full_time",
            "annual_income": 50000.0,
        })
        assert "YOUTH_ALLOWANCE" in data["ineligible"]
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd apps/rules
pytest tests/test_federal_schemes.py::TestYouthAllowance -v
```

- [ ] **Step 3: Create parameter files**

`apps/rules/openfisca_au/parameters/federal/youth_allowance/max_age.yaml`:
```yaml
description: Maximum age (exclusive) for Youth Allowance (years)
values:
  2024-07-01:
    value: 25
```

`apps/rules/openfisca_au/parameters/federal/youth_allowance/income_threshold_annual.yaml`:
```yaml
description: Youth Allowance income nil-rate threshold — single independent (AUD per year)
values:
  2024-07-01:
    value: 29000.0
```

- [ ] **Step 4: Create `youth_allowance.py`**

```python
from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person

YOUTH_ALLOWANCE_MIN_AGE = 16


class youth_allowance_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Youth Allowance"
    reference = "https://www.servicesaustralia.gov.au/youth-allowance"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        age = person("age", period)
        max_age = parameters(period).federal.youth_allowance.max_age
        in_age_range = (age >= YOUTH_ALLOWANCE_MIN_AGE) & (age < max_age)
        status = person("employment_status", period)
        qualifying_status = (
            (status == "unemployed")
            | (status == "part_time")
            | (status == "student")
        )
        income = person("annual_income", period)
        threshold = parameters(period).federal.youth_allowance.income_threshold_annual
        income_ok = income <= threshold
        return is_resident * in_age_range * qualifying_status * income_ok
```

- [ ] **Step 5: Create `YOUTH_ALLOWANCE.yaml`**

```yaml
id: YOUTH_ALLOWANCE
name: Youth Allowance
tier: federal
agency: Services Australia
apply_url: https://www.servicesaustralia.gov.au/youth-allowance
delivery_channel: federal_direct
eligibility_variable: youth_allowance_eligible
required_inputs:
  - is_australian_resident
  - age
  - employment_status
  - annual_income
plain_description: >
  A fortnightly payment for young Australians aged 16–24 who are studying,
  looking for work, or doing an Australian Apprenticeship. Subject to income
  and parental means tests.
```

- [ ] **Step 6: Run tests and commit**

```bash
cd apps/rules
pytest tests/test_federal_schemes.py::TestYouthAllowance -v
git add apps/rules/openfisca_au/parameters/federal/youth_allowance/ \
        apps/rules/openfisca_au/variables/federal/youth_allowance.py \
        apps/rules/schemes/YOUTH_ALLOWANCE.yaml \
        apps/rules/tests/test_federal_schemes.py
git commit -m "feat: Youth Allowance scheme"
```

---

## Task 9: Low Income Health Care Card (LIHCC)

**Files:**
- Create: `apps/rules/openfisca_au/parameters/federal/lihcc/income_threshold_single_annual.yaml`
- Create: `apps/rules/openfisca_au/parameters/federal/lihcc/income_threshold_family_annual.yaml`
- Create: `apps/rules/openfisca_au/variables/federal/lihcc.py`
- Create: `apps/rules/schemes/LIHCC.yaml`

Policy: fortnightly income ≤ $699 for singles (≈ $18,174/yr), ≤ $1,199 for families with children (≈ $31,174/yr). MVP uses annual equivalent.

- [ ] **Step 1: Write failing tests** (add to `test_federal_schemes.py`)

```python
class TestLihcc:
    def test_eligible_single_low_income(self):
        data = post_calculate({
            "is_australian_resident": True,
            "annual_income": 15000.0,
            "number_of_children": 0,
        })
        assert "LIHCC" in data["eligible"]

    def test_eligible_family_low_income(self):
        data = post_calculate({
            "is_australian_resident": True,
            "annual_income": 28000.0,
            "number_of_children": 2,
        })
        assert "LIHCC" in data["eligible"]

    def test_ineligible_single_high_income(self):
        data = post_calculate({
            "is_australian_resident": True,
            "annual_income": 25000.0,
            "number_of_children": 0,
        })
        assert "LIHCC" in data["ineligible"]

    def test_ineligible_family_high_income(self):
        data = post_calculate({
            "is_australian_resident": True,
            "annual_income": 40000.0,
            "number_of_children": 2,
        })
        assert "LIHCC" in data["ineligible"]
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd apps/rules
pytest tests/test_federal_schemes.py::TestLihcc -v
```

- [ ] **Step 3: Create parameter files**

`apps/rules/openfisca_au/parameters/federal/lihcc/income_threshold_single_annual.yaml`:
```yaml
description: LIHCC fortnightly income threshold — no children (AUD per year equivalent)
values:
  2024-07-01:
    value: 18174.0
```

`apps/rules/openfisca_au/parameters/federal/lihcc/income_threshold_family_annual.yaml`:
```yaml
description: LIHCC fortnightly income threshold — with dependent children (AUD per year equivalent)
values:
  2024-07-01:
    value: 31174.0
```

- [ ] **Step 4: Create `lihcc.py`**

```python
from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class low_income_health_care_card_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Low Income Health Care Card (LIHCC)"
    reference = "https://www.servicesaustralia.gov.au/low-income-health-care-card"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        income = person("annual_income", period)
        has_children = person("number_of_children", period) >= 1
        single_threshold = parameters(period).federal.lihcc.income_threshold_single_annual
        family_threshold = parameters(period).federal.lihcc.income_threshold_family_annual
        # Families with children get the higher threshold
        threshold = has_children * family_threshold + (~has_children) * single_threshold
        income_ok = income <= threshold
        return is_resident * income_ok
```

- [ ] **Step 5: Create `LIHCC.yaml`**

```yaml
id: LIHCC
name: Low Income Health Care Card
tier: federal
agency: Services Australia
apply_url: https://www.servicesaustralia.gov.au/low-income-health-care-card
delivery_channel: federal_direct
eligibility_variable: low_income_health_care_card_eligible
required_inputs:
  - is_australian_resident
  - annual_income
  - number_of_children
plain_description: >
  A concession card for low-income earners who do not receive Centrelink
  payments. Provides discounts on medicines, bulk billing, and council rates.
  Based on an income test only — no assets test.
```

- [ ] **Step 6: Run tests and commit**

```bash
cd apps/rules
pytest tests/test_federal_schemes.py::TestLihcc -v
git add apps/rules/openfisca_au/parameters/federal/lihcc/ \
        apps/rules/openfisca_au/variables/federal/lihcc.py \
        apps/rules/schemes/LIHCC.yaml \
        apps/rules/tests/test_federal_schemes.py
git commit -m "feat: Low Income Health Care Card scheme"
```

---

## Task 10: FTB-B + Parenting Payment

**Files:**
- Create: `apps/rules/openfisca_au/parameters/federal/ftb_b/primary_income_threshold.yaml`
- Create: `apps/rules/openfisca_au/parameters/federal/parenting_payment/income_threshold_single_annual.yaml`
- Create: `apps/rules/openfisca_au/variables/federal/ftb_b.py`
- Create: `apps/rules/openfisca_au/variables/federal/parenting_payment.py`
- Create: `apps/rules/schemes/FTB_B.yaml`
- Create: `apps/rules/schemes/PARENTING_PAYMENT.yaml`

Policy:
- FTB-B: has qualifying child, primary earner income ≤ $100,000.
- Parenting Payment: single parent, youngest child < 8 OR partnered, youngest child < 6. Income ≤ $65,281.

- [ ] **Step 1: Write failing tests** (add to `test_federal_schemes.py`)

```python
class TestFtbB:
    def test_eligible_single_parent(self):
        data = post_calculate({
            "is_australian_resident": True,
            "number_of_children": 1,
            "youngest_child_age": 6,
            "annual_income": 60000.0,
        })
        assert "FTB_B" in data["eligible"]

    def test_ineligible_income_over_100k(self):
        data = post_calculate({
            "is_australian_resident": True,
            "number_of_children": 1,
            "youngest_child_age": 4,
            "annual_income": 110000.0,
        })
        assert "FTB_B" in data["ineligible"]

    def test_ineligible_no_children(self):
        data = post_calculate({
            "is_australian_resident": True,
            "number_of_children": 0,
            "youngest_child_age": 0,
            "annual_income": 50000.0,
        })
        assert "FTB_B" in data["ineligible"]


class TestParentingPayment:
    def test_eligible_single_young_child(self):
        data = post_calculate({
            "is_australian_resident": True,
            "number_of_children": 1,
            "youngest_child_age": 5,
            "has_partner": False,
            "annual_income": 30000.0,
        })
        assert "PARENTING_PAYMENT" in data["eligible"]

    def test_ineligible_child_too_old_single(self):
        data = post_calculate({
            "is_australian_resident": True,
            "number_of_children": 1,
            "youngest_child_age": 9,
            "has_partner": False,
            "annual_income": 20000.0,
        })
        assert "PARENTING_PAYMENT" in data["ineligible"]

    def test_ineligible_partnered_child_too_old(self):
        data = post_calculate({
            "is_australian_resident": True,
            "number_of_children": 1,
            "youngest_child_age": 7,
            "has_partner": True,
            "annual_income": 30000.0,
        })
        assert "PARENTING_PAYMENT" in data["ineligible"]
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd apps/rules
pytest tests/test_federal_schemes.py::TestFtbB tests/test_federal_schemes.py::TestParentingPayment -v
```

- [ ] **Step 3: Create parameter files**

`apps/rules/openfisca_au/parameters/federal/ftb_b/primary_income_threshold.yaml`:
```yaml
description: FTB-B primary earner income threshold (AUD per year)
values:
  2024-07-01:
    value: 100000.0
```

`apps/rules/openfisca_au/parameters/federal/parenting_payment/income_threshold_single_annual.yaml`:
```yaml
description: Parenting Payment income nil-rate threshold — single (AUD per year)
values:
  2024-07-01:
    value: 65281.0
```

- [ ] **Step 4: Create `ftb_b.py`**

```python
from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class ftb_b_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Family Tax Benefit Part B"
    reference = "https://www.servicesaustralia.gov.au/family-tax-benefit-part-b"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        has_qualifying_child = person("federal_has_qualifying_child", period)
        income = person("annual_income", period)
        threshold = parameters(period).federal.ftb_b.primary_income_threshold
        income_ok = income <= threshold
        return is_resident * has_qualifying_child * income_ok
```

- [ ] **Step 5: Create `parenting_payment.py`**

```python
from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person

SINGLE_CHILD_AGE_LIMIT = 8   # Under 8 for single parents
PARTNERED_CHILD_AGE_LIMIT = 6  # Under 6 for partnered


class parenting_payment_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for Parenting Payment"
    reference = "https://www.servicesaustralia.gov.au/parenting-payment"

    def formula(person, period, parameters):  # noqa: N805
        is_resident = person("is_australian_resident", period)
        has_children = person("number_of_children", period) >= 1
        youngest_age = person("youngest_child_age", period)
        has_partner = person("has_partner", period)

        # Single parents: youngest child must be under 8
        single_child_ok = (~has_partner) & (youngest_age < SINGLE_CHILD_AGE_LIMIT)
        # Partnered parents: youngest child must be under 6
        partnered_child_ok = has_partner & (youngest_age < PARTNERED_CHILD_AGE_LIMIT)
        child_age_ok = single_child_ok | partnered_child_ok

        income = person("annual_income", period)
        threshold = parameters(period).federal.parenting_payment.income_threshold_single_annual
        income_ok = income <= threshold

        return is_resident * has_children * child_age_ok * income_ok
```

- [ ] **Step 6: Create scheme YAMLs**

`apps/rules/schemes/FTB_B.yaml`:
```yaml
id: FTB_B
name: Family Tax Benefit Part B
tier: federal
agency: Services Australia
apply_url: https://www.servicesaustralia.gov.au/family-tax-benefit-part-b
delivery_channel: federal_direct
eligibility_variable: ftb_b_eligible
required_inputs:
  - is_australian_resident
  - number_of_children
  - youngest_child_age
  - annual_income
plain_description: >
  A payment for single-income families or single parents with a child under 13
  (or 18 if studying). Paid per family, not per child.
```

`apps/rules/schemes/PARENTING_PAYMENT.yaml`:
```yaml
id: PARENTING_PAYMENT
name: Parenting Payment
tier: federal
agency: Services Australia
apply_url: https://www.servicesaustralia.gov.au/parenting-payment
delivery_channel: federal_direct
eligibility_variable: parenting_payment_eligible
required_inputs:
  - is_australian_resident
  - number_of_children
  - youngest_child_age
  - has_partner
  - annual_income
plain_description: >
  A fortnightly payment for parents or guardians of young children. For single
  parents with a child under 8, or partnered parents with a child under 6.
```

- [ ] **Step 7: Run tests and commit**

```bash
cd apps/rules
pytest tests/test_federal_schemes.py::TestFtbB tests/test_federal_schemes.py::TestParentingPayment -v
git add apps/rules/openfisca_au/parameters/federal/ftb_b/ \
        apps/rules/openfisca_au/parameters/federal/parenting_payment/ \
        apps/rules/openfisca_au/variables/federal/ftb_b.py \
        apps/rules/openfisca_au/variables/federal/parenting_payment.py \
        apps/rules/schemes/FTB_B.yaml \
        apps/rules/schemes/PARENTING_PAYMENT.yaml \
        apps/rules/tests/test_federal_schemes.py
git commit -m "feat: FTB-B and Parenting Payment schemes"
```

---

## Task 11: Derived Federal Variable — `has_pensioner_concession_card`

**Files:**
- Modify: `apps/rules/openfisca_au/variables/federal/derived.py`

This variable is True when the person receives Age Pension, DSP, or Carer Payment. NSW schemes reference it for cross-tier stacking.

- [ ] **Step 1: Append to `derived.py`**

Add after the existing variables:

```python
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
```

- [ ] **Step 2: Verify via Python**

```bash
cd apps/rules
python -c "from openfisca_au import AustraliaTaxBenefitSystem; tbs = AustraliaTaxBenefitSystem(); print('has_pensioner_concession_card' in tbs.variables)"
```
Expected: `True`

- [ ] **Step 3: Commit**

```bash
git add apps/rules/openfisca_au/variables/federal/derived.py
git commit -m "feat: derived has_pensioner_concession_card (cross-tier stacking support)"
```

---

## Task 12: NSW Low Income Household Rebate

**Files:**
- Create: `apps/rules/openfisca_au/parameters/nsw/low_income_household_rebate/household_income_threshold.yaml`
- Create: `apps/rules/openfisca_au/variables/nsw/low_income_household_rebate.py`
- Create: `apps/rules/schemes/NSW_LOW_INCOME_HOUSEHOLD_REBATE.yaml`

Policy: NSW resident AND (has_pensioner_concession_card OR low_income_health_care_card_eligible OR annual_income ≤ $50,000).

- [ ] **Step 1: Write failing tests** (create `apps/rules/tests/test_nsw_schemes.py`)

```python
"""
Eligibility tests for NSW state concession schemes.
All NSW schemes require state == "NSW".
"""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def post_calculate(variables: dict) -> dict:
    return client.post("/calculate", json={"variables": variables}).json()


class TestNswLowIncomeRebate:
    def test_eligible_nsw_low_income(self):
        data = post_calculate({
            "state": "NSW",
            "annual_income": 35000.0,
        })
        assert "NSW_LOW_INCOME_HOUSEHOLD_REBATE" in data["eligible"]

    def test_eligible_nsw_pensioner(self):
        """Pensioner Concession Card holder in NSW is eligible regardless of rebate income threshold."""
        data = post_calculate({
            "state": "NSW",
            "annual_income": 60000.0,
            "age": 70,
            # age >= 67, income <= 65281 → age_pension_eligible → has_pensioner_concession_card
        })
        assert "NSW_LOW_INCOME_HOUSEHOLD_REBATE" in data["eligible"]

    def test_ineligible_not_nsw(self):
        data = post_calculate({
            "state": "VIC",
            "annual_income": 20000.0,
        })
        assert "NSW_LOW_INCOME_HOUSEHOLD_REBATE" in data["ineligible"]

    def test_ineligible_high_income_no_card(self):
        data = post_calculate({
            "state": "NSW",
            "annual_income": 80000.0,
        })
        assert "NSW_LOW_INCOME_HOUSEHOLD_REBATE" in data["ineligible"]
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd apps/rules
pytest tests/test_nsw_schemes.py::TestNswLowIncomeRebate -v
```

- [ ] **Step 3: Create parameter file**

`apps/rules/openfisca_au/parameters/nsw/low_income_household_rebate/household_income_threshold.yaml`:
```yaml
description: NSW Low Income Household Rebate — income-only pathway annual threshold (AUD)
values:
  2024-07-01:
    value: 50000.0
```

- [ ] **Step 4: Create `low_income_household_rebate.py`**

```python
from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class low_income_household_rebate_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for NSW Low Income Household Rebate"
    reference = "https://www.service.nsw.gov.au/transaction/apply-for-low-income-household-rebate"

    def formula(person, period, parameters):  # noqa: N805
        is_nsw = person("state", period) == "NSW"

        # Card-holder pathway
        has_pcc = person("has_pensioner_concession_card", period)
        has_lihcc = person("low_income_health_care_card_eligible", period)
        has_qualifying_card = has_pcc | has_lihcc

        # Income-only pathway (no card required)
        income = person("annual_income", period)
        threshold = parameters(period).nsw.low_income_household_rebate.household_income_threshold
        low_income = income <= threshold

        return is_nsw * (has_qualifying_card | low_income)
```

- [ ] **Step 5: Create `NSW_LOW_INCOME_HOUSEHOLD_REBATE.yaml`**

```yaml
id: NSW_LOW_INCOME_HOUSEHOLD_REBATE
name: NSW Low Income Household Rebate
tier: state
agency: Service NSW
apply_url: https://www.service.nsw.gov.au/transaction/apply-for-low-income-household-rebate
delivery_channel: state_direct
eligibility_variable: low_income_household_rebate_eligible
required_inputs:
  - state
  - annual_income
plain_description: >
  An annual rebate of up to $285 off electricity bills for eligible low-income
  NSW households. Available to holders of the Pensioner Concession Card,
  Health Care Card, or Commonwealth Seniors Health Card.
```

- [ ] **Step 6: Run tests and commit**

```bash
cd apps/rules
pytest tests/test_nsw_schemes.py::TestNswLowIncomeRebate -v
git add apps/rules/openfisca_au/parameters/nsw/ \
        apps/rules/openfisca_au/variables/nsw/low_income_household_rebate.py \
        apps/rules/schemes/NSW_LOW_INCOME_HOUSEHOLD_REBATE.yaml \
        apps/rules/tests/test_nsw_schemes.py
git commit -m "feat: NSW Low Income Household Rebate scheme"
```

---

## Task 13: NSW Energy Accounts Payment Assistance (EAPA)

**Files:**
- Create: `apps/rules/openfisca_au/variables/nsw/eapa.py`
- Create: `apps/rules/schemes/NSW_EAPA.yaml`

Policy: NSW resident experiencing financial hardship with an energy bill. No income threshold — voucher-based crisis assistance.

- [ ] **Step 1: Write failing tests** (add to `test_nsw_schemes.py`)

```python
class TestNswEapa:
    def test_eligible_nsw_hardship(self):
        data = post_calculate({
            "state": "NSW",
            "has_financial_hardship": True,
        })
        assert "NSW_EAPA" in data["eligible"]

    def test_ineligible_not_nsw(self):
        data = post_calculate({
            "state": "QLD",
            "has_financial_hardship": True,
        })
        assert "NSW_EAPA" in data["ineligible"]

    def test_ineligible_no_hardship(self):
        data = post_calculate({
            "state": "NSW",
            "has_financial_hardship": False,
        })
        assert "NSW_EAPA" in data["ineligible"]
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd apps/rules
pytest tests/test_nsw_schemes.py::TestNswEapa -v
```

- [ ] **Step 3: Create `eapa.py`**

```python
from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class eapa_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for NSW Energy Accounts Payment Assistance (EAPA)"
    reference = "https://www.service.nsw.gov.au/transaction/apply-for-energy-accounts-payment-assistance-eapa"

    def formula(person, period, parameters):  # noqa: N805
        is_nsw = person("state", period) == "NSW"
        hardship = person("has_financial_hardship", period)
        return is_nsw * hardship
```

- [ ] **Step 4: Create `NSW_EAPA.yaml`**

```yaml
id: NSW_EAPA
name: Energy Accounts Payment Assistance (EAPA)
tier: state
agency: Service NSW
apply_url: https://www.service.nsw.gov.au/transaction/apply-for-energy-accounts-payment-assistance-eapa
delivery_channel: state_direct
eligibility_variable: eapa_eligible
required_inputs:
  - state
  - has_financial_hardship
plain_description: >
  Crisis vouchers (up to $1,600/year) to help NSW residents who are struggling
  to pay energy bills. Available through community service organisations —
  no income test applies.
```

- [ ] **Step 5: Run tests and commit**

```bash
cd apps/rules
pytest tests/test_nsw_schemes.py::TestNswEapa -v
git add apps/rules/openfisca_au/variables/nsw/eapa.py \
        apps/rules/schemes/NSW_EAPA.yaml \
        apps/rules/tests/test_nsw_schemes.py
git commit -m "feat: NSW EAPA scheme"
```

---

## Task 14: NSW Gas Rebate

**Files:**
- Create: `apps/rules/openfisca_au/variables/nsw/gas_rebate.py`
- Create: `apps/rules/schemes/NSW_GAS_REBATE.yaml`

Policy: NSW resident with a Pensioner Concession Card or LIHCC, connected to natural gas.

- [ ] **Step 1: Write failing tests** (add to `test_nsw_schemes.py`)

```python
class TestNswGasRebate:
    def test_eligible_pensioner_nsw(self):
        """Age Pension recipient in NSW → has_pensioner_concession_card → eligible."""
        data = post_calculate({
            "state": "NSW",
            "age": 70,
            "annual_income": 20000.0,
        })
        assert "NSW_GAS_REBATE" in data["eligible"]

    def test_ineligible_not_nsw(self):
        data = post_calculate({
            "state": "VIC",
            "age": 70,
            "annual_income": 20000.0,
        })
        assert "NSW_GAS_REBATE" in data["ineligible"]

    def test_ineligible_no_card_high_income(self):
        data = post_calculate({
            "state": "NSW",
            "age": 45,
            "annual_income": 80000.0,
            "number_of_children": 0,
        })
        assert "NSW_GAS_REBATE" in data["ineligible"]
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd apps/rules
pytest tests/test_nsw_schemes.py::TestNswGasRebate -v
```

- [ ] **Step 3: Create `gas_rebate.py`**

```python
from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class gas_rebate_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for NSW Gas Rebate"
    reference = "https://www.service.nsw.gov.au/transaction/apply-for-gas-rebate"

    def formula(person, period, parameters):  # noqa: N805
        is_nsw = person("state", period) == "NSW"
        has_pcc = person("has_pensioner_concession_card", period)
        has_lihcc = person("low_income_health_care_card_eligible", period)
        has_qualifying_card = has_pcc | has_lihcc
        return is_nsw * has_qualifying_card
```

- [ ] **Step 4: Create `NSW_GAS_REBATE.yaml`**

```yaml
id: NSW_GAS_REBATE
name: NSW Gas Rebate
tier: state
agency: Service NSW
apply_url: https://www.service.nsw.gov.au/transaction/apply-for-gas-rebate
delivery_channel: state_direct
eligibility_variable: gas_rebate_eligible
required_inputs:
  - state
  - age
  - annual_income
plain_description: >
  An annual rebate on natural gas bills for eligible NSW concession card holders,
  including Pensioner Concession Card and Low Income Health Care Card holders.
```

- [ ] **Step 5: Run tests and commit**

```bash
cd apps/rules
pytest tests/test_nsw_schemes.py::TestNswGasRebate -v
git add apps/rules/openfisca_au/variables/nsw/gas_rebate.py \
        apps/rules/schemes/NSW_GAS_REBATE.yaml \
        apps/rules/tests/test_nsw_schemes.py
git commit -m "feat: NSW Gas Rebate scheme"
```

---

## Task 15: NSW Life Support Rebate

**Files:**
- Create: `apps/rules/openfisca_au/variables/nsw/life_support_rebate.py`
- Create: `apps/rules/schemes/NSW_LIFE_SUPPORT_REBATE.yaml`

Policy: NSW resident who uses approved life support equipment requiring electricity or gas. No income test.

- [ ] **Step 1: Write failing tests** (add to `test_nsw_schemes.py`)

```python
class TestNswLifeSupportRebate:
    def test_eligible_life_support_nsw(self):
        data = post_calculate({
            "state": "NSW",
            "uses_life_support_equipment": True,
        })
        assert "NSW_LIFE_SUPPORT_REBATE" in data["eligible"]

    def test_ineligible_no_equipment(self):
        data = post_calculate({
            "state": "NSW",
            "uses_life_support_equipment": False,
        })
        assert "NSW_LIFE_SUPPORT_REBATE" in data["ineligible"]

    def test_ineligible_not_nsw(self):
        data = post_calculate({
            "state": "QLD",
            "uses_life_support_equipment": True,
        })
        assert "NSW_LIFE_SUPPORT_REBATE" in data["ineligible"]
```

- [ ] **Step 2: Create `life_support_rebate.py`**

```python
from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class life_support_rebate_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for NSW Life Support Rebate"
    reference = "https://www.service.nsw.gov.au/transaction/apply-for-life-support-rebate"

    def formula(person, period, parameters):  # noqa: N805
        is_nsw = person("state", period) == "NSW"
        life_support = person("uses_life_support_equipment", period)
        return is_nsw * life_support
```

- [ ] **Step 3: Create `NSW_LIFE_SUPPORT_REBATE.yaml`**

```yaml
id: NSW_LIFE_SUPPORT_REBATE
name: NSW Life Support Rebate
tier: state
agency: Service NSW
apply_url: https://www.service.nsw.gov.au/transaction/apply-for-life-support-rebate
delivery_channel: state_direct
eligibility_variable: life_support_rebate_eligible
required_inputs:
  - state
  - uses_life_support_equipment
plain_description: >
  A rebate on electricity or gas bills for NSW residents who rely on approved
  life support equipment at home (e.g. oxygen concentrators, home dialysis).
  No income test — requires medical confirmation.
```

- [ ] **Step 4: Run tests and commit**

```bash
cd apps/rules
pytest tests/test_nsw_schemes.py::TestNswLifeSupportRebate -v
git add apps/rules/openfisca_au/variables/nsw/life_support_rebate.py \
        apps/rules/schemes/NSW_LIFE_SUPPORT_REBATE.yaml \
        apps/rules/tests/test_nsw_schemes.py
git commit -m "feat: NSW Life Support Rebate scheme"
```

---

## Task 16: NSW Seniors Card

**Files:**
- Create: `apps/rules/openfisca_au/parameters/nsw/seniors_card/qualifying_age.yaml`
- Create: `apps/rules/openfisca_au/parameters/nsw/seniors_card/max_hours_per_week.yaml`
- Create: `apps/rules/openfisca_au/variables/nsw/seniors_card.py`
- Create: `apps/rules/schemes/NSW_SENIORS_CARD.yaml`

Policy: NSW resident, age ≥ 60, working ≤ 20 hours/week on average. No income test.

- [ ] **Step 1: Write failing tests** (add to `test_nsw_schemes.py`)

```python
class TestNswSeniorsCard:
    def test_eligible_senior_part_time(self):
        data = post_calculate({
            "state": "NSW",
            "age": 65,
            "hours_worked_per_week": 10.0,
        })
        assert "NSW_SENIORS_CARD" in data["eligible"]

    def test_eligible_senior_retired(self):
        data = post_calculate({
            "state": "NSW",
            "age": 70,
            "hours_worked_per_week": 0.0,
        })
        assert "NSW_SENIORS_CARD" in data["eligible"]

    def test_ineligible_too_young(self):
        data = post_calculate({
            "state": "NSW",
            "age": 55,
            "hours_worked_per_week": 0.0,
        })
        assert "NSW_SENIORS_CARD" in data["ineligible"]

    def test_ineligible_fulltime_work(self):
        data = post_calculate({
            "state": "NSW",
            "age": 62,
            "hours_worked_per_week": 25.0,
        })
        assert "NSW_SENIORS_CARD" in data["ineligible"]

    def test_ineligible_not_nsw(self):
        data = post_calculate({
            "state": "VIC",
            "age": 65,
            "hours_worked_per_week": 0.0,
        })
        assert "NSW_SENIORS_CARD" in data["ineligible"]
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd apps/rules
pytest tests/test_nsw_schemes.py::TestNswSeniorsCard -v
```

- [ ] **Step 3: Create parameter files**

`apps/rules/openfisca_au/parameters/nsw/seniors_card/qualifying_age.yaml`:
```yaml
description: NSW Seniors Card qualifying age (years)
values:
  2024-07-01:
    value: 60
```

`apps/rules/openfisca_au/parameters/nsw/seniors_card/max_hours_per_week.yaml`:
```yaml
description: NSW Seniors Card maximum average hours of paid work per week
values:
  2024-07-01:
    value: 20.0
```

- [ ] **Step 4: Create `seniors_card.py`**

```python
from openfisca_core.variables import Variable
from openfisca_core.periods import YEAR
from openfisca_au.entities import Person


class seniors_card_eligible(Variable):
    value_type = bool
    entity = Person
    definition_period = YEAR
    label = "Eligible for NSW Seniors Card"
    reference = "https://www.service.nsw.gov.au/transaction/apply-for-a-seniors-card"

    def formula(person, period, parameters):  # noqa: N805
        is_nsw = person("state", period) == "NSW"
        age = person("age", period)
        qualifying_age = parameters(period).nsw.seniors_card.qualifying_age
        old_enough = age >= qualifying_age
        hours = person("hours_worked_per_week", period)
        max_hours = parameters(period).nsw.seniors_card.max_hours_per_week
        works_few_hours = hours <= max_hours
        return is_nsw * old_enough * works_few_hours
```

- [ ] **Step 5: Create `NSW_SENIORS_CARD.yaml`**

```yaml
id: NSW_SENIORS_CARD
name: NSW Seniors Card
tier: state
agency: Service NSW
apply_url: https://www.service.nsw.gov.au/transaction/apply-for-a-seniors-card
delivery_channel: state_direct
eligibility_variable: seniors_card_eligible
required_inputs:
  - state
  - age
  - hours_worked_per_week
plain_description: >
  A free card for NSW residents aged 60 and over who work no more than 20 hours
  per week on average. Provides discounts at thousands of businesses and on
  public transport. No income test.
```

- [ ] **Step 6: Run tests and commit**

```bash
cd apps/rules
pytest tests/test_nsw_schemes.py::TestNswSeniorsCard -v
git add apps/rules/openfisca_au/parameters/nsw/seniors_card/ \
        apps/rules/openfisca_au/variables/nsw/seniors_card.py \
        apps/rules/schemes/NSW_SENIORS_CARD.yaml \
        apps/rules/tests/test_nsw_schemes.py
git commit -m "feat: NSW Seniors Card scheme"
```

---

## Task 17: Full Test Suite Pass

- [ ] **Step 1: Run all tests**

```bash
cd apps/rules
pytest tests/ -v
```
Expected: all tests pass. Fix any failures before continuing.

- [ ] **Step 2: Verify /schemes returns all 16 schemes**

```bash
cd apps/rules
uvicorn main:app --reload --port 8001 &
sleep 3
curl -s http://localhost:8001/schemes | python -m json.tool | grep '"id"' | wc -l
kill %1
```
Expected output: `16` (FTB_A, RENT_ASSISTANCE, JOBSEEKER, AGE_PENSION, DSP, CARER_PAYMENT, CARER_ALLOWANCE, YOUTH_ALLOWANCE, LIHCC, FTB_B, PARENTING_PAYMENT, NSW_LOW_INCOME_HOUSEHOLD_REBATE, NSW_EAPA, NSW_GAS_REBATE, NSW_LIFE_SUPPORT_REBATE, NSW_SENIORS_CARD).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: full suite pass — 16 schemes, calculate endpoint verified"
```

---

## Task 18: Corpus Markdown Files

Each corpus file provides the authoritative text the RAG retriever uses to explain eligibility. Format: YAML frontmatter + Markdown body.

**Files:** 16 files in `corpus/federal/` and `corpus/nsw/`

- [ ] **Step 1: Create `corpus/federal/ftb_a.md`**

```markdown
---
scheme_id: FTB_A
tier: federal
source_url: https://www.servicesaustralia.gov.au/family-tax-benefit-part-a
last_verified: 2025-05-26
---

# Family Tax Benefit Part A

Family Tax Benefit (FTB) Part A is a fortnightly payment to help with the cost of raising children. It is paid per child in your care.

## Who can get it

You may be eligible if you:
- Care for a child aged under 16, or 16–19 if they are in full-time study
- Meet Australian residence requirements
- Have a family income below the income threshold

## Income test

The Higher Income Free Area is $80,478 per year. Your payment begins to reduce once your family's adjusted taxable income exceeds this threshold. The base rate of FTB Part A cuts out when income reaches approximately $98,988 per year (single child, 2024–25).

## How to apply

Apply online through myGov linked to a Centrelink account, or visit a Services Australia service centre.

## How it is paid

Fortnightly directly to your bank account, or as an annual lump sum after tax return lodgement.
```

- [ ] **Step 2: Create `corpus/federal/rent_assistance.md`**

```markdown
---
scheme_id: RENT_ASSISTANCE
tier: federal
source_url: https://www.servicesaustralia.gov.au/rent-assistance
last_verified: 2025-05-26
---

# Commonwealth Rent Assistance

Rent Assistance is an extra payment for people who rent privately and already receive certain income support payments from Centrelink or the Department of Veterans' Affairs.

## Who can get it

You may be eligible if you:
- Receive an eligible Centrelink payment (e.g. JobSeeker, Age Pension, Youth Allowance)
- Pay rent above the minimum fortnightly threshold ($149.00 for singles, 2024–25)
- Rent privately (not in public/community housing)

## How much you can get

Up to $211.20 per fortnight for a single person with no children (2024–25). The amount is two-thirds of the rent above the threshold, up to the maximum rate.

## How to apply

Rent Assistance is assessed automatically when you apply for an eligible Centrelink payment. You do not need to apply separately — provide your rent details to Centrelink.
```

- [ ] **Step 3: Create `corpus/federal/jobseeker.md`**

```markdown
---
scheme_id: JOBSEEKER
tier: federal
source_url: https://www.servicesaustralia.gov.au/jobseeker-payment
last_verified: 2025-05-26
---

# JobSeeker Payment

JobSeeker Payment is the main income support payment for Australians who are temporarily unable to work or actively looking for work.

## Who can get it

You may be eligible if you:
- Are aged 22 or over and under Age Pension age (67)
- Are an Australian resident
- Are unemployed and looking for work, or unable to work temporarily due to illness
- Meet the income and assets tests

## Income test

A single person with no children has an income nil-rate threshold of approximately $63,147 per year (2024–25). The payment reduces by 50 cents for each dollar earned between $150 and $256 per fortnight, then 60 cents for each dollar above that.

## Activity requirements

Recipients must agree to a Job Plan and undertake approved activities (job searching, study, training, or volunteering) unless an exemption applies.

## How to apply

Apply online through myGov linked to a Centrelink account. You will need to verify your identity and provide income and residence details.
```

- [ ] **Step 4: Create `corpus/federal/age_pension.md`**

```markdown
---
scheme_id: AGE_PENSION
tier: federal
source_url: https://www.servicesaustralia.gov.au/age-pension
last_verified: 2025-05-26
---

# Age Pension

Age Pension is a fortnightly payment to support older Australians who have reached qualifying age and meet the income and assets tests.

## Who can get it

You may be eligible if you:
- Have reached Age Pension age (67 years for people born on or after 1 January 1957)
- Are an Australian resident and have lived in Australia for at least 10 years
- Meet the income and assets tests

## Income test

The income nil-rate threshold for a single person is approximately $65,281 per year (2024–25). The pension reduces by 50 cents for each dollar of income above the free area.

## Assets test

Assets limits also apply. The full pension is payable for singles with assets below $314,000 (homeowner) or $566,000 (non-homeowner). The pension reduces for assets above these amounts.

## How to apply

Apply through myGov linked to Centrelink, or visit a Services Australia service centre. Apply up to 13 weeks before you reach qualifying age.
```

- [ ] **Step 5: Create `corpus/federal/dsp.md`**

```markdown
---
scheme_id: DSP
tier: federal
source_url: https://www.servicesaustralia.gov.au/disability-support-pension
last_verified: 2025-05-26
---

# Disability Support Pension

The Disability Support Pension (DSP) is a fortnightly payment for people with a permanent physical, intellectual, or psychiatric condition that substantially reduces their ability to work.

## Who can get it

You may be eligible if you:
- Are aged 16 or over and under Age Pension age (67)
- Have a permanent physical, intellectual, or psychiatric condition
- Your condition prevents you from working 15 or more hours per week at or above minimum wage, or from being retrained for such work
- Meet Australian residence requirements
- Meet the income and assets tests

## Medical assessment

DSP requires a medical assessment. You will need to provide evidence from your treating doctor. Services Australia may also arrange its own medical assessment.

## Income test

The income nil-rate threshold is approximately $65,281 per year for a single person (2024–25), the same as Age Pension.

## How to apply

Apply through myGov. The process includes providing medical evidence and may take several weeks.
```

- [ ] **Step 6: Create `corpus/federal/carer_payment.md`**

```markdown
---
scheme_id: CARER_PAYMENT
tier: federal
source_url: https://www.servicesaustralia.gov.au/carer-payment
last_verified: 2025-05-26
---

# Carer Payment

Carer Payment is a fortnightly payment for people who provide constant care for someone with a severe disability, serious medical condition, or who is frail aged and unable to live independently.

## Who can get it

You may be eligible if you:
- Provide daily care at home for a person with a disability or serious illness, or an adult who is frail aged
- Your caring responsibilities prevent you from doing substantial paid work
- Meet income and assets tests
- Are an Australian resident

## Income test

The income nil-rate threshold for a single carer is approximately $65,281 per year (2024–25).

## Carer Load Assessment

The person you care for must receive a care needs assessment. You complete a Carer Payment questionnaire with Services Australia.

## How to apply

Apply through myGov linked to Centrelink. You will need details about the person you care for.
```

- [ ] **Step 7: Create `corpus/federal/carer_allowance.md`**

```markdown
---
scheme_id: CARER_ALLOWANCE
tier: federal
source_url: https://www.servicesaustralia.gov.au/carer-allowance
last_verified: 2025-05-26
---

# Carer Allowance

Carer Allowance is a fortnightly supplementary payment for people who provide daily care and attention to someone with a disability or medical condition who lives at home.

## Who can get it

You may be eligible if you:
- Provide daily care and attention to a person with a disability or medical condition
- The person you care for lives with you or you spend significant time caring for them
- The combined family income is under $250,000 per year
- Are an Australian resident

## Income test

Combined family income must be under $250,000 per year. Unlike Carer Payment, there is no assets test for Carer Allowance.

## Difference from Carer Payment

Carer Allowance is a lower supplementary payment — you can receive it in addition to Carer Payment, employment income, or other Centrelink payments. Carer Payment is a primary income support payment with a stricter income test.

## How to apply

Apply through myGov linked to Centrelink.
```

- [ ] **Step 8: Create `corpus/federal/youth_allowance.md`**

```markdown
---
scheme_id: YOUTH_ALLOWANCE
tier: federal
source_url: https://www.servicesaustralia.gov.au/youth-allowance
last_verified: 2025-05-26
---

# Youth Allowance

Youth Allowance is a fortnightly payment for young Australians aged 16–24 who are studying full-time, doing an Australian Apprenticeship, or looking for work.

## Who can get it

You may be eligible if you:
- Are aged 16 to 24 (studying) or 16 to 21 (job seeker)
- Are studying full-time, doing an apprenticeship, or looking for work
- Meet income and parental income tests
- Are an Australian resident

## Income test

Single independent young people have an income nil-rate threshold of approximately $29,000 per year. For dependants, parental income is also assessed.

## Independence

You may be assessed as independent (and avoid the parental means test) if you have worked full-time for at least 18 months in a 2-year period, or meet other independence criteria.

## How to apply

Apply through myGov linked to Centrelink.
```

- [ ] **Step 9: Create `corpus/federal/lihcc.md`**

```markdown
---
scheme_id: LIHCC
tier: federal
source_url: https://www.servicesaustralia.gov.au/low-income-health-care-card
last_verified: 2025-05-26
---

# Low Income Health Care Card (LIHCC)

The Low Income Health Care Card gives low-income earners access to cheaper medicines through the Pharmaceutical Benefits Scheme, and may entitle holders to other concessions such as bulk billing and council rate reductions.

## Who can get it

You may be eligible if you:
- Are an Australian resident
- Have a fortnightly income at or below the threshold:
  - $699 for singles (approximately $18,174/year)
  - $1,199 for couples or families with children (approximately $31,174/year)
- Do not already hold a Health Care Card, Pensioner Concession Card, or Commonwealth Seniors Health Card

## Income test only

Unlike most Centrelink payments, there is no assets test for the LIHCC — only an income test.

## Validity

The card is valid for 12 months and must be renewed each year.

## How to apply

Apply through myGov linked to Centrelink, or at a Services Australia service centre.
```

- [ ] **Step 10: Create `corpus/federal/ftb_b.md`**

```markdown
---
scheme_id: FTB_B
tier: federal
source_url: https://www.servicesaustralia.gov.au/family-tax-benefit-part-b
last_verified: 2025-05-26
---

# Family Tax Benefit Part B

Family Tax Benefit (FTB) Part B is a payment for single-income families and single parents. Unlike FTB Part A, it is a per-family payment rather than per-child.

## Who can get it

You may be eligible if you:
- Are a single parent, or one member of a couple where one partner does not work or earns a low income
- Care for a dependent child under 13 (or under 18 if studying full-time)
- Meet Australian residence requirements
- Have a primary earner income under $100,000 per year

## Income test

The primary earner's income must be under $100,000/year. If the family has two earners, the secondary earner's income is also assessed and reduces the payment above $5,767/year secondary income.

## How to apply

Apply through myGov linked to Centrelink.
```

- [ ] **Step 11: Create `corpus/federal/parenting_payment.md`**

```markdown
---
scheme_id: PARENTING_PAYMENT
tier: federal
source_url: https://www.servicesaustralia.gov.au/parenting-payment
last_verified: 2025-05-26
---

# Parenting Payment

Parenting Payment is a fortnightly income support payment for parents and guardians who are the primary carer of a young child.

## Who can get it

You may be eligible if you:
- Are the primary carer of a child, AND:
  - You are single and your youngest child is under 8 years old, OR
  - You have a partner and your youngest child is under 6 years old
- Meet income and assets tests
- Are an Australian resident

## Income test

For a single parent, the income nil-rate threshold is approximately $65,281 per year.

## Transitioning off payment

When your youngest child turns 8 (single) or 6 (partnered), you will need to transfer to another payment such as JobSeeker Payment. Activity requirements then apply.

## How to apply

Apply through myGov linked to Centrelink, or at a Services Australia service centre.
```

- [ ] **Step 12: Create NSW corpus files**

`corpus/nsw/low_income_household_rebate.md`:
```markdown
---
scheme_id: NSW_LOW_INCOME_HOUSEHOLD_REBATE
tier: state
source_url: https://www.service.nsw.gov.au/transaction/apply-for-low-income-household-rebate
last_verified: 2025-05-26
---

# NSW Low Income Household Rebate

The Low Income Household Rebate helps eligible NSW households with their electricity costs. It is a credit applied directly to your electricity bill.

## Who can get it

You may be eligible if you live in NSW and hold one of the following:
- Pensioner Concession Card
- Health Care Card (including Low Income Health Care Card)
- Commonwealth Seniors Health Card
- Department of Veterans' Affairs Gold Card

Or if your household annual income is below approximately $50,000.

## How much

Up to $285 off your electricity bill per year (2024–25 rates). Applied automatically by your electricity retailer if you advise them of your card.

## How to apply

Contact your electricity retailer and provide proof of your concession card, or apply through Service NSW.
```

`corpus/nsw/eapa.md`:
```markdown
---
scheme_id: NSW_EAPA
tier: state
source_url: https://www.service.nsw.gov.au/transaction/apply-for-energy-accounts-payment-assistance-eapa
last_verified: 2025-05-26
---

# Energy Accounts Payment Assistance (EAPA)

EAPA provides emergency energy bill assistance to NSW households experiencing financial hardship. It is delivered as vouchers that are paid directly to your energy retailer.

## Who can get it

Any NSW resident who is struggling to pay an energy bill due to financial hardship may apply. There is no income test.

## How much

Up to $1,600 per year in $50 vouchers, paid directly to your energy retailer.

## How to apply

Apply through a participating community service organisation (such as St Vincent de Paul, Salvation Army, or Wesley Mission). They assess your situation and distribute vouchers on the spot.
```

`corpus/nsw/gas_rebate.md`:
```markdown
---
scheme_id: NSW_GAS_REBATE
tier: state
source_url: https://www.service.nsw.gov.au/transaction/apply-for-gas-rebate
last_verified: 2025-05-26
---

# NSW Gas Rebate

The NSW Gas Rebate is an annual rebate on natural gas bills for eligible concession card holders connected to natural gas.

## Who can get it

You may be eligible if you live in NSW and hold:
- A Pensioner Concession Card
- A Low Income Health Care Card
- A Commonwealth Seniors Health Card

## How much

Approximately $116 per year (2024–25), applied as a credit on your gas bill.

## How to apply

Contact your gas retailer and provide your concession card details. The rebate is usually applied automatically once registered.
```

`corpus/nsw/life_support_rebate.md`:
```markdown
---
scheme_id: NSW_LIFE_SUPPORT_REBATE
tier: state
source_url: https://www.service.nsw.gov.au/transaction/apply-for-life-support-rebate
last_verified: 2025-05-26
---

# NSW Life Support Rebate

The Life Support Rebate reduces electricity or gas costs for NSW households that use approved life support equipment at home.

## Who can get it

You may be eligible if you live in NSW and use approved life support equipment, such as:
- Oxygen concentrators
- Home dialysis machines
- Ventilators
- Phototherapy equipment for infants

There is no income test.

## How much

The amount depends on the type and usage of equipment — rebates can be substantial for high-usage equipment like dialysis machines.

## How to apply

Apply through your energy retailer with a medical certificate confirming you use approved life support equipment.
```

`corpus/nsw/seniors_card.md`:
```markdown
---
scheme_id: NSW_SENIORS_CARD
tier: state
source_url: https://www.service.nsw.gov.au/transaction/apply-for-a-seniors-card
last_verified: 2025-05-26
---

# NSW Seniors Card

The NSW Seniors Card provides discounts at thousands of participating businesses and concessions on NSW public transport for older residents.

## Who can get it

You may be eligible if you:
- Live in NSW
- Are aged 60 or over
- Work no more than 20 hours per week on average in paid employment

There is no income or assets test.

## Benefits

- Discounts at 3,000+ participating businesses (retail, dining, health, accommodation)
- Discounts on NSW intercity train travel and coaches
- Free entry to some NSW national parks

## How to apply

Apply online at Service NSW or in person at a Service NSW service centre. The card is free.
```

- [ ] **Step 13: Commit corpus files**

```bash
git add corpus/
git commit -m "docs: corpus markdown for all 16 schemes (federal + NSW)"
```

---

## Task 19: Final Integration Verification

- [ ] **Step 1: Run the complete test suite**

```bash
cd apps/rules
pytest tests/ -v --tb=short
```
Expected: all tests pass (no failures, no errors).

- [ ] **Step 2: Smoke-test the multi-scheme calculate**

```bash
cd apps/rules
python -c "
from fastapi.testclient import TestClient
from main import app
client = TestClient(app)

# Comprehensive NSW pensioner scenario
r = client.post('/calculate', json={'variables': {
    'is_australian_resident': True,
    'state': 'NSW',
    'age': 70,
    'annual_income': 25000.0,
    'tenure_type': 'renting',
    'rent_paid_fortnightly': 400.0,
    'number_of_children': 0,
}})
d = r.json()
print('Eligible:', sorted(d['eligible']))
print('Missing:', sorted(d['missing_variables']))
"
```
Expected eligible (at minimum): `['AGE_PENSION', 'NSW_GAS_REBATE', 'NSW_LOW_INCOME_HOUSEHOLD_REBATE', 'NSW_SENIORS_CARD', 'RENT_ASSISTANCE']`

- [ ] **Step 3: Final commit and tag**

```bash
git add -A
git commit -m "milestone 3: real eligibility engine — 16 schemes, /calculate, /schemes, tests, corpus"
```

---

## Self-Review Checklist

### Spec coverage
- [x] Real `/calculate` endpoint — Task 2
- [x] Real `/schemes` endpoint — Task 2
- [x] FTB-A: already existed, updated YAML — Task 2
- [x] Rent Assistance: already existed, updated YAML — Task 2
- [x] JobSeeker Payment — Task 4
- [x] Age Pension — Task 5
- [x] DSP — Task 6
- [x] Carer Payment — Task 7
- [x] Carer Allowance — Task 7
- [x] Youth Allowance — Task 8
- [x] LIHCC — Task 9
- [x] FTB-B — Task 10
- [x] Parenting Payment — Task 10
- [x] `has_pensioner_concession_card` derived — Task 11
- [x] NSW Low Income Household Rebate — Task 12
- [x] NSW EAPA — Task 13
- [x] NSW Gas Rebate — Task 14
- [x] NSW Life Support Rebate — Task 15
- [x] NSW Seniors Card — Task 16
- [x] Tests with known worked examples — Tasks 3–16
- [x] Corpus markdown for all 16 schemes — Task 18

### Type consistency
- All variables imported from `openfisca_au.entities` as `Person` — consistent
- All `eligibility_variable` names in YAMLs match class names in `.py` files — consistent
- All `required_inputs` keys match variable names in `tbs.variables` — consistent

### No placeholders
- All code blocks contain real implementation
- All parameter values are specific 2024-25 Australian rates
- All test assertions reference specific scheme IDs
