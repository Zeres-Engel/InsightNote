# Configuration Reference

Complete reference for InsightNote environment variables and `backend/config/config.yaml` settings.

**Setup guide:** [SETUP.md](SETUP.md)

---

## Configuration priority

```txt
1. backend/config/config.yaml     ← primary for LLM, embedding, reranker, storage
2. .env at project root           ← API keys referenced as ${VAR} in YAML
3. OS environment variables       ← override ${VAR} substitutions
4. docker-compose environment     ← only effective when passed to process AND
                                     referenced in YAML (except POSTGRES_URI, ZERAG_API_KEY)
```

Loaded by `backend/config.py` via `python-dotenv` + YAML interpolation.

---

## Environment variables (`.env`)

Copy from `.env.example` at project root (identical to `backend/.env.example`).

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_API_KEY` | If using Gemini profile | Google AI API key |
| `OPENAI_API_KEY` | If using OpenAI/v98store profile | OpenAI or compatible proxy key; also used by Jina reranker in default config |
| `ZERAG_API_KEY` | Optional | FastAPI auth key; unset = no auth on most routes |
| `MONGO_URI` | Optional | MongoDB connection (default via YAML) |
| `MONGO_DATABASE` | Optional | Mongo database name (default `insightnote`) |
| `NEO4J_URI` | Optional | Neo4j bolt URI |
| `NEO4J_USER` | Optional | Neo4j username |
| `NEO4J_PASSWORD` | Optional | Neo4j password |
| `QDRANT_URL` | Optional | Qdrant HTTP URL |
| `QDRANT_API_KEY` | Optional | Qdrant API key (if secured) |
| `POSTGRES_URI` | Optional | PostgreSQL DSN — read directly by `chat_history.py`, not YAML |
| `RERANK_SCORE` | Optional | Reranker threshold override |
| `VECTOR_SCORE` | Optional | Vector similarity threshold override |

### Admin override variables (rare)

Force a single workspace across all storage backends:

| Variable | Effect |
|---|---|
| `MONGODB_WORKSPACE` | Override Mongo workspace prefix |
| `NEO4J_WORKSPACE` | Override Neo4j node label |
| `QDRANT_WORKSPACE` | Override Qdrant workspace filter |

### Qdrant batch tuning

| Variable | Default | Description |
|---|---|---|
| `QDRANT_UPSERT_MAX_PAYLOAD_BYTES` | built-in | Max upsert payload size |
| `QDRANT_UPSERT_MAX_POINTS_PER_BATCH` | built-in | Max points per upsert batch |

### Frontend (`.env` in `frontend/` or docker-compose)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Backend host (no `/api` suffix) |
| `VITE_API_BASE_URL` | same | Docker alias |

---

## `backend/config/config.yaml`

### `server`

| Key | Default | Maps to `config.` |
|---|---|---|
| `host` | `"0.0.0.0"` | `HOST` |
| `port` | `8000` | `PORT` |
| `working_dir` | `"./rag_storage"` | `WORKING_DIR` |
| `workspace` | `"default"` | `WORKSPACE` (global default ZeRAG instance) |

### `llm`

| Key | Default (if YAML missing) | Maps to |
|---|---|---|
| `binding` | `"openai"` | `LLM_BINDING` — values: `openai`, `gemini`, `ollama` |
| `model` | `"gpt-4o-mini"` | `LLM_MODEL` |
| `api_key` | — | `LLM_API_KEY` — use `"${GOOGLE_API_KEY}"` or `"${OPENAI_API_KEY}"` |
| `base_url` | — | `LLM_BASE_URL` |
| `options` | `{}` | `LLM_OPTIONS` |

Supported bindings in `server.py`: `openai`, `gemini`, `ollama`.

### `embedding`

| Key | Default | Maps to |
|---|---|---|
| `binding` | `"openai"` | `EMBEDDING_BINDING` |
| `model` | `"text-embedding-3-small"` | `EMBEDDING_MODEL` |
| `api_key` | — | `EMBEDDING_API_KEY` |
| `base_url` | — | `EMBEDDING_BASE_URL` |

Gemini embeddings auto-detect dimension at startup (fallback 3072).

OpenAI `text-embedding-3-small` → 1536 dims; `text-embedding-3-large` → 3072 dims.

### `reranker`

| Key | Default | Maps to |
|---|---|---|
| `binding` | `"lollms"` | `RERANKER_BINDING` — values: `jina`, `cohere`, `ali`, `google`/`vertex` |
| `model` | `""` | `RERANKER_MODEL` — empty disables reranker |
| `base_url` | — | `RERANKER_BASE_URL` |
| `api_key` | falls back to LLM key | `RERANKER_API_KEY` |
| `max_tokens` | `4096` | `RERANKER_MAX_TOKENS` |
| `rerank_score` | `0.0` (or `RERANK_SCORE` env) | `RERANK_SCORE` |

If `model` or `base_url` is missing, reranker is skipped (`None` in server startup banner).

### `vector` (optional section)

| Key | Default | Maps to |
|---|---|---|
| `vector_score` | `0.2` | `VECTOR_SCORE` — cosine similarity threshold |

### `storage`

| Key | Default | Maps to |
|---|---|---|
| `kv` | `"MongoKVStorage"` | `KV_STORAGE` |
| `graph` | `"Neo4jStorage"` | `GRAPH_STORAGE` (normalized to `Neo4JStorage`) |
| `vector` | `"QdrantVectorDBStorage"` | `VECTOR_STORAGE` |
| `doc_status` | `"MongoDocStatusStorage"` | `DOC_STATUS_STORAGE` |

Alternative backends exist in `backend/app/core/kg/` (FAISS, Milvus, JSON file, etc.) but are not the default stack.

### `infrastructure`

Metadata for Docker and connection defaults. Values support `${ENV:-default}` syntax.

| Section | Keys | Purpose |
|---|---|---|
| `mongodb` | `uri`, `database`, `image`, ports, `volume_name` | Mongo connection |
| `neo4j` | `uri`, `user`, `password`, `image`, ports, `volume_name` | Neo4j connection |
| `qdrant` | `url`, `api_key`, `image`, ports, `volume_name` | Qdrant connection |
| `deployment` | `network_name`, `restart_policy` | Docker metadata |

---

## Example profiles

### OpenAI-compatible (v98store)

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

### Google Gemini

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

reranker:
  binding: "jina"
  model: "BAAI/bge-reranker-v2-m3"
  base_url: "https://v98store.com/v1/rerank"
  api_key: "${OPENAI_API_KEY}"
  max_tokens: 4096
```

