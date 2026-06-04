# 🤖 Developer Agent Guidelines (AGENTS.md)

## 👑 Project Ownership & Authority Rule
*   **The Master Architect**: The User is the **sole creator, lead developer, and absolute best architect** of the InsightNote workspace. This is their dedicated solo project.
*   **Agent's Mission**: The AI agent operates strictly as an elite co-pilot. Your primary goal is to support the Master Architect in exploring, refining, upgrading, and implementing high-value features according to their exact vision. Never alter or degrade code without thorough justification.

---

## 🧭 Code Graph Navigation with Grapuco MCP

This project is indexed with **Grapuco (Code Graph)**. When exploring or refactoring, **do not guess or perform brute-force greps**. You are expected to leverage the available **Grapuco MCP Tools** for maximum surgical precision:

*   **To explore symbols or service methods**: Use `grapuco_search_code` to find exact classes or functions.
*   **To analyze caller-callee chains**: Call `get_symbol_context` or `get_dependencies` before making deep edits.
*   **To check data flows (API ➔ Service ➔ DB)**: Run `get_data_flows` to see how endpoints route data through the RAG engine.
*   **To evaluate risk / affected parts on changes**: Run `get_impact_analysis` or `blast_radius` on the target files to avoid breaking parallel modules.

---

## 🏗 Architectural Blueprint

InsightNote consists of three parallel, loosely coupled pillars that form a unified workspace:

```txt
┌───────────────────────┬─────────────────────────────────┬────────────────────┐
│ Sources Panel (320px) │ Chat Q&A & Copilot (Flex-1)      │ 3D WebGL Graph (480px)
├───────────────────────┼─────────────────────────────────┼────────────────────┤
│ Ingest URLs, Notes,  │ Markdowns, citations cards,     │ react-force-graph  │
│ and drag-n-drop PDFs  │ collapsible retrieval steps,    │ animated glowing   │
│ with status badges.   │ and 5 preset demo action pills. │ paths & inspector. │
└───────────────────────┴─────────────────────────────────┴────────────────────┘
```

*   **Pillar 1: Sources Ingestion**: Managed by the FastAPI backend `/api/sources` routing to the real `pipeline_index_texts` or MultiRAG's `pipeline_enqueue_file`.
*   **Pillar 2: Guided Reasoning Chat**: Managed by `/api/chat`. Returns answer content + source chunks + graph path trace node names.
*   **Pillar 3: WebGL Graph Visualizer**: Managed by `/api/graph`. Renders a beautiful 3D physics-directed graph. Uses active state highlight on node list from chat path, and displays attributes inside a custom properties sliding drawer.

---

## 💡 Implementation Guidelines & Constraints

*   **Strict Decoupling**: All frontend-to-backend communication must happen exclusively via standard asynchronous HTTP calls inside `frontend/src/lib/api.ts`.
*   **GPU Environment for Backend Tests (`gpu_env`)**: Due to GPU-intensive requirements (such as PDF layout parsing with MinerU and entity/vector generation), developers and agents **MUST use the `gpu_env` environment** (e.g., `conda activate gpu_env`) to run all backend test suites and pipeline indexing tests. Running GPU-heavy tasks on CPU-only environments is discouraged due to performance constraints.
*   **Docker for Frontend (FE)**: The frontend (FE) should be developed, tested, and deployed using Docker as usual (e.g., via the automated `task docker:up` or running isolated container flows).
*   **Maintain Sandbox Fallbacks**:
    *   If database engines (Mongo, Neo4j, Qdrant) are not running or if a connection fails, the system **must never throw red error screens** or crash.
    *   `frontend/src/lib/api.ts` must automatically catch errors and transition transparently into **insurance domain sandbox mode** (defined in `frontend/src/lib/mock-data.ts`).
    *   `backend/app/api/routers/insightnote_routes.py` similarly contains full mock mockups for all routes. Keep them up-to-date if you introduce new endpoints.
*   **Do Not Break Compilation**: Always run TypeScript check and compilation tests before completing your tasks:
    *   Frontend: `cd frontend && npm run build`
    *   Backend (inside `gpu_env`): `cd backend && pytest tests/ -v`
*   **Strict Version Control & Tagging**: AI agents are **strict co-pilots** and are **NEVER** allowed to create, tag, or push new versions (such as git tags) on their own. Tagging and publishing version releases must be performed **ONLY** when explicitly requested and ordered by the Master Architect (User).

---

## 📜 Tool Index Cheat-sheet

When working, choose the most direct tool:
*   To edit single files: `edit_file`
*   To read contents: `read_file`
*   To execute test suite or check server status: `terminal`
*   To discover business rules or database definitions: `semantic_search_docs`
