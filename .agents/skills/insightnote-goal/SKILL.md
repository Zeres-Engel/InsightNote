---
name: insightnote-goal
description: Product goal, acceptance criteria, API contract, and validation workflow for the multi-notebook GraphRAG workspace.
---

# InsightNote Product Goal & Validation

Use when validating features, running E2E checks, or guiding development toward the NotebookLM-style GraphRAG workspace.

**Configuration:** [docs/SETUP.md](../../docs/SETUP.md)

---

## Product goal

A multi-notebook GraphRAG workspace with three columns:

### 1. Sources (left)

- Ingest URLs, text notes, PDFs (drag-and-drop)
- Show pipeline progress with user-friendly stage labels
- Delete sources via trash button
- Switch between isolated notebooks

**Pipeline steps (actual API names):**

| Source | Steps |
|---|---|
| PDF / file | `load_file` → `document_understanding` → `vector_graph_sync` |
| URL / note | `load_file` → `chunking` → `entity_extraction` → `vector_graph_sync` |

### 2. Chat (middle)

- Streaming markdown answers with inline cursor during generation
- Grounded citation cards (only explicitly cited sources)
- Collapsible retrieval steps (sanitized, no internal IDs)
- Chat history persisted in PostgreSQL (+ localStorage offline cache)
- 3-dot bouncing pending indicator (no skeleton paragraphs)

### 3. Graph (right)

- Interactive 3D force-directed graph (`react-force-graph-3d`)
- **Cyan** highlight for query reasoning paths
- **Emerald** highlight for newly ingested nodes (one-shot on `ready`)
- Dim non-path nodes during active highlight
- Properties drawer on node click
- Reset View clears all highlights
- `fgRef.current.refresh()` on highlight state change

---

## API contract (notebook-scoped)

All under `/api/` — full schemas in [frontend/docs/API_CONTRACT.md](../../frontend/docs/API_CONTRACT.md)

| Endpoint | Purpose |
|---|---|
| `GET /api/notebooks` | List notebooks |
| `POST /api/notebooks` | Create notebook |
| `GET /api/notebooks/{id}` | Get notebook |
| `DELETE /api/notebooks/{id}` | Delete notebook + cascade DB cleanup |
| `GET /api/notebooks/{id}/sources` | List sources |
| `POST /api/notebooks/{id}/sources/upload` | Upload file |
| `POST /api/notebooks/{id}/sources/url/stream` | Ingest URL |
| `POST /api/notebooks/{id}/sources/note/stream` | Ingest note |
| `POST /api/notebooks/{id}/sources/load-example` | Load example PDF (`path` field) |
| `DELETE /api/notebooks/{id}/sources/{source_id}` | Delete source |
| `GET /api/pipeline/jobs/{job_id}` | Poll pipeline |
| `GET /api/notebooks/{id}/graph` | Full graph |
| `GET /api/notebooks/{id}/graph/node/{node_id}` | Node details |
| `GET /api/notebooks/{id}/graph/node/{node_id}/neighbors` | Expand neighbors |
| `GET /api/notebooks/{id}/chat/history` | Load chat history |
| `POST /api/notebooks/{id}/chat` | Chat (`stream: true` for SSE) |

---

## Validation workflow

Always use **`gpu_env`** for backend tests.

### 1. Backend unit tests

```bash
conda activate gpu_env
cd backend
pytest tests/unit/test_insightnote_routes.py -v
```

### 2. Full test suite

```bash
conda activate gpu_env
cd backend
pytest tests/ -v
```

Or: `task test:all`

### 3. Frontend build

```bash
cd frontend && npm run build
```

### 4. Launch services

```bash
# Databases
docker compose up -d postgres mongodb neo4j qdrant

# Backend (local)
conda activate gpu_env && cd backend && python server.py

# Frontend (Vite — not Next.js)
cd frontend && npm run dev
```

Or use `scripts/run-dev.bat` on Windows.

### 5. Manual smoke test

1. Open http://localhost:3000
2. Create or select a notebook
3. Upload a PDF → watch pipeline progress → source reaches `ready`
4. Ask a question → verify citations, retrieval steps, cyan graph path
5. Click Reset View → highlights clear
6. Stop backend → frontend falls back to sandbox without red error screen

---

## Sandbox fallback policy

If MongoDB, Neo4j, Qdrant, or PostgreSQL is offline:

- Backend logs warnings, continues in degraded mode
- Frontend `api.ts` catches fetch errors → `mock-data.ts`
- **Never** show red error screens or raw database IDs

---

## Git flow

| Branch | Purpose |
|---|---|
| `develop` | Active development |
| `release` | Staging |
| `main` | Production |

Never create git tags without explicit user request.

---

## Known gaps

| Item | Status |
|---|---|
| `example/Resume.pdf` | Not bundled — place at `backend/example/Resume.pdf` or upload manually |
| `scripts/verify_backend_pipeline.py` | Not in repo — use `pytest tests/ -v` instead |
