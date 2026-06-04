---
name: insightnote-dev
description: Development guide, API architecture, database schemas, and testing workflows for the InsightNote 3-column GraphRAG workspace.
---

# InsightNote Development Skill

Use this skill when you are asked to edit, debug, extend, or maintain the **InsightNote** codebase. It provides full context on the three-column layout, API routing contracts, database mapping, and integration layers.

---

## 🏗 System Overview & Component Structure

InsightNote is structured into a 2-tier application model with three main databases:

1.  **Frontend (Vite + React + TypeScript + Tailwind)**:
    *   **Port**: `3000` (Dev server serves on `3000` via Docker or standard yarn/npm dev commands).
    *   **Core UI Layout**: A fixed 3-column dashboard:
        *   `Left (320px)`: Ingest controls (URL crawler, rich note editor, drag-n-drop PDF uploader) and document status index.
        *   `Middle (Flex-1)`: Interactive chat console featuring markdown answers, grounded citation cards, terminal logs for retrieval metrics, and quick-preset action buttons.
        *   `Right (480px)`: 3D Force-Directed WebGL Graph rendering (`react-force-graph-3d`) displaying Neo4j network relations, featuring dynamic path highlight, zoom controls, camera centering HUD, and detail drawer.
    *   **Data Broker (`frontend/src/lib/api.ts`)**: Routes requests to `http://localhost:8000/api`. If the backend is down or the workspace is empty, it **transparently falls back to high-fidelity mocks in `mock-data.ts`** to guarantee a bulletproof demo experience.

2.  **Backend (FastAPI + Pydantic + ZeRAG Core)**:
    *   **Port**: `8000` (FastAPI).
    *   **Core Router (`backend/app/api/routers/insightnote_routes.py`)**: Defines Pydantic models and endpoints for sources, chats, and graph structures.
    *   **Core RAG engine (`backend/app/core/zerag.py`)**: Interacts with MongoDB (KV & Doc statuses), Neo4j (DozerDB - Graph Database), and Qdrant (Vector DB).

---

## 🧭 Code Graph Navigation with Grapuco

This project is indexed and analyzed with **Grapuco (Code Graph)**. When exploring the codebase or starting a development run, **never guess or perform brute-force searches**. Leverage the available Grapuco MCP tools:

1.  **Initialize Project Workspace**: Run the `bootstrap` tool once at session startup using the `repositoryId` or `workspaceId` found inside `.grapuco/config.json` to properly map tools, skills, and related repositories.
2.  **Search Symbols**: Use `grapuco_search_code` to find exact classes, FastAPI routers, React components, or core database handler functions.
3.  **Inspect Symbol Context**: Call `get_symbol_context` or `get_dependencies` to map calling chains, heritage structures, and data flows before deep edits.
4.  **Verify Data Movements**: Run `get_data_flows` to trace precise endpoint logic (e.g., from frontend API calls down to Neo4j/Qdrant queries).
5.  **Assess Edit Risk**: Evaluate blast radius using `get_impact_analysis` or `blast_radius` on target files to avoid regressions across parallel modules.

---

## 🔌 API Endpoints Contract

All API communications are brokered through these standard endpoints:

| Method | Endpoint | Request Body | Response JSON | Description |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/health` | None | `{ "status": "ok", "service": "insightnote-backend" }` | Health diagnostic |
| **POST** | `/api/sources` | `{ "workspace_id": "demo", "type": "url"\|"text"\|"pdf", "value": "string" }` | `{ "source_id": "string", "name": "string", "type": "string", "status": "string" }` | Ingests URL text, custom note, or registers PDF |
| **POST** | `/api/sources/upload`| Form Data: `file: File` | Same as above | Processes actual PDF/TXT file upload via pipeline |
| **GET** | `/api/sources` | None | `List[SourceListItem]` | Retrieves lists of documents with entity & chunk metrics |
| **POST** | `/api/chat` | `{ "workspace_id": "demo", "message": "string" }` | `ChatResponse` (answer, citations, steps, graph_path) | Main chat interface. Translates keywords, queries Neo4j/Qdrant, and returns reasoning paths |
| **GET** | `/api/graph` | None | `GraphResponse` (nodes, links) | Fetches complete Neo4j database or falls back to mock graph |
| **GET** | `/api/graph/node/{id}` | None | `NodeDetailsResponse` (id, label, type, properties) | Fetches deep node properties for sliding drawer |
| **GET** | `/api/graph/node/{id}/neighbors`| None | `GraphResponse` (connected nodes/links) | Expands the graph around a clicked node |

---

## 🎨 Graph Highlight & Animation Payload

When the user queries the chatbot, the backend returns a `graph_path` indicating the traversed reasoning steps:
```json
{
  "graph_path": {
    "node_ids": ["policy_001", "coverage_012", "vehicle_accident_007", "motorcycle_003"],
    "link_ids": ["edge_001", "edge_002", "edge_003"]
  }
}
```
The **`KnowledgeGraphPanel.tsx`** listens to this state and updates:
*   **Path Node Styles**: Increases `val` from default `4` to `12`, paints node material as vibrant orange-gold (`#f59e0b`), and adds a halo glowing effect.
*   **Path Link Styles**: Animates directional glow pulses traveling down active relationships (`linkDirectionalParticles={4}`, `linkDirectionalParticleSpeed={0.01}`).
*   **Non-Path Elements**: Reduces opacity of all unrelated nodes and links to `0.15` to emphasize the reasoning trajectory.

---

## 🛠 Guidelines for Coding Tasks

When you are asked to make changes, adhere strictly to these rules:

1.  **Do Not Break Sandbox Mode**: Ensure that any changes to API models, types, or components do not crash when running on local mock-data in `frontend/src/lib/mock-data.ts`. Maintain exact compatibility.
2.  **Keep Frontend and Backend Decoupled**: Never call the database directly from the frontend; always channel queries through `/api/` routers. All API queries should reside strictly inside `frontend/src/lib/api.ts`.
3.  **Validate Build & Type safety**:
    *   To verify frontend compilation: Run `npm run build` in the `frontend` folder (using Docker or local package manager).
    *   To verify backend test coverage: **MUST activate the GPU environment `gpu_env`** (e.g., `conda activate gpu_env`) and run `pytest tests/ -v` inside the `backend` folder. Running heavy GPU calculations on standard CPU environments is discouraged.
    *   To verify backend schemas: Ensure Pydantic classes in `insightnote_routes.py` are strictly defined and correct.
4.  **No Extraneous Packages**: Reuse Lucide icons, Framer Motion, and Tailwind classes. Do not install heavy dependencies unless explicitly authorized.

---

## ⚡ Diagnostic & Execution Cheat-sheet

To run diagnostic commands, use the terminal:

*   **Launch Full Docker Stack**:
    ```bash
    docker compose up --build
    ```
*   **Run Backend Locally**:
    ```bash
    cd backend
    python server.py
    ```
*   **Run Frontend Locally**:
    ```bash
    cd frontend
    npm run dev
    ```
*   **Wipe Volume Caches**:
    ```bash
    docker compose down -v
    ```
