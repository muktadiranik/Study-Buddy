from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi.testclient import TestClient
from openai import APIConnectionError, APIStatusError, RateLimitError

from backend import main

client = TestClient(main.app)
payload = {"title": "Plants", "subject": "Biology", "notes": "Photosynthesis makes glucose."}


@pytest.fixture(autouse=True)
def no_real_api(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    # Every endpoint test blocks the provider by default. Tests opt into a mock explicitly.
    monkeypatch.setattr(
        main, "generate_materials", AsyncMock(side_effect=AssertionError("Real API forbidden"))
    )


def test_app_status_and_missing_key():
    assert client.get("/api/status").json()["ai_enabled"] is False
    response = client.post("/api/generate", json=payload)
    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["error"]


def test_valid_mocked_integration(monkeypatch, materials):
    monkeypatch.setenv("OPENAI_API_KEY", "test-only-key")
    fake = AsyncMock(return_value=(materials, False))
    monkeypatch.setattr(main, "generate_materials", fake)
    response = client.post("/api/generate", json=payload)
    assert response.status_code == 200
    assert response.json()["materials"] == materials
    assert "test-only-key" not in response.text
    fake.assert_awaited_once()


@pytest.mark.parametrize(
    "body",
    [
        {},
        {**payload, "notes": " "},
        {**payload, "notes": "a" * 20001},
        {**payload, "title": "a" * 101},
        {**payload, "notes": 123},
    ],
)
def test_invalid_input_is_rejected_before_provider(body):
    assert client.post("/api/generate", json=body).status_code == 422
    main.generate_materials.assert_not_awaited()


def test_malformed_and_excessive_request():
    assert client.post("/api/generate", content="{invalid").status_code == 422
    assert client.post("/api/generate", content="a" * 100001).status_code == 413


def test_cross_origin_request_blocked():
    response = client.post(
        "/api/generate", json=payload, headers={"Origin": "https://untrusted.test"}
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    ("exc", "status", "message"),
    [
        (TimeoutError(), 504, "too long"),
        (ValueError("private provider detail"), 502, "invalid"),
        (
            APIConnectionError(request=httpx.Request("POST", "https://api.openai.com")),
            502,
            "reach OpenAI",
        ),
        (RuntimeError("secret-private-value"), 500, "unexpectedly"),
    ],
)
def test_failures_are_helpful_and_redacted(monkeypatch, exc, status, message):
    monkeypatch.setenv("OPENAI_API_KEY", "test-only-key")
    monkeypatch.setattr(main, "generate_materials", AsyncMock(side_effect=exc))
    response = client.post("/api/generate", json=payload)
    assert response.status_code == status
    assert message in response.json()["error"]
    assert "private" not in response.text
    assert "test-only-key" not in response.text


@pytest.mark.parametrize(
    ("code", "expected"), [(401, "rejected access"), (400, "model setting"), (429, "quota")]
)
def test_provider_errors(monkeypatch, code, expected):
    monkeypatch.setenv("OPENAI_API_KEY", "test-only-key")
    response = httpx.Response(code, request=httpx.Request("POST", "https://api.openai.com"))
    cls = RateLimitError if code == 429 else APIStatusError
    monkeypatch.setattr(
        main,
        "generate_materials",
        AsyncMock(side_effect=cls("private", response=response, body=None)),
    )
    result = client.post("/api/generate", json=payload)
    assert expected in result.json()["error"]
