# 🔌 InsightNote - API Integration Contract

This document outlines the strict API integration contract between the **Vite React Frontend** and the **FastAPI Backend** for the multi-notebook GraphRAG knowledge workspace.

---

## 🧭 Overview & Core Conventions

1.  **Base URL**: `http://localhost:8000/api`
2.  **State Decoupling**: All communications must happen over standard asynchronous HTTP/JSON.
3.  **Cross-Origin Resource Sharing (CORS)**: The FastAPI backend must enable CORS headers to allow requests from the Vite frontend running on port `3000`.

---

## 📂 API Reference

### 1. Health Diagnostic
Check if the backend services and databases (MongoDB, Neo4j, Qdrant) are online and healthy.

*   **URL**: `/health`
*   **Method**: `GET`
*   **Response (`200 OK`)**:
    ```json
    {
      "status": "ok",
      "service": "insightnote-backend"
    }
    ```

---

### 2. List Notebooks
Retrieve all isolated research workspaces/notebooks.

*   **URL**: `/notebooks`
*   **Method**: `GET`
*   **Response (`200 OK`)**:
    ```json
    [
      {
        "id": "notebook_insurance_demo",
        "name": "Insurance Analysis (Demo)",
        "source_count": 1,
        "status": "ready"
      }
    ]
    ```

---

### 3. Create Notebook
Set up a brand new notebook with its own isolated knowledge silo.

*   **URL**: `/notebooks`
*   **Method**: `POST`
*   **Request Body**:
    ```json
    {
      "name": "Resume Analysis"
    }
    ```
*   **Response (`200 OK` or `210 Created`)**:
    ```json
    {
      "id": "nb_1715495821",
      "name": "Resume Analysis",
      "source_count": 0,
      "status": "empty"
    }
    ```

---

### 4. Delete Notebook 🆕
Delete an entire notebook and wipe its associated database nodes and file vectors.

*   **URL**: `/notebooks/{notebook_id}`
*   **Method**: `DELETE`
*   **Response (`200 OK` or `204 No Content`)**:
    ```json
    {
      "status": "success",
      "message": "Notebook nb_1715495821 successfully deleted."
    }
    ```

---

### 5. List Ingested Sources
Get lists of documents currently index-analyzed within a specific notebook.

*   **URL**: `/notebooks/{notebook_id}/sources`
*   **Method**: `GET`
*   **Response (`200 OK`)**:
    ```json
    [
      {
        "id": "src_pdf_1715498312",
        "name": "Resume.pdf",
        "type": "pdf",
        "status": "ready",
        "entity_count": 15,
        "chunk_count": 5
      }
    ]
    ```

---

### 6. Load Example File (Resume)
A preset trigger to automatically copy and parse the demo `example/Resume.pdf` from backend storage into the notebook's pipeline.

*   **URL**: `/notebooks/{notebook_id}/sources/load-example`
*   **Method**: `POST`
*   **Request Body**:
    ```json
    {
      "file_path": "example/Resume.pdf"
    }
    ```
*   **Response (`200 OK`)**:
    ```json
    {
      "source_id": "src_resume_default",
      "name": "Resume.pdf",
      "type": "pdf",
      "status": "indexing",
      "pipeline_job_id": "job_1715498822"
    }
    ```

---

### 7. Upload Custom PDF / TXT
Upload a custom local document file into the pipeline for layout parsing (with MinerU/PDF parser), chunking, and relationship extraction.

*   **URL**: `/notebooks/{notebook_id}/sources/upload`
*   **Method**: `POST`
*   **Request Body**: `Multipart Form-Data`
    *   `file`: Binary File Buffer (PDF or TXT)
*   **Response (`200 OK`)**:
    ```json
    {
      "source_id": "src_custom_1715499211",
      "name": "FinancialStatement.pdf",
      "type": "pdf",
      "status": "indexing",
      "pipeline_job_id": "job_1715499212"
    }
    ```

---

### 8. Poll Pipeline Job Status
Used by the frontend to poll progression of the document indexing stages every 1.5 seconds.

*   **URL**: `/pipeline/jobs/{job_id}`
*   **Method**: `GET`
*   **Response (`200 OK`)**:
    ```json
    {
      "job_id": "job_1715499212",
      "status": "processing",
      "steps": [
        { "name": "load_file", "status": "done" },
        { "name": "pdf_parse", "status": "done" },
        { "name": "chunking", "status": "processing" },
        { "name": "entity_extraction", "status": "pending" },
        { "name": "relationship_extraction", "status": "pending" },
        { "name": "neo4j_write", "status": "pending" },
        { "name": "vector_index", "status": "pending" }
      ]
    }
    ```
    *Note: When the last step finishes, the status updates to `"ready"`. If any step fails, status becomes `"failed"`.*

