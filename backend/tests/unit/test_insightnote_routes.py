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


def test_notebook_note_source_converts_and_enqueues(client, mock_rag, monkeypatch):
    """Notebook note route should index text directly without multimodal file parsing."""
    from unittest.mock import AsyncMock

    import app.api.routers.insightnote_routes as routes

    async def fake_get_rag_instance(notebook_id, default_rag):
        return mock_rag

    monkeypatch.setattr(routes, "get_rag_instance", fake_get_rag_instance)
    monkeypatch.setattr(
        routes,
        "ensure_notebook_exists",
        AsyncMock(return_value={"id": "notebook_fun", "name": "Fun Notebook"}),
    )
    mock_pipeline_index_texts = AsyncMock()
    monkeypatch.setattr(routes, "pipeline_index_texts", mock_pipeline_index_texts)
    monkeypatch.setattr(routes.chat_history_db, "create_job", AsyncMock())
    monkeypatch.setattr(routes.chat_history_db, "update_notebook_status", AsyncMock())

    response = client.post(
        "/api/notebooks/notebook_fun/sources/note",
        json={"title": "Key facts / summary", "content": "A concise note."},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "text"
    assert data["status"] == "processing"
    assert data["pipeline_job_id"].startswith("job_note_")
    mock_pipeline_index_texts.assert_awaited_once()
    _, args, _ = mock_pipeline_index_texts.mock_calls[0]
    assert args[1] == ["# Key facts / summary\n\nA concise note."]
    assert args[4] is True
    assert args[5] is False


def test_notebook_url_source_crawls_and_indexes_text(client, mock_rag, monkeypatch):
    """Notebook URL route should crawl markdown and index text directly."""
    import sys
    import types
    from unittest.mock import AsyncMock

    import app.api.routers.insightnote_routes as routes

    class FakeCrawlResult:
        markdown = "# Crawled page\n\nUseful facts."

    class FakeCrawler:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def arun(self, url):
            return FakeCrawlResult()

    fake_crawl4ai = types.SimpleNamespace(AsyncWebCrawler=FakeCrawler)
    monkeypatch.setitem(sys.modules, "crawl4ai", fake_crawl4ai)
    monkeypatch.setenv("INSIGHTNOTE_USE_CRAWL4AI", "1")
    monkeypatch.setattr(routes.platform, "system", lambda: "Linux")

    async def fake_get_rag_instance(notebook_id, default_rag):
        return mock_rag

    monkeypatch.setattr(routes, "get_rag_instance", fake_get_rag_instance)
    monkeypatch.setattr(
        routes,
        "ensure_notebook_exists",
        AsyncMock(return_value={"id": "notebook_fun", "name": "Fun Notebook"}),
    )
    mock_pipeline_index_texts = AsyncMock()
    monkeypatch.setattr(routes, "pipeline_index_texts", mock_pipeline_index_texts)
    monkeypatch.setattr(routes.chat_history_db, "create_job", AsyncMock())
    monkeypatch.setattr(routes.chat_history_db, "update_notebook_status", AsyncMock())

    response = client.post(
        "/api/notebooks/notebook_fun/sources/url",
        json={"url": "example.com/test?a=1"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "url"
    assert data["status"] == "processing"
    assert data["pipeline_job_id"].startswith("job_url_")
    mock_pipeline_index_texts.assert_awaited_once()
    _, args, _ = mock_pipeline_index_texts.mock_calls[0]
    assert args[1] == ["# Crawled page\n\nUseful facts."]
    assert args[2] == ["https://example.com/test?a=1"]
    assert args[4] is True
    assert args[5] is False


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


def test_get_node_details_security_filter(client, mock_rag, monkeypatch):
    """Test that get_notebook_node_details strips source_id, doc_id, chunk_id, track_id."""
    from unittest.mock import AsyncMock, MagicMock

    import app.api.routers.insightnote_routes as routes

    monkeypatch.setattr(
        routes,
        "ensure_notebook_exists",
        AsyncMock(return_value={"id": "notebook_test", "name": "Test Notebook"}),
    )
    monkeypatch.setattr(routes, "get_rag_instance", AsyncMock(return_value=mock_rag))

    mock_session = AsyncMock()
    mock_run_result = AsyncMock()

    fake_node_data = {
        "entity_id": "test_node_id",
        "entity_type": "Concept",
        "description": "A node for unit testing.",
        "source_id": "doc-12345",
        "doc_id": "doc-abcde",
        "chunk_id": "chunk-9999",
        "track_id": "track-5555",
        "custom_public_prop": "visible_value",
    }

    mock_run_result.single = AsyncMock(return_value={"n": fake_node_data})
    mock_session.run = AsyncMock(return_value=mock_run_result)

    mock_driver = MagicMock()
    mock_driver.session.return_value.__aenter__.return_value = mock_session
    mock_rag.chunk_entity_relation_graph._driver = mock_driver
    mock_rag.chunk_entity_relation_graph._DATABASE = "neo4j"
    mock_rag.chunk_entity_relation_graph._get_workspace_label = MagicMock(
        return_value="test_label"
    )

    response = client.get("/api/notebooks/notebook_test/graph/node/test_node_id")
    assert response.status_code == 200
    data = response.json()

    assert data["id"] == "test_node_id"
    assert data["type"] == "Concept"
    assert data["properties"]["description"] == "A node for unit testing."
    assert data["properties"]["custom_public_prop"] == "visible_value"

    for sensitive_key in [
        "source_id",
        "doc_id",
        "chunk_id",
        "track_id",
        "entity_id",
        "entity_type",
    ]:
        assert sensitive_key not in data["properties"]


def test_ask_notebook_chat_metadata_security_filter(client, mock_rag, monkeypatch):
    """Test that ask_notebook_chat strips source_id and sanitizes absolute file_path."""
    from unittest.mock import AsyncMock, MagicMock

    import app.api.routers.insightnote_routes as routes

    monkeypatch.setattr(
        routes,
        "ensure_notebook_exists",
        AsyncMock(return_value={"id": "notebook_test", "name": "Test Notebook"}),
    )
    monkeypatch.setattr(routes, "get_rag_instance", AsyncMock(return_value=mock_rag))

    dummy_doc = MagicMock()
    dummy_doc.file_path = "policy.pdf"
    mock_rag.doc_status.get_docs_paginated.return_value = (
        [("doc_123", dummy_doc)],
        1,
    )
    mock_rag.graph_ready = True

    mock_rag.aquery_llm.return_value = {
        "status": "success",
        "message": "Query executed",
        "llm_response": {"content": "Answer content"},
        "data": {
            "entities": [
                {
                    "entity_name": "Nguyen Phuoc Thanh",
                    "entity_type": "Person",
                    "description": "Developer",
                    "source_id": "doc-00123",
                    "file_path": "C:\\Users\\admin\\Desktop\\Resume.pdf",
                }
            ],
            "relationships": [
                {
                    "src_id": "A",
                    "tgt_id": "B",
                    "description": "friends",
                    "weight": 0.95,
                    "source_id": "doc-00456",
                }
            ],
            "chunks": [],
            "references": [],
        },
        "metadata": {"keywords": {"high_level": [], "low_level": []}},
    }

    payload = {
        "workspace_id": "notebook_test",
        "message": "Tell me about Nguyen Phuoc Thanh.",
        "mode": "mix",
    }

    response = client.post("/api/notebooks/notebook_test/chat", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert len(data["nodes_metadata"]) == 1
    node_meta = data["nodes_metadata"][0]
    assert node_meta["id"] == "Nguyen Phuoc Thanh"

    assert "source_id" not in node_meta["properties"]
    assert "file_path" not in node_meta["properties"]
    assert node_meta["properties"]["file_name"] == "Resume.pdf"

    assert len(data["links_metadata"]) == 1
    link_meta = data["links_metadata"][0]
    assert link_meta["source"] == "A"
    assert "source_id" not in link_meta["properties"]


def test_url_citation_title_uses_doc_status_summary():
    """URL citations should display the crawled page title, not a generic fallback."""
    from app.api.routers.insightnote_routes import _citation_title_from_reference

    source_titles = {
        "https://contest.nypc.co.kr/": "NYPC",
        "https://contest.nypc.co.kr": "NYPC",
    }

    title = _citation_title_from_reference(
        {"reference_id": "3"},
        "https://contest.nypc.co.kr/",
        source_titles,
    )

    assert title == "NYPC"
