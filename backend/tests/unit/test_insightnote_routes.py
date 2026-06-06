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
    assert data[0]["name"] == "Insurance Policy Demo"
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
    assert data["citations"][0]["title"] == "Insurance Policy Demo"
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
    assert data["label"] == "Policy"
    assert data["properties"]["source"] == "Policy Main"


def test_get_rag_instance_copies_file_processor_func(monkeypatch):
    """Verify that get_rag_instance correctly copies file_processor_func from default_rag to isolated_rag."""
    import asyncio
    from unittest.mock import AsyncMock, MagicMock

    from app.api.routers.insightnote_routes import get_rag_instance, rag_instances
    from app.core import ZeRAG

    test_workspace = "test_workspace_temp_999"
    if test_workspace in rag_instances:
        del rag_instances[test_workspace]

    # Mock ZeRAG constructor and initialize_storages to prevent actual DB connection/setup
    mock_init = MagicMock(return_value=None)
    monkeypatch.setattr(ZeRAG, "__init__", mock_init)

    mock_init_storages = AsyncMock()
    monkeypatch.setattr(ZeRAG, "initialize_storages", mock_init_storages)

    # Mock check_and_reinit_graph to do nothing
    monkeypatch.setattr(
        "app.api.routers.insightnote_routes.check_and_reinit_graph", AsyncMock()
    )

    # Create a dummy default_rag with doc_status type not being AsyncMock/MagicMock
    default_rag = MagicMock()
    default_rag.doc_status = "not-mock"

    async def dummy_processor(file_path, doc_id=None, track_id=None):
        return "processed content"

    default_rag.file_processor_func = dummy_processor

    # Call get_rag_instance using a temporary event loop
    loop = asyncio.new_event_loop()
    try:
        isolated_rag = loop.run_until_complete(
            get_rag_instance(test_workspace, default_rag)
        )
    finally:
        loop.close()

    # Check that file_processor_func was successfully copied
    assert hasattr(isolated_rag, "file_processor_func")
    assert isolated_rag.file_processor_func == dummy_processor

    # Clean up the global registry
    if test_workspace in rag_instances:
        del rag_instances[test_workspace]


def test_upload_file_stream(client, mock_rag):
    """Test POST /documents/upload/stream enqueues file and returns NDJSON progress stream."""
    from unittest.mock import AsyncMock

    mock_rag.doc_status.get_doc_by_file_path.return_value = None
    mock_rag.doc_status.get_docs_by_track_id.return_value = {}
    mock_rag.apipeline_enqueue_file_reference = AsyncMock(
        return_value=(True, "job_test_track_123")
    )
    mock_rag.apipeline_process_enqueue_documents = AsyncMock()

    import server

    headers = {}
    if getattr(server, "api_key", None):
        headers["X-API-Key"] = server.api_key

    files = {"file": ("test_doc.pdf", b"dummy content", "application/pdf")}
    response = client.post(
        "/api/documents/upload/stream?workspace=test-workspace",
        files=files,
        headers=headers,
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/x-ndjson"

    # Read the streaming response lines
    lines = [
        line if isinstance(line, str) else line.decode("utf-8")
        for line in response.iter_lines()
    ]
    assert len(lines) > 0

    import json

    first_chunk = json.loads(lines[0])
    assert "job_id" in first_chunk
    assert first_chunk["status"] == "processing"
    assert [step["name"] for step in first_chunk["steps"]] == [
        "load_file",
        "document_understanding",
        "vector_graph_sync",
    ]


def test_chat_query_mode_fallback_when_graph_offline(client, mock_rag, caplog):
    """Test that query mode falls back to naive when graph is not ready."""
    import logging
    from unittest.mock import MagicMock

    # Enable caplog to capture warning logs at WARNING level
    caplog.set_level(logging.WARNING)

    # Simulate that we have ingested documents so it tries real querying
    dummy_doc = MagicMock()
    dummy_doc.file_path = "policy.pdf"
    mock_rag.doc_status.get_docs_paginated.return_value = ([("doc_123", dummy_doc)], 1)

    # Explicitly set graph_ready to False
    mock_rag.graph_ready = False

    # Request a query with mode "mix"
    payload = {
        "workspace_id": "test",
        "message": "Verify this policy's fallback query mechanism.",
        "mode": "mix",
    }

    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200

    # Check that aquery_llm was called with mode="naive" instead of "mix"
    assert mock_rag.aquery_llm.called
    called_args, called_kwargs = mock_rag.aquery_llm.call_args
    param = called_kwargs.get("param")
    assert param is not None
    assert param.mode == "naive"

    # Assert that the warning log was output
    warning_msgs = [rec.message for rec in caplog.records if rec.levelname == "WARNING"]
    fallback_warning_exists = any(
        "[QUERY] Neo4j database is offline/not initialized. Automatically falling back query mode from 'mix' to 'naive'."
        in msg
        for msg in warning_msgs
    )
    assert fallback_warning_exists
