# 🤖 Developer Agent Guidelines (AGENTS.md)

## 👑 Project Ownership & Authority Rule
*   **The Master Architect**: The User is the **sole creator, lead developer, and absolute best architect** of the InsightNote workspace. This is their dedicated solo project.
*   **Agent's Mission**: The AI agent operates strictly as an elite co-pilot. Your primary goal is to support the Master Architect in exploring, refining, upgrading, and implementing high-value features according to their exact vision. Never alter or degrade code without thorough justification.
*   **Multi-Agent Parallel Development & Coordination**: 
    *   The Master Architect frequently deploys **multiple AI agents in parallel** to build or optimize different parts of the system simultaneously. Tasks may overlap or run concurrently on the same workspace.
    *   *Conflict Resolution*: Before making deep edits, always inspect active files for concurrent changes. If you encounter differences in logic or style, refer to and respect the design patterns established by the **specialized agent (Agent chuyên trách)** assigned to that specific domain (e.g., core RAG logic vs. UI WebGL rendering).
    *   *Surgical Merging*: Reconcile overlapping code carefully. Never blindly overwrite or revert working features implemented by another agent. Always merge gracefully and run full compilation checks (`npm run build` / `pytest`) to guarantee complete integration success.

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
*   **Do Not Expose Raw Database Identifiers**: Avoid exposing raw database document IDs (such as `doc-xxx` or `chunk-xxx`) in user-facing UI panels, citation cards, status badges, progress log messages, or console outputs. All progress statements or RAG references should use clean, user-friendly labels (e.g., file names or note titles) to preserve a premium visual aesthetic and prevent information leaks.
    *   *Security Enforcement*: Strip out `source_id`, `doc_id`, `chunk_id`, and `track_id` from the properties of nodes, links, and API responses. Replace absolute local system paths with clean base filenames (using `os.path.basename`) to prevent local directory structure exposure.
*   **Strict UI Effects & Streaming Safety Rules**:
    *   Never render raw internal identifiers (`doc-*`, `chunk-*`, `job_*`, `track-*`, `source_id`, `doc_id`, `chunk_id`, `track_id`), raw local paths, database names, or provider credentials in progress cards, citations, graph tooltips, chat bubbles, or browser logs.
    *   Progress copy must be sanitized and user-facing. Prefer concise stage labels such as `Reading layout`, `Extracting semantic chunks`, `Mapping relationships`, and `Finalizing graph sync`; avoid raw log prefixes, colon-heavy backend labels, or implementation terms.
    *   Graph ingest focus is a one-shot terminal event: only after a document becomes `ready`, highlight only nodes/relationships newly added by that document in emerald green. Do not refocus repeatedly while ingestion is still processing.
    *   Graph query/chat focus uses cyan/blue only for the active reasoning nodes and relationships; unrelated graph elements must dim. Reset View must clear all active highlights and restore normal graph styling.
    *   Grounded citations must show only documents explicitly cited by bracket references or named in the final answer/LLM metadata. Never show every retrieved chunk as a citation card.
*   **Strict WebGL Graph Focus & Unfocus Style Recycling**: 
    *   When the active reasoning path (highlightPath) or ingestion highlight changes, any previously highlighted node or relationship must be completely **unfocused** and reset to its default, dimmed, or normal states.
    *   *Implementation requirement*: Since WebGL Force-Graph-3D caches rendering lines/objects for performance, developers must explicitly call `fgRef.current.refresh()` inside a `useEffect` hooked to highlight states. This ensures that old relationships immediately lose their active colors, widths, and glowing directional particles.
*   **Premium Conversational Chat UI Mechanics**:
    *   *Bouncing Dots Pending State*: The chat's loading state must never render blocky full-page mock paragraph skeletons. It must display a compact assistant-styled welcome bubble containing 3 bouncing pulsing dots (`animate-bounce` with staggered animation delays) aligned to the left.
    *   *In-Bubble Streaming Cursor*: During active assistant text streaming (`isStreaming` set to `true`), a sleek, pulsing cursor block (`Cursor` component styled as an inline-block pulsing indigo bar) must be appended precisely to the last line of the rendered text inside the `MarkdownRenderer`. The cursor must disappear immediately when the stream transitions to finished.
*   **Do Not Break Compilation**: Always run TypeScript check and compilation tests before completing your tasks:
    *   Frontend: `cd frontend && npm run build`
    *   Backend (inside `gpu_env`): `cd backend && pytest tests/ -v`
*   **Strict Version Control & Tagging**: AI agents are **strict co-pilots** and are **NEVER** allowed to create, tag, or push new versions (such as git tags) on their own. Tagging and publishing version releases must be performed **ONLY** when explicitly requested and ordered by the Master Architect (User).

---

## 🌿 Git Flow & Branch Management Rules

*   **Active Development Branch (`develop`)**: All active development, feature building, and debugging must occur **strictly** on the `develop` branch.
*   **Release & Staging Branch (`release`)**: The `release` branch is dedicated strictly to staging, environment testing, and preparing stable releases before merging to `main`.
*   **Production Branch (`main`)**: The `main` branch contains strictly compiled, tested, and fully stable production releases. Merges to `main` must occur only via `develop -> release -> main` workflow.
*   **Thorough Testing Before Push/PR**: No code is to be pushed or integrated unless it has undergone thorough local validation:
    1.  Frontend build is validated successfully: `cd frontend && npm run build`
    2.  All backend tests pass cleanly in `gpu_env`: `cd backend && pytest tests/ -v`
    3.  RAG E2E pipeline verification scripts run PASS: `C:/Users/nguye/anaconda3/envs/gpu_env/python.exe scripts/verify_backend_pipeline.py`

---

## 📜 Tool Index Cheat-sheet

When working, choose the most direct tool:
*   To edit single files: `edit_file`
*   To read contents: `read_file`
*   To execute test suite or check server status: `terminal`
*   To discover business rules or database definitions: `semantic_search_docs`
