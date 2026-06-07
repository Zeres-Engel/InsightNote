# InsightNote — Setup & Configuration Guide

This is the **single source of truth** for running and configuring InsightNote locally or via Docker. All other docs link here for environment setup.

**See also:** [DOCKER.md](DOCKER.md) · [CONFIG_REFERENCE.md](CONFIG_REFERENCE.md) · [TROUBLESHOOTING.md](TROUBLESHOOTING.md) · [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) · [DEMO_DATA.md](DEMO_DATA.md) · [CONTRIBUTING.md](../CONTRIBUTING.md)

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Docker Desktop** | MongoDB, Neo4j (DozerDB), Qdrant, PostgreSQL |
| **Node.js 18+** | Frontend (`frontend/`) |
| **Conda `gpu_env`** | Backend tests and GPU-heavy pipeline (MinerU, embeddings) |
| **API keys** | Depends on LLM profile — see below |

---

## Quick Start (Docker — full stack)

### 1. Create `.env` at project root

```bash
cp .env.example .env
```

Fill in keys for your chosen LLM profile (see [LLM Configuration](#llm-configuration)).

### 2. Align `backend/config/config.yaml` with your profile

> **Important:** `config.py` reads LLM/embedding/reranker settings from **`backend/config/config.yaml` only**.  
> Environment variables like `LLM_BINDING` in `docker-compose.yml` are **ignored** unless referenced inside YAML via `${VAR_NAME}`.

### 3. Start the stack

```bash
docker compose up -d --build
```

### 4. Open the app

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend Swagger | http://localhost:8000/docs |
| Health (InsightNote) | http://localhost:8000/api/health |
| Neo4j Browser | http://localhost:7474 (user: `neo4j`, password: `password`) |
| Mongo Express | http://localhost:8081 (admin / pass) |
| Adminer (Postgres) | http://localhost:8082 |

---

## Quick Start (Local dev — recommended for backend work)

Use `scripts/run-dev.bat` (Windows) or follow these steps manually:

```bash
# 1. Start databases only
docker compose up -d postgres mongodb neo4j qdrant mongo-express adminer

# 2. Backend (gpu_env)
conda activate gpu_env
cd backend
python server.py

# 3. Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

---

## LLM Configuration

Edit **`backend/config/config.yaml`**. Two common profiles:

### Profile A — OpenAI-compatible (v98store / OpenAI)

```yaml
llm:
  binding: "openai"
  model: "qwen-plus"
  api_key: "${OPENAI_API_KEY}"
  base_url: "https://v98store.com/v1"

embedding:
  binding: "openai"
  model: "text-embedding-3-small"
  api_key: "${OPENAI_API_KEY}"
  base_url: "https://v98store.com/v1"

reranker:
  binding: "jina"
  model: "BAAI/bge-reranker-v2-m3"
  base_url: "https://v98store.com/v1/rerank"
  api_key: "${OPENAI_API_KEY}"
  max_tokens: 4096
```

`.env` minimum:
```env
OPENAI_API_KEY=sk-...
ZERAG_API_KEY=default_key
```

### Profile B — Google Gemini

```yaml
llm:
  binding: "gemini"
  model: "gemini-2.0-flash"
  api_key: "${GOOGLE_API_KEY}"
  base_url: "DEFAULT_GEMINI_ENDPOINT"

embedding:
  binding: "gemini"
  model: "text-embedding-004"
  api_key: "${GOOGLE_API_KEY}"
  base_url: "DEFAULT_GEMINI_ENDPOINT"
```

`.env` minimum:
```env
GOOGLE_API_KEY=AIza...
ZERAG_API_KEY=default_key
```

If using Gemini inside Docker, add to `docker-compose.yml` under `backend.environment`:
```yaml
- GOOGLE_API_KEY=${GOOGLE_API_KEY}
```

---

## Database Configuration

Connections are resolved from `config.yaml` infrastructure section with env overrides:

| Variable | Default (Docker) | Purpose |
|---|---|---|
| `MONGO_URI` | `mongodb://mongodb:27017` | Document status & KV storage |
| `MONGO_DATABASE` | `insightnote` | Mongo database name |
| `NEO4J_URI` | `bolt://neo4j:7687` | Knowledge graph |
| `NEO4J_USER` / `NEO4J_PASSWORD` | `neo4j` / `password` | Neo4j auth |
| `QDRANT_URL` | `http://qdrant:6333` | Vector embeddings |
| `POSTGRES_URI` | `postgresql://postgres:password@postgres:5432/insightnote` | Notebooks & chat history |

### Docker volume names

| Service | Volume name in `docker-compose.yml` |
|---|---|
| MongoDB | `mongo_data` |
| Neo4j | `neo4j_data` |
| Qdrant | `qdrant_data` |
| PostgreSQL | `postgres_data` |

Reset all data:
```bash
docker compose down -v
```

---

## Storage backends (config.yaml)

```yaml
storage:
  kv: "MongoKVStorage"
  graph: "Neo4JStorage"
  vector: "QdrantVectorDBStorage"
  doc_status: "MongoDocStatusStorage"
```

If any database is unreachable at startup, the server logs a warning and continues in **degraded/sandbox mode** — the frontend falls back to `frontend/src/lib/mock-data.ts`.

---

## Validation checklist

Before pushing changes:

```bash
# Frontend type-check + build
cd frontend && npm run build

# Backend tests (must use gpu_env)
conda activate gpu_env
cd backend && pytest tests/ -v
```

Or use Taskfile shortcuts:
```bash
task test:all
task app:lint-frontend
```

---

## Taskfile commands

```bash
task docker:up      # docker compose up --build -d
task docker:down    # docker compose down
task docker:clean   # docker compose down -v (wipes volumes)
task test:all       # pytest backend/tests/ -v
```

---

## Troubleshooting

Quick fixes:

| Symptom | Likely cause | Fix |
|---|---|---|
| LLM calls fail in Docker | `config.yaml` uses Gemini but `GOOGLE_API_KEY` not passed to container | Add env var or switch to OpenAI profile |
| Empty graph after ingest | Neo4j/Qdrant not running | `docker compose ps`, check logs |
| Frontend shows mock data | Backend unreachable | Check `http://localhost:8000/api/health` |
| Chat history not persisted | PostgreSQL down | Check `POSTGRES_URI`, Adminer at :8082 |
| MinerU slow / OOM | GPU not available | Use `gpu_env`; MinerU falls back to CPU in `server.py` |

Full guide: **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**
