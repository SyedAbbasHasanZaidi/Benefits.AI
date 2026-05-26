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
    """Return 'ETERNITY' for ETERNITY-period variables, else the current year string."""
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
