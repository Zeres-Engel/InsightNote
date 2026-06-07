---
name: insightnote-dev
description: Development guide, API architecture, database schemas, and testing workflows for the InsightNote 3-column GraphRAG workspace.
---

# InsightNote Development Skill

Use when editing, debugging, or extending the InsightNote codebase.

**Setup guide (single source of truth):** [docs/SETUP.md](../../docs/SETUP.md)

---

## System overview

| Layer | Stack | Port |
|---|---|---|
| Frontend | Vite + React + TypeScript + Tailwind | 3000 |
| Backend | FastAPI + ZeRAG + MultiRAG (MinerU) | 8000 |
| Databases | MongoDB, Neo4j (DozerDB), Qdrant, PostgreSQL | see SETUP.md |

### Three-column layout

- **Left (320px):** `SourcesPanel.tsx` — ingest URL/note/PDF, pipeline badges
- **Middle (flex-1):** `ChatPanel.tsx` — streaming chat, citations, retrieval steps
- **Right (480px):** `KnowledgeGraphPanel.tsx` — 3D WebGL graph, path highlights

All HTTP calls go through **`frontend/src/lib/api.ts`**. Never call DBs from the frontend.

---

## Configuration

LLM/embedding/reranker settings come from **`backend/config/config.yaml`** (not bare docker-compose env vars).

`.env` at project root provides API keys referenced in YAML via `${VAR_NAME}`.

See [docs/SETUP.md](../../docs/SETUP.md) for OpenAI and Gemini profiles.

---

## API endpoints (primary)

Router: `backend/app/api/routers/insightnote_routes.py`, prefix `/api`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET/POST | `/api/notebooks` | List / create notebooks |
| GET/DELETE | `/api/notebooks/{id}` | Get / delete notebook |
| GET | `/api/notebooks/{id}/sources` | List sources |
| POST | `/api/notebooks/{id}/sources/upload` | Upload file |
| POST | `/api/notebooks/{id}/sources/url/stream` | Ingest URL (streaming) |
| POST | `/api/notebooks/{id}/sources/note/stream` | Ingest note (streaming) |
| POST | `/api/notebooks/{id}/sources/load-example` | Load example PDF (`path` field) |
| DELETE | `/api/notebooks/{id}/sources/{source_id}` | Delete source |
| GET | `/api/pipeline/jobs/{job_id}` | Pipeline progress |
| GET | `/api/notebooks/{id}/graph` | Full graph |
| GET | `/api/notebooks/{id}/graph/node/{node_id}` | Node details |
| GET | `/api/notebooks/{id}/graph/node/{node_id}/neighbors` | Neighbors |
| GET | `/api/notebooks/{id}/chat/history` | Chat history (Postgres) |
| POST | `/api/notebooks/{id}/chat` | Chat (supports `stream: true`) |

Legacy flat endpoints still exist: `/api/sources`, `/api/chat`, `/api/graph`.

Full contract: [frontend/docs/API_CONTRACT.md](../../frontend/docs/API_CONTRACT.md)

---

## Pipeline steps

| Source type | Steps |
|---|---|
| PDF / file | `load_file` → `document_understanding` → `vector_graph_sync` |
| URL / note | `load_file` → `chunking` → `entity_extraction` → `vector_graph_sync` |

---

## Graph highlight rules

| Mode | Color | When |
|---|---|---|
| `query` | Cyan `#38bdf8` | Chat reasoning path |
| `ingest` | Emerald `#10b981` | Document reaches `ready` (one-shot) |

Call `fgRef.current.refresh()` when `highlightPath` changes (WebGL cache).

See [docs/GRAPH_VISUALIZATION.md](../../docs/GRAPH_VISUALIZATION.md)

---

## Query modes

Default: `mix`. Also supported: `hybrid`, `local`, `global`, `naive`, `bypass`.

See [backend/docs/QUERY.md](../../backend/docs/QUERY.md)

---

## Coding rules

1. **Sandbox mode** — never crash when DB is down; keep `mock-data.ts` compatible
2. **Decoupling** — all API calls in `api.ts` only
3. **No raw IDs in UI** — strip `doc-`, `chunk-`, `job_`, paths from user-facing output
4. **Citations** — only show documents explicitly cited in the answer
5. **Build checks before done:**
   - `cd frontend && npm run build`
   - `conda activate gpu_env && cd backend && pytest tests/ -v`
6. **Git** — develop on `develop` branch; never tag releases without user request

Full agent rules: [AGENTS.md](../../AGENTS.md)

---

## Run commands

```bash
# Full Docker stack
docker compose up -d --build

# Local dev (Windows)
scripts/run-dev.bat

# Backend only
conda activate gpu_env && cd backend && python server.py

# Frontend only
cd frontend && npm run dev

# Tests
task test:all
```

---

## Documentation map

| Doc | Topic |
|---|---|
| [docs/SETUP.md](../../docs/SETUP.md) | Configuration |
| [docs/DOCKER.md](../../docs/DOCKER.md) | Docker workflows |
| [docs/CONFIG_REFERENCE.md](../../docs/CONFIG_REFERENCE.md) | All config keys |
| [docs/DATABASE_SCHEMA.md](../../docs/DATABASE_SCHEMA.md) | DB schemas |
| [docs/TROUBLESHOOTING.md](../../docs/TROUBLESHOOTING.md) | Common issues |
| [docs/DEMO_DATA.md](../../docs/DEMO_DATA.md) | Sandbox & mock data |
| [CONTRIBUTING.md](../../CONTRIBUTING.md) | Dev workflow |
| [frontend/docs/API_CONTRACT.md](../../frontend/docs/API_CONTRACT.md) | REST API |
| [frontend/docs/DEVELOPMENT_GUIDE.md](../../frontend/docs/DEVELOPMENT_GUIDE.md) | Frontend architecture |
| [backend/docs/RAG_ARCHITECTURE.md](../../backend/docs/RAG_ARCHITECTURE.md) | RAG engine |
| [backend/docs/QUERY.md](../../backend/docs/QUERY.md) | Query modes |
| [docs/GROUNDED_CITATIONS.md](../../docs/GROUNDED_CITATIONS.md) | Citations & streaming |
| [docs/GRAPH_VISUALIZATION.md](../../docs/GRAPH_VISUALIZATION.md) | WebGL graph |

---

## Grapuco MCP

Use Grapuco tools for code navigation instead of brute-force greps:
- `grapuco_search_code` — find symbols
- `get_symbol_context` / `get_dependencies` — caller chains
- `get_data_flows` — endpoint → DB flows
- `get_impact_analysis` — blast radius before edits

Bootstrap with `repositoryId` from `.grapuco/config.json`.
