from unittest.mock import AsyncMock, patch

import pytest


def test_source_to_query_lifecycle(client, mock_rag, monkeypatch):
    """
    Simulates the end-to-end integration lifecycle:
    1. A text source is added via POST /api/sources
    2. Document registry indicates the document exists
    3. Chat query retrieves context from this newly registered file
    """
    # 1. Add Text Source
    payload = {
        "workspace_id": "test",
        "type": "text",
        "value": "This is a policy clause indicating that street racing voids coverage.",
    }
    add_response = client.post("/api/sources", json=payload)
    assert add_response.status_code == 200
    source_id = add_response.json()["source_id"]

    # 2. Mock doc_status registry to show we now have an ingested document
    from app.core.base import DocStatus

    mock_doc = MagicMock()
    mock_doc.file_path = "Note-RacingExclusion"
    mock_doc.status = "ready"
    mock_doc.chunks_count = 1
    mock_doc.metadata = {"entity_count": 4}

    # Update mock to return this doc in list sources
    mock_rag.doc_status.get_docs_paginated.return_value = ([(source_id, mock_doc)], 1)

    list_response = client.get("/api/sources")
    assert list_response.status_code == 200
    sources = list_response.json()
    assert len(sources) == 1
    assert sources[0]["name"] == "Note-RacingExclusion"

    # 3. Trigger Chat Query and ensure it retrieves and responds
    # Update mock_rag query response to simulate finding our racing exclusions
    mock_rag.aquery_llm.return_value = {
        "status": "success",
        "message": "Query executed",
        "llm_response": {
            "content": "Street racing is excluded under this policy endorsement."
        },
        "data": {
            "entities": [{"entity_name": "street_racing"}],
            "relationships": [],
            "chunks": [
                {"reference_id": source_id, "content": "Street racing voids coverage."}
            ],
            "references": [
                {"reference_id": source_id, "file_path": "Note-RacingExclusion"}
            ],
        },
        "metadata": {"keywords": {"high_level": ["racing"], "low_level": []}},
    }

    chat_payload = {"workspace_id": "test", "message": "is street racing covered?"}
    chat_response = client.post("/api/chat", json=chat_payload)
    assert chat_response.status_code == 200
    chat_data = chat_response.json()

    assert "street racing is excluded" in chat_data["answer"].lower()
    assert len(chat_data["citations"]) == 1
    assert chat_data["citations"][0]["title"] == "Note-RacingExclusion"
    assert chat_data["graph_path"]["node_ids"] == ["street_racing"]


from unittest.mock import MagicMock
