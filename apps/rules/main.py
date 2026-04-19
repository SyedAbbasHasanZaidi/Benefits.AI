from contextlib import asynccontextmanager
from typing import Any
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from openfisca_au import AustraliaTaxBenefitSystem  # noqa: E402

tbs: AustraliaTaxBenefitSystem | None = None


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
    """
    Returns the full variable registry from OpenFisca.
    Used by scripts/build_registry.ts to generate the TypeScript enum
    that locks the LLM's set_variable tool — preventing hallucinated names.
    """
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
    """
    Returns metadata for every codified scheme (name, tier, delivery_channel,
    agency, apply_url). Loaded from apps/rules/schemes/*.yaml in Milestone 2.
    """
    return {"schemes": []}


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

    Returns:
      eligible          — scheme IDs the person likely qualifies for
      ineligible        — scheme IDs they don't qualify for (with reasons in traces)
      missing_variables — variables the engine still needs to reach a verdict
      traces            — rule trace per scheme for the explanation layer

    Full implementation in Milestone 2. Stub returns typed response so the
    TypeScript client can be generated against the real contract now.
    """
    return CalculateResponse(
        eligible=[],
        ineligible=[],
        missing_variables=list(body.variables.keys()),
        traces={},
    )
