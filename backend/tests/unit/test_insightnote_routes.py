import pytest
from fastapi.testclient import TestClient


def test_api_health(client):
    """Test /api/health endpoint returns status ok."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "insightnote-backend"


def test_list_sources_empty_fallback(client):
    """Test /api/sources returns the fallback mock source when DB is empty."""
    response = client.get("/api/sources")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Insurance Policy (Demo)"
    assert data[0]["status"] == "ready"


def test_add_text_source(client):
    """Test POST /api/sources successfully adds raw text note."""
    payload = {
        "workspace_id": "test",
        "type": "text",
        "value": "This is a custom test text note.",
    }
    response = client.post("/api/sources", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "source_id" in data
    assert data["type"] == "text"
    assert data["status"] == "indexing"


def test_chat_preset_question(client):
    """Test POST /api/chat intercepts standard demo questions and returns deterministic preset."""
    payload = {
        "workspace_id": "test",
        "message": "does this policy cover motorcycle accidents?",
    }
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "Yes. Motorcycle accidents are covered" in data["answer"]
    assert len(data["citations"]) == 1
    assert data["citations"][0]["title"] == "Insurance Policy"
    assert data["graph_path"]["node_ids"] == [
        "policy_001",
        "coverage_012",
        "vehicle_accident_007",
        "motorcycle_003",
    ]


def test_chat_arbitrary_question(client):
    """Test POST /api/chat triggers the real ZeRAG mock querying for unmapped requests."""
    payload = {
        "workspace_id": "test",
        "message": "some random question here about politics",
    }
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    # It returns our generic mock warning answer since DB is empty
    assert "No loaded sources detected" in data["retrieval_steps"]


def test_get_graph_mock_fallback(client):
    """Test GET /api/graph falls back to pre-populated insurance mock graph when Neo4j is offline."""
    response = client.get("/api/graph")
    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data
    assert "links" in data
    assert len(data["nodes"]) > 5
    assert data["nodes"][0]["id"] == "policy_001"


def test_get_node_details(client):
    """Test GET /api/graph/node/{node_id} retrieves details from mock database."""
    response = client.get("/api/graph/node/policy_001")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "policy_001"
    assert data["label"] == "Insurance Policy"
    assert data["properties"]["source"] == "Policy Main"
