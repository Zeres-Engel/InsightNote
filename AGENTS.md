# 🤖 Developer Agent Guidelines (AGENTS.md)

Welcome, Coding Agent! This file outlines critical architectural constraints, code navigation guidelines, and tool usage rules for maintaining and developing **InsightNote**.

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
*   **Maintain Sandbox Fallbacks**:
    *   If database engines (Mongo, Neo4j, Qdrant) are not running or if a connection fails, the system **must never throw red error screens** or crash.
    *   `frontend/src/lib/api.ts` must automatically catch errors and transition transparently into **insurance domain sandbox mode** (defined in `frontend/src/lib/mock-data.ts`).
    *   `backend/app/api/routers/insightnote_routes.py` similarly contains full mock mockups for all routes. Keep them up-to-date if you introduce new endpoints.
*   **Do Not Break Compilation**: Always run TypeScript check and compilation tests before completing your tasks:
    *   Frontend: `cd frontend && npm run build`
    *   Backend: `cd backend && pytest tests/ -v`

---

## 📜 Tool Index Cheat-sheet

When working, choose the most direct tool:
*   To edit single files: `edit_file`
*   To read contents: `read_file`
*   To execute test suite or check server status: `terminal`
*   To discover business rules or database definitions: `semantic_search_docs`
