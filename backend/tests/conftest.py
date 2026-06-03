import os
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

# Add mock env variables
os.environ["WORKSPACE"] = "test-workspace"
os.environ["WORKING_DIR"] = "./test_rag_storage"

import server


@pytest.fixture
def mock_rag():
    """Fixture that configures and returns the patched server.rag instance."""
    # Patch the real server.rag attributes in-place so closures are preserved
    server.rag.graph_ready = False
    server.rag.workspace = "test-workspace"

    # Mock doc_status storage
    mock_doc_status = AsyncMock()
    mock_doc_status.get_docs_paginated.return_value = ([], 0)
    server.rag.doc_status = mock_doc_status

    # Mock aquery_llm
    server.rag.aquery_llm = AsyncMock()
    server.rag.aquery_llm.return_value = {
        "status": "success",
        "message": "Query executed",
        "llm_response": {"content": "This is a real RAG answer."},
        "data": {
            "entities": [{"entity_name": "policy_001"}],
            "relationships": [],
            "chunks": [{"reference_id": "ref_001", "content": "RAG chunk contents"}],
            "references": [{"reference_id": "ref_001", "file_path": "policy.pdf"}],
        },
        "metadata": {"keywords": {"high_level": ["policy"], "low_level": []}},
    }

    # Mock chunk_entity_relation_graph
    mock_graph = AsyncMock()
    mock_graph.get_all_nodes.return_value = []
    mock_graph.get_all_edges.return_value = []
    server.rag.chunk_entity_relation_graph = mock_graph

    # Mock lifespan actions
    server.rag.initialize_storages = AsyncMock()
    server.rag.finalize_storages = AsyncMock()
    server.rag.check_and_migrate_data = AsyncMock()

    return server.rag


@pytest.fixture
def client(mock_rag):
    """Fixture for FastAPI TestClient."""
    # Monkeypatch the background tasks to prevent actual RAG pipeline executions during unit testing
    import app.api.routers.insightnote_routes

    app.api.routers.insightnote_routes.pipeline_index_texts = AsyncMock()
    app.api.routers.insightnote_routes.pipeline_enqueue_file = AsyncMock()

    with TestClient(server.app) as test_client:
        yield test_client
