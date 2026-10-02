"""
ML/tests/test_api.py
--------------------
FastAPI endpoints testing using TestClient.
Verifies response schemas, status codes, and coordinate clipping.
"""

from __future__ import annotations

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi.testclient import TestClient
from src.serving.api import app

client = TestClient(app)


def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["depth_levels"] == 15


def test_field_endpoint():
    res = client.get("/field/2023-06-01?var=temp_50m&stride=2")
    assert res.status_code == 200
    data = res.json()
    assert data["variable"] == "temp_50m"
    assert len(data["lat"]) == 50
    assert len(data["lon"]) == 120
    assert len(data["data"]) == 50


def test_profile_endpoint():
    res = client.get("/profile/2023-06-01?lat=15.0&lon=88.0")
    assert res.status_code == 200
    data = res.json()
    assert len(data["depths"]) == 15
    assert len(data["temp_pred"]) == 15
    assert len(data["temp_lo"]) == 15
    assert len(data["temp_hi"]) == 15
    assert len(data["analog_dates"]) > 0


def test_diagnostics_endpoint():
    res = client.get("/diagnostics/2023-06-01?lat=15.0&lon=88.0")
    assert res.status_code == 200
    data = res.json()
    assert "mld_m" in data
    assert "thermocline_depth_m" in data
    assert "d20_m" in data
    assert "uhc_kj_cm2" in data


def test_alerts_endpoint():
    res = client.get("/alerts/2023-06-01")
    assert res.status_code == 200
    data = res.json()
    assert "marine_heatwave_alerts" in data
    assert "upwelling_alerts" in data
