# InsightNote — Multi-Notebook GraphRAG Workspace

InsightNote is a **multi-notebook GraphRAG knowledge workspace** with a three-column UI: ingest sources on the left, grounded chat in the center, and a live 3D knowledge graph on the right.

It orchestrates **Neo4j** (graph), **Qdrant** (vectors), **MongoDB** (document status), and **PostgreSQL** (notebooks & chat history) under per-notebook isolation.

![InsightNote Interactive Demo](docs/images/insightnote_interactive_demo.gif)

---

## Start here

| You are… | Read first | Then |
|---|---|---|
| **New to the project** | [docs/SETUP.md](docs/SETUP.md) | Open http://localhost:3000 after `docker compose up -d --build` |
| **Backend / RAG engineer** | [backend/README.md](backend/README.md) | [backend/docs/RAG_ARCHITECTURE.md](backend/docs/RAG_ARCHITECTURE.md) · [backend/docs/QUERY.md](backend/docs/QUERY.md) |
| **Frontend / UI engineer** | [frontend/README.md](frontend/README.md) | [frontend/docs/DEVELOPMENT_GUIDE.md](frontend/docs/DEVELOPMENT_GUIDE.md) · [docs/GRAPH_VISUALIZATION.md](docs/GRAPH_VISUALIZATION.md) |
| **Integrating via API** | [frontend/docs/API_CONTRACT.md](frontend/docs/API_CONTRACT.md) | Swagger at http://localhost:8000/docs |
| **Running benchmarks** | [backend/docs/BENCHMARKING.md](backend/docs/BENCHMARKING.md) | `python scripts/benchmark/run_full_benchmark_suite.py` |
| **Contributing / AI agents** | [CONTRIBUTING.md](CONTRIBUTING.md) · [AGENTS.md](AGENTS.md) | Work on branch `develop` |

> **Configuration:** LLM, embedding, and reranker settings live in **`backend/config/config.yaml`** + root **`.env`** — not bare `docker-compose` env vars. See [docs/SETUP.md](docs/SETUP.md).

---

## Architecture

```txt
┌───────────────────────┬─────────────────────────────────┬────────────────────┐
│ Sources Panel (320px) │ Chat Q&A & Copilot (flex-1)     │ 3D Graph (480px)   │
├───────────────────────┼─────────────────────────────────┼────────────────────┤
│ URLs, notes, PDFs     │ Markdown answers, citations,    │ react-force-graph  │
│ Pipeline progress     │ retrieval steps, streaming chat │ Path highlighting  │
└───────────────────────┴─────────────────────────────────┴────────────────────┘
         │                          │                              │
         └──────────────────────────┴──────────────────────────────┘
                                    │
                         frontend/src/lib/api.ts  (sole HTTP broker)
                                    │
                         FastAPI /api/*  (insightnote_routes.py)
                                    │
              ZeRAG + MultiRAG (MinerU) ──► Mongo + Neo4j + Qdrant + Postgres
```

**Primary API surface:** notebook-scoped routes under `/api/notebooks/{id}/…`. Legacy flat routes (`/api/sources`, `/api/chat`, `/api/graph`) still exist for compatibility.

---

## Key features

- **Multi-notebook isolation** — separate Qdrant collections, Neo4j workspace labels, and Postgres chat sessions per notebook
- **Layout-aware ingestion** — MinerU parses PDFs with bounding-box coordinates for grounded citations
- **Hybrid GraphRAG retrieval** — five query modes from vector-only (`naive`) to full hybrid (`mix`, default)
- **Streaming chat** — metadata (citations, graph path) first, then token stream
- **3D graph highlights** — cyan for query reasoning paths, emerald for newly ingested nodes (one-shot)
- **Sandbox fallback** — frontend auto-falls back to mock data when backend or DB is unreachable

---

## Screenshots

| Dashboard | Workspace |
|---|---|
| ![Dashboard](docs/images/dashboard_main_view.png) | ![Workspace](docs/images/workspace_main_view.png) |

---

## Quick start

Full setup: **[docs/SETUP.md](docs/SETUP.md)**

