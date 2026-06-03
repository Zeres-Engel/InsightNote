import os
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

# Add mock env variables
os.environ["WORKSPACE"] = "test-workspace"
os.environ["WORKING_DIR"] = "./test_rag_storage"

from server import app, doc_manager, rag


@pytest.fixture
def mock_rag():
    """Fixture to mock ZeRAG instance and its storages."""
    mock_inst = MagicMock()
    mock_inst.graph_ready = False
    mock_inst.workspace = "test-workspace"

    # Mock doc_status storage
    mock_doc_status = AsyncMock()
    # Mock return values
    mock_doc_status.get_docs_paginated.return_value = ([], 0)
    mock_inst.doc_status = mock_doc_status

    # Mock aquery_llm
    mock_inst.aquery_llm = AsyncMock()
    mock_inst.aquery_llm.return_value = {
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
    mock_inst.chunk_entity_relation_graph = mock_graph

    return mock_inst


@pytest.fixture
def client(mock_rag, monkeypatch):
    """Fixture for FastAPI TestClient."""
    # Patch the global 'rag' inside server.py with our mock_rag
    import server

    monkeypatch.setattr(server, "rag", mock_rag)

    with TestClient(app) as test_client:
        yield test_client
