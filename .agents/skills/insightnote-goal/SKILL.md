---
name: insightnote-goal
description: Continuous overnight run strategy, acceptance tests, fallbacks, and validation guides to achieve the final multi-notebook GraphRAG NotebookLM-style workspace goal.
---

# InsightNote Overnight Goal & E2E Validation

Use this skill when running continuous development, testing, and deployment loops to achieve the final NotebookLM-style GraphRAG workspace product.

---

## 🎯 Product Goal & Architecture

The goal is a fully functional multi-notebook GraphRAG knowledge workspace consisting of a 3-column layout:
1.  **Left Column (Sources)**: Manage, ingest, and upload URLs, rich notes, and PDFs (such as `example/Resume.pdf`). Show progressive pipeline tracking phases:
    *   `load_file`
    *   `mineru_parse` (layout OCR parsing)
    *   `chunking`
    *   `entity_extraction`
    *   `relationship_extraction`
    *   `neo4j_write`
    *   `vector_index`
2.  **Middle Column (Copilot Q&A)**: Interactive chat over the active notebook. Must return precise, grounded answers with:
    *   Citations pointing to exact source document pages and text chunks.
    *   Collapsible retrieval steps showing what keywords were extracted and what paths were traversed.
    *   Graph reasoning path highlights (nodes & link IDs).
3.  **Right Column (WebGL 3D Graph)**: Physics-directed 3D network visualizer (`react-force-graph-3d`) that emphasizes traversed reasoning paths in orange-gold, dims unselected nodes, and opens properties in a sliding drawer on click.

---

## 🔌 API & Integration Contract

Ensure the backend exposes and the frontend consumes the following notebook-isolated endpoints under `/api/...`:

*   `GET /api/notebooks` — List notebooks
*   `POST /api/notebooks` — Create notebook
*   `GET /api/notebooks/{notebook_id}` — Get notebook details
*   `POST /api/notebooks/{notebook_id}/sources/load-example` — Load `example/Resume.pdf` into notebook
*   `POST /api/notebooks/{notebook_id}/sources/upload` — Upload PDF/text files
*   `GET /api/pipeline/jobs/{job_id}` — Poll progressive pipeline phases
*   `GET /api/notebooks/{notebook_id}/sources` — List ingested sources
*   `GET /api/notebooks/{notebook_id}/graph` — Get Neo4j active graph nodes and relationships
*   `GET /api/notebooks/{notebook_id}/graph/node/{node_id}` — Get deep properties and citations for a node
*   `POST /api/notebooks/{notebook_id}/chat` — Chat query with citation list and highlighted reasoning paths

---

## 🛠 Testing & Validation Workflow

Continuously run these validation scripts to ensure zero regression:

### 1. Verification of Backend Compilation & Tests
Always run these within the GPU-supported conda environment (`gpu_env`):
```bash
# Verify unit tests are green
pytest backend/tests/unit/test_insightnote_routes.py -v
```

### 2. Launching Services
*   **Database Stack**:
    ```bash
    docker compose up -d mongodb neo4j qdrant mongo-express
    ```
*   **FastAPI Backend**: Run locally in `gpu_env`:
    ```bash
    cd backend
    python server.py
    ```
*   **Next.js Frontend**: Run via Docker:
    ```bash
    docker compose build frontend
    docker compose up -d frontend
    ```

### 3. E2E Pipeline Verification
Before pushing changes or submitting a PR, always execute the full pipeline storage verification:
```bash
C:/Users/nguye/anaconda3/envs/gpu_env/python.exe scripts/verify_backend_pipeline.py
```

---

## 🌿 Git Flow Branching & Tagging Policy

*   All active work, feature upgrades, and debugging must occur strictly on the `develop` branch.
*   The `release` branch is reserved for pre-release validation and staging.
*   Stable compiled production code resides on `main`.
*   Creating/tagging releases (such as `1.0.0` tags) must **only** be performed when explicitly requested by the Master Architect (User).

---

## 🛡 High-Fidelity Fallback Policy (Sandbox Mode)

If any backend database (MongoDB, Neo4j, Qdrant) is offline or fails to connect, **never throw error screens**.
*   The backend router `insightnote_routes.py` must catch connection failures, log warnings, and fall back to in-memory mocks for the requested notebook (`MOCK_NODES_RESUME`, `PRESET_QA_RESUME` or `MOCK_NODES_INSURANCE`, `PRESET_QA_INSURANCE`).
*   The frontend broker `api.ts` must catch fetch failures and transition transparently into local mock storage (defined in `mock-data.ts`) to guarantee a bulletproof, crash-free presentation.