---

### 9. Delete Ingested Source Document 🆕
Wipe a single source document, removing its chunk text nodes, embeddings, and relationship nodes from Neo4j/Qdrant databases.

*   **URL**: `/notebooks/{notebook_id}/sources/{source_id}`
*   **Method**: `DELETE`
*   **Response (`200 OK` or `204 No Content`)**:
    ```json
    {
      "status": "success",
      "message": "Source src_custom_1715499211 successfully deleted from notebook."
    }
    ```

---

### 10. Get Knowledge Graph
Fetch the entire notebook's network graph structure (or subset) containing active Neo4j entity nodes and relationship links to render inside the WebGL 3D Force-Directed visualizer.

*   **URL**: `/notebooks/{notebook_id}/graph`
*   **Method**: `GET`
*   **Response (`200 OK`)**:
    ```json
    {
      "nodes": [
        {
          "id": "policy_001",
          "label": "Insurance Policy",
          "type": "Document",
          "group": "document",
          "properties": {
            "source": "Policy Main",
            "summary": "Core auto policy document."
          }
        },
        {
          "id": "coverage_012",
          "label": "Comprehensive Coverage",
          "type": "Clause",
          "group": "clause"
        }
      ],
      "links": [
        {
          "id": "edge_001",
          "source": "policy_001",
          "target": "coverage_012",
          "label": "HAS_COVERAGE"
        }
      ]
    }
    ```

---

### 11. Get Node Details
Retrieve the full, deep dictionary properties of a single entity node when the user clicks it on the graph.

*   **URL**: `/notebooks/{notebook_id}/graph/node/{node_id}`
*   **Method**: `GET`
*   **Response (`200 OK`)**:
    ```json
    {
      "id": "policy_001",
      "label": "Insurance Policy",
      "type": "Document",
      "properties": {
        "source": "Policy Main",
        "summary": "Core auto policy document, active 2026.",
        "author": "DozerDB Engine",
        "last_updated": "2026-06-04"
      }
    }
    ```

---

### 12. Ask Copilot (Chat & Graph Reasoning Path)
Main conversational interface. Ingests current message and conversational chat history, performs hybrid retrieval on Neo4j/Qdrant, and returns:
1.  Answer content.
2.  Grounded document citations with vector similarity scores.
3.  Terminal log steps of retrieval reasoning.
4.  Highlighted 3D graph reasoning path coordinates.

*   **URL**: `/notebooks/{notebook_id}/chat`
*   **Method**: `POST`
*   **Request Body**:
    ```json
    {
      "message": "Does this policy cover motorcycle accidents?",
      "chat_history": [
        { "role": "user", "content": "Hello!" },
        { "role": "assistant", "content": "Hi there! How can I help you research insurance today?" },
        { "role": "user", "content": "Does this policy cover motorcycle accidents?" }
      ]
    }
    ```
*   **Response (`200 OK`)**:
    ```json
    {
      "answer": "Yes, Section 1.1 explicitly covers two-wheeled vehicles under limited conditions...",
      "citations": [
        {
          "source_id": "policy_main",
          "title": "Policy Section 1.1",
          "chunk_id": "chk_ins_012",
          "text": "The policy extends general coverage to motorcycles, provided the rider holds active licenses.",
          "score": 0.94
        }
      ],
      "retrieval_steps": [
        "Extracted keywords: ['motorcycle', 'coverage', 'accidents']",
        "Queried Vector DB Qdrant (similarity search: k=3)",
        "Traversed Neo4j paths: (Coverage)-[:INCLUDES]->(Motorcycle)",
        "Constructed context and requested LLM completion"
      ],
      "graph_path": {
        "node_ids": ["policy_001", "coverage_012", "vehicle_accident_007", "motorcycle_003"],
        "link_ids": ["edge_001", "edge_002", "edge_003"]
      }
    }
    ```

---

## 🛡 High-Fidelity Sandbox Fail-safes
If any endpoint call fails or is unreachable, the Vite frontend automatically falls back to static in-memory objects and local mocks located in `frontend/src/lib/mock-data.ts`.

Ensure that custom backend endpoints adhere to the exact JSON structures described in this contract to ensure buttery-smooth runtime synchronization when bridging from Sandbox mock-data into the live databases.
