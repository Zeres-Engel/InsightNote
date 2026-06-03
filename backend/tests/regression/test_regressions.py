import pytest


def test_no_regression_on_health(client):
    """Simple regression check to verify endpoints are always stable."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