```bash
cp .env.example .env          # fill in API keys for your LLM profile
# Edit backend/config/config.yaml to match your provider (OpenAI / Gemini)
docker compose up -d --build  # full stack
```

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Backend Swagger | http://localhost:8000/docs |
| Health | http://localhost:8000/api/health |

**Local dev (hybrid — recommended for backend work):**

```bash
docker compose up -d postgres mongodb neo4j qdrant
conda activate gpu_env && cd backend && python server.py   # terminal 1
cd frontend && npm install && npm run dev                # terminal 2
```

Windows shortcut: `scripts/run-dev.bat`

---

## Query modes (API `mode` field)

| Mode | Retrieval | Speed |
|---|---|---|
| `naive` | Qdrant vectors only | Fastest |
| `local` | Entity / Neo4j nodes | Medium |
| `global` | Relationship / Neo4j edges | Medium |
| `hybrid` | Entity + relationship | Slower |
| `mix` | Entity + relationship + vector (**default**) | Slowest |

Details: [backend/docs/QUERY.md](backend/docs/QUERY.md) · Benchmarks: [backend/docs/BENCHMARKING.md](backend/docs/BENCHMARKING.md)

---

## Documentation map

### Getting started

| Document | Description |
|---|---|
| **[docs/SETUP.md](docs/SETUP.md)** | Environment, LLM profiles, quick start |
| **[docs/DOCKER.md](docs/DOCKER.md)** | Docker Compose workflows |
| **[docs/CONFIG_REFERENCE.md](docs/CONFIG_REFERENCE.md)** | All `config.yaml` & `.env` keys |
| **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** | Common issues & fixes |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | Branch workflow & pre-push checklist |

### Architecture & data

| Document | Description |
|---|---|
| **[docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)** | Postgres, Mongo, Neo4j, Qdrant schemas |
| **[docs/DEMO_DATA.md](docs/DEMO_DATA.md)** | Sandbox mode, mock data, example sources |
| **[backend/docs/RAG_ARCHITECTURE.md](backend/docs/RAG_ARCHITECTURE.md)** | Multi-workspace RAG engine |
| **[backend/docs/QUERY.md](backend/docs/QUERY.md)** | Query modes & chat history |
| **[backend/docs/BENCHMARKING.md](backend/docs/BENCHMARKING.md)** | Latency, quality, MinerU ingest, Locust |
| **[backend/docs/MULTIMODAL_PARSING.md](backend/docs/MULTIMODAL_PARSING.md)** | MinerU parsing pipeline |
| **[backend/docs/CHUNKING.md](backend/docs/CHUNKING.md)** | Bbox chunking & Neo4j tree |

### Frontend & API

| Document | Description |
|---|---|
| **[frontend/docs/API_CONTRACT.md](frontend/docs/API_CONTRACT.md)** | Full REST API reference |
| **[frontend/docs/DEVELOPMENT_GUIDE.md](frontend/docs/DEVELOPMENT_GUIDE.md)** | Components, streaming, WebGL |
| **[frontend/README.md](frontend/README.md)** | Frontend quick start |
| **[backend/README.md](backend/README.md)** | Backend structure & testing |

### UI behavior

| Document | Description |
|---|---|
| **[docs/GROUNDED_CITATIONS.md](docs/GROUNDED_CITATIONS.md)** | Citation grounding & streaming |
| **[docs/GRAPH_VISUALIZATION.md](docs/GRAPH_VISUALIZATION.md)** | WebGL graph rendering & focus rules |
| **[AGENTS.md](AGENTS.md)** | AI agent coding rules |

---

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | Vite + React + TypeScript + Tailwind + `react-force-graph-3d` |
| Backend | FastAPI + ZeRAG + MultiRAG (MinerU) |
| Databases | MongoDB, Neo4j (DozerDB), Qdrant, PostgreSQL |

---

## Validation before push

```bash
cd frontend && npm run build
conda activate gpu_env && cd backend && pytest tests/ -v
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full git workflow (`develop` → `release` → `main`).

---

## Development branches

| Branch | Purpose |
|---|---|
| `develop` | Active development |
| `release` | Staging / pre-release |
| `main` | Production releases |
