# Docker Guide

Running InsightNote with Docker Compose — services, networking, volumes, and common workflows.

**Related:** [SETUP.md](SETUP.md) · [CONFIG_REFERENCE.md](CONFIG_REFERENCE.md)

---

## Services overview

```txt
docker-compose.yml
├── frontend          :3000   Vite dev server
├── backend           :8000   FastAPI + ZeRAG
├── mongodb           :27017
├── mongo-express     :8081   Mongo admin UI
├── neo4j             :7474 / :7687
├── qdrant            :6333 / :6334
├── postgres          :5432
└── adminer           :8082   Postgres admin UI
```

All services share network `net`.

---

## Quick commands

```bash
# Start full stack (build + background)
docker compose up -d --build

# Start databases only (local backend dev)
docker compose up -d postgres mongodb neo4j qdrant mongo-express adminer

# Follow logs
docker compose logs -f backend

# Stop
docker compose down

# Stop + wipe ALL database volumes
docker compose down -v
```

Taskfile shortcuts (from project root):

```bash
task docker:up
task docker:down
task docker:clean    # down -v
task docker:logs
```

---

## Environment variables

Docker Compose reads `.env` at the **project root** for variable substitution.

### Passed to backend container (effective)

| Variable | Set in compose | Used by |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection via config.yaml interpolation |
| `MONGO_DATABASE` | Yes | Mongo database name |
| `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD` | Yes | Neo4j connection |
| `QDRANT_URL` | Yes | Qdrant connection |
| `POSTGRES_URI` | Yes | `chat_history.py` directly |
| `OPENAI_API_KEY` | Yes | YAML `${OPENAI_API_KEY}` |
| `ZERAG_API_KEY` | Yes | API auth (`server.py`) |
| `GOOGLE_API_KEY` | **Not by default** | Required if config.yaml uses Gemini — add manually |

### Set in compose but NOT auto-applied to LLM config

These env vars exist in `docker-compose.yml` but **`config.py` does not read them directly**. They only work if referenced inside `backend/config/config.yaml`:

| Variable | Default in compose |
|---|---|
| `LLM_BINDING` | `openai` |
| `LLM_MODEL` | `qwen-plus` |
| `LLM_BASE_URL` | `https://v98store.com/v1` |
| `EMBEDDING_BINDING` | `openai` |
| `EMBEDDING_MODEL` | `text-embedding-3-small` |
| `EMBEDDING_BASE_URL` | `https://v98store.com/v1` |

> **Fix:** Edit `config.yaml` to match your intended profile, or add `${LLM_BINDING}` style references in YAML. See [SETUP.md](SETUP.md).

### Frontend container

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Backend URL (`http://localhost:8000`) |
| `VITE_API_BASE_URL` | Same (legacy alias) |

The browser calls `localhost:8000` from the host machine, not the Docker internal hostname.

---

## Volumes

| Docker volume | Service | Data |
|---|---|---|
| `mongo_data` | mongodb | Document status, KV collections |
| `neo4j_data` | neo4j | Knowledge graph |
| `qdrant_data` | qdrant | Vector embeddings |
| `postgres_data` | postgres | Notebooks, chat, jobs |

Bind mounts:

| Host path | Container | Purpose |
|---|---|---|
| `./frontend` | `/app` | Hot-reload frontend source |
| `./backend` | `/app` | Hot-reload backend source |
| `./backend/rag_storage` | `/app/rag_storage` | Ingested files & parser output |

---

## Two common workflows

### A — Full Docker (simplest)

Everything in containers. Good for demos and integration testing.

```bash
cp .env.example .env
# Edit config.yaml for your LLM profile
docker compose up -d --build
```

Open http://localhost:3000

### B — Hybrid (recommended for backend dev)

Databases in Docker, backend + frontend on host with `gpu_env`.

```bash
# Windows
scripts/run-dev.bat

# Manual
docker compose up -d postgres mongodb neo4j qdrant
conda activate gpu_env && cd backend && python server.py
cd frontend && npm run dev
```

Hybrid mode gives direct access to GPU for MinerU and faster pytest iteration.

---

## Admin UIs

| Tool | URL | Credentials |
|---|---|---|
| Swagger API docs | http://localhost:8000/docs | — |
| Mongo Express | http://localhost:8081 | admin / pass |
| Neo4j Browser | http://localhost:7474 | neo4j / password |
| Adminer (Postgres) | http://localhost:8082 | postgres / password / DB: insightnote |

---

## Building images individually

```bash
task docker:build-backend
task docker:build-frontend
```

Or:

```bash
docker build -t insightnote-backend:latest ./backend
docker build -t insightnote-frontend:latest ./frontend
```

---

## Health checks

```bash
curl http://localhost:8000/api/health
curl http://localhost:6333/collections    # Qdrant
docker compose ps                          # all services running
```

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed fixes.

| Issue | Quick check |
|---|---|
| Backend can't reach DB | `docker compose ps` — are all DB containers healthy? |
| LLM errors in Docker | Is `config.yaml` profile aligned with keys in `.env`? |
| Frontend shows sandbox | Backend down — check `curl localhost:8000/api/health` |
| Port conflict | Change ports in `docker-compose.yml` |
| Stale data after tests | `docker compose down -v` + delete `backend/rag_storage/` |

---

## Production notes

The current `docker-compose.yml` is optimized for **development** (hot reload, exposed DB ports, default passwords). For production:

- Change all default passwords
- Do not expose database ports publicly
- Use secrets management instead of plain `.env`
- Build frontend with `npm run build` and serve static assets via nginx
- Run backend with gunicorn (`backend/app/api/run_with_gunicorn.py`)
