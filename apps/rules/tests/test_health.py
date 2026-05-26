import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_healthz_returns_ok(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "benefits-ai-rules"
    assert data["tbs_loaded"] is True


def test_variables_returns_list(client):
    response = client.get("/variables")
    assert response.status_code == 200
    body = response.json()
    assert "variables" in body
    assert isinstance(body["variables"], list)


def test_schemes_returns_list(client):
    response = client.get("/schemes")
    assert response.status_code == 200
    assert isinstance(response.json()["schemes"], list)


def test_calculate_returns_typed_response(client):
    response = client.post(
        "/calculate",
        json={"variables": {"annual_income": 45000, "state": "NSW"}},
    )
    assert response.status_code == 200
    data = response.json()
    assert "eligible" in data
    assert "ineligible" in data
    assert "missing_variables" in data
    assert "traces" in data
    assert isinstance(data["eligible"], list)


def test_calculate_empty_variables(client):
    response = client.post("/calculate", json={"variables": {}})
    assert response.status_code == 200