> Use real, currently available model names from your provider. Names in the committed YAML may be placeholders.

---

## Startup banner

When `python server.py` starts, it prints active config:

```txt
ZeRAG Server Configuration
Workspace   : default
LLM         : ...
LLM binding : openai / google
Embedding   : ...
Reranker    : BAAI/bge-reranker-v2-m3 (or DISABLED)
KV Storage  : MongoKVStorage
Graph       : Neo4JStorage
Vector DB   : QdrantVectorDBStorage
```

Verify this banner matches your intended profile after any config change.

---

## docker-compose vs config.yaml mismatch

| docker-compose env | Read by config.py? | Action |
|---|---|---|
| `LLM_BINDING`, `LLM_MODEL`, … | No (unless in YAML) | Edit `config.yaml` |
| `OPENAI_API_KEY` | Yes (via `${OPENAI_API_KEY}` in YAML) | Set in `.env` |
| `GOOGLE_API_KEY` | Yes (via `${GOOGLE_API_KEY}` in YAML) | Set in `.env`; add to compose for Docker |
| `POSTGRES_URI` | Yes (direct env in chat_history.py) | Auto-set in compose |
| `MONGO_URI`, `NEO4J_URI`, `QDRANT_URL` | Yes (via YAML interpolation) | Auto-set in compose |

See [DOCKER.md](DOCKER.md) for full Docker env reference.

---

## Related docs

- [SETUP.md](SETUP.md) — step-by-step setup
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — where data is stored
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — config-related errors
