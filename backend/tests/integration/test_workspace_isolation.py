import uuid

import pytest
import server
from fastapi.testclient import TestClient


def test_notebook_workspace_isolation_lifecycle(client):
    """
    Integration test covering the complete lifecycle of dynamic multi-notebook workspaces,
    PostgreSQL chat history persistence, and graph retrieval isolation.
    """
    notebook_id = f"test_notebook_resume_{uuid.uuid4().hex[:8]}"
    notebook_name = f"Test Resume Workspace {uuid.uuid4().hex[:4].upper()}"

    # 1. Verify notebook_id does not exist initially in notebooks list
    response = client.get("/api/notebooks")
    assert response.status_code == 200
    notebooks = response.json()
    assert not any(n["id"] == notebook_id for n in notebooks)

    # 2. Create a new notebook workspace
    create_payload = {"name": notebook_name}
    response = client.post("/api/notebooks", json=create_payload)
    assert response.status_code == 200
    new_nb = response.json()
    assert "notebook_" in new_nb["id"]
    real_notebook_id = new_nb["id"]  # Captured real lowercase-normalized ID
    assert new_nb["name"] == notebook_name
    assert new_nb["status"] == "empty"

    # 3. Get details of the newly created notebook
    response = client.get(f"/api/notebooks/{real_notebook_id}")
    assert response.status_code == 200
    assert response.json()["id"] == real_notebook_id

    # 4. List sources under the empty notebook (should be empty list)
    response = client.get(f"/api/notebooks/{real_notebook_id}/sources")
    assert response.status_code == 200
    assert response.json() == []

    # 5. Create a new persistent chat session in PostgreSQL for this notebook
    conversation_id = f"conv_{uuid.uuid4().hex[:8]}"
    session_payload = {
        "conversation_id": conversation_id,
        "title": "Initial RAG Query session",
    }
    response = client.post(
        f"/api/notebooks/{real_notebook_id}/conversations", json=session_payload
    )
    assert response.status_code == 200
    conv_data = response.json()
    assert conv_data["id"] == conversation_id
    assert conv_data["notebook_id"] == real_notebook_id
    assert conv_data["title"] == "Initial RAG Query session"

    # 6. List conversations for the active notebook
    response = client.get(f"/api/notebooks/{real_notebook_id}/conversations")
    assert response.status_code == 200
    conversations = response.json()
    assert len(conversations) >= 1
    assert any(c["id"] == conversation_id for c in conversations)

    # 7. Ask a chat question matching a resume preset - verifies PostgreSQL persistence
    chat_payload = {
        "message": "what projects did this candidate work on at fpt software?",
        "mode": "mix",
        "conversation_id": conversation_id,
    }
    # Intercepting through resume match presets to ensure instant, stable response
    response = client.post(f"/api/notebooks/{real_notebook_id}/chat", json=chat_payload)
    assert response.status_code == 200
    chat_response = response.json()
    assert (
        "facial recognition" in chat_response["answer"].lower()
        or "projects" in chat_response["answer"].lower()
    )
    assert len(chat_response["citations"]) >= 1
    assert "FPT Software" in chat_response["citations"][0]["text"]
    assert "nodes_metadata" in chat_response or "graph_path" in chat_response

    # 8. Retrieve messages for the active conversation - verifies BOTH messages are in PostgreSQL
    response = client.get(
        f"/api/notebooks/{real_notebook_id}/conversations/{conversation_id}/messages"
    )
    assert response.status_code == 200
    messages = response.json()
    assert len(messages) == 2  # 1 User message + 1 Assistant message

    # Message 1: User
    assert messages[0]["role"] == "user"
    assert "fpt software" in messages[0]["content"].lower()

    # Message 2: Assistant
    assert messages[1]["role"] == "assistant"
    assert "citations" in messages[1]["metadata"]
    assert len(messages[1]["metadata"]["citations"]) >= 1

    # 9. Update conversation display title
    title_payload = {"title": "FPT Software Project Discussion"}
    response = client.put(
        f"/api/notebooks/{real_notebook_id}/conversations/{conversation_id}/title",
        json=title_payload,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Verify title has changed in list
    response = client.get(f"/api/notebooks/{real_notebook_id}/conversations")
    assert response.status_code == 200
    conversations = response.json()
    assert any(
        c["id"] == conversation_id and c["title"] == "FPT Software Project Discussion"
        for c in conversations
    )

    # 10. Fetch graph nodes and links for the isolated workspace (falls back to mock if empty)
    response = client.get(f"/api/notebooks/{real_notebook_id}/graph")
    assert response.status_code == 200
    graph_data = response.json()
    assert "nodes" in graph_data
    assert "links" in graph_data

    # 11. Fetch node details for a specific node under this workspace
    response = client.get(f"/api/notebooks/{real_notebook_id}/graph/node/policy_001")
    assert response.status_code == 200
    node_details = response.json()
    assert node_details["id"] == "policy_001"

    # 12. Fetch neighboring connections for a selected node under this workspace
    response = client.get(
        f"/api/notebooks/{real_notebook_id}/graph/node/policy_001/neighbors"
    )
    assert response.status_code == 200
    neighbors_data = response.json()
    assert "nodes" in neighbors_data
    assert "links" in neighbors_data

    # 13. Delete the persistent conversation session
    response = client.delete(
        f"/api/notebooks/{real_notebook_id}/conversations/{conversation_id}"
    )
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Verify conversation is gone
    response = client.get(f"/api/notebooks/{real_notebook_id}/conversations")
    assert response.status_code == 200
    assert not any(c["id"] == conversation_id for c in response.json())

    # 14. Delete the entire notebook workspace
    response = client.delete(f"/api/notebooks/{real_notebook_id}")
    assert response.status_code == 200
    assert "successfully deleted" in response.json()["message"]

    # Verify notebook is gone from notebooks list
    response = client.get("/api/notebooks")
    assert response.status_code == 200
    assert not any(n["id"] == real_notebook_id for n in response.json())
