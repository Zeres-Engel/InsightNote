# Database Schema Reference

Where InsightNote stores data across PostgreSQL, MongoDB, Neo4j, and Qdrant — and how per-notebook isolation works.

**Related:** [SETUP.md](SETUP.md) · [RAG_ARCHITECTURE.md](../backend/docs/RAG_ARCHITECTURE.md)

---

## Isolation model

Each **notebook** maps to a `notebook_id` string (e.g. `default`, `notebook_insurance_demo`). When `get_rag_instance(notebook_id)` runs, ZeRAG clones with `workspace=notebook_id`, isolating graph, vector, and KV data.

```txt
notebook_id = "my_research"
        │
        ├── PostgreSQL   notebook_workspaces.id = "my_research"
        ├── MongoDB      collections prefixed  my_research_*
        ├── Qdrant       collections named     my_research_{namespace}
        ├── Neo4j        node label            `my_research`
        └── Filesystem   rag_storage/my_research/inputs/
```

Deleting a notebook (`DELETE /api/notebooks/{id}`) cascades cleanup across all four backends.

Implementation: `get_rag_instance()`, `purge_mongo_collections()`, `chat_history_db.delete_notebook()` in `insightnote_routes.py`.

---

## PostgreSQL

**Connection:** `POSTGRES_URI` env var (default `postgresql://postgres:password@localhost:5432/insightnote`)

**Schema owner:** `backend/app/core/history/chat_history.py` — tables auto-created at startup.

### Tables

#### `notebook_workspaces`

| Column | Type | Description |
|---|---|---|
| `id` | VARCHAR(80) PK | Notebook ID |
| `name` | VARCHAR(255) | Display name |
| `status` | VARCHAR(40) | `empty`, `processing`, `ready`, … |
| `source_count` | INTEGER | Cached source count |
| `created_at` | TIMESTAMPTZ | Created |
| `updated_at` | TIMESTAMPTZ | Last update |

#### `active_jobs`

| Column | Type | Description |
|---|---|---|
| `job_id` | VARCHAR(80) PK | Pipeline job ID |
| `notebook_id` | VARCHAR(80) FK | Parent notebook |
| `filename` | VARCHAR(255) | Ingested file name |
| `created_at` | TIMESTAMPTZ | Job start time (used for progress timing) |
| `force_mineru_fallback` | BOOLEAN | MinerU fallback flag |
| `metadata` | JSONB | e.g. `{ "source_type": "url" }` |

#### `notebook_conversations`

| Column | Type | Description |
|---|---|---|
| `id` | VARCHAR(50) PK | Conversation/session ID |
| `notebook_id` | VARCHAR(50) FK | Parent notebook |
| `title` | VARCHAR(255) | Session title |
| `created_at` / `updated_at` | TIMESTAMPTZ | Timestamps |

#### `conversation_messages`

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | Message ID |
| `conversation_id` | VARCHAR(50) FK | Parent session |
| `role` | VARCHAR(20) | `user` or `assistant` |
| `content` | TEXT | Message text |
| `metadata` | JSONB | Citations, `graph_path`, `retrieval_steps` |
| `created_at` | TIMESTAMPTZ | Timestamp |

### Admin access

Adminer: http://localhost:8082 (Docker) — server `postgres`, DB `insightnote`, user `postgres`.

---

## MongoDB

**Connection:** `MONGO_URI` + database `MONGO_DATABASE` (default `insightnote`)

**Collection naming:** `{workspace}_{namespace}`

Example for notebook `my_research`:

| Collection | Namespace constant | Purpose |
|---|---|---|
| `my_research_text_chunks` | `text_chunks` | Chunk KV store |
| `my_research_full_docs` | `full_docs` | Full document text |
| `my_research_full_entities` | `full_entities` | Extracted entities |
| `my_research_full_relations` | `full_relations` | Extracted relations |
| `my_research_llm_response_cache` | `llm_response_cache` | LLM query cache |
| `my_research_doc_status` | `doc_status` | Ingestion lifecycle per document |

Namespace constants: `backend/app/core/namespace.py` (`NameSpace` class).

**Purge on notebook delete:** drops all collections where name starts with `{notebook_id}_`.

**Override env:** `MONGODB_WORKSPACE` forces a single workspace for all Mongo instances (admin use only).

### Admin access

Mongo Express: http://localhost:8081 (admin / pass)

---

## Neo4j (DozerDB)

**Connection:** `NEO4J_URI` (default `bolt://localhost:7687`), auth `neo4j` / `password`

**Image:** `graphstack/dozerdb:5.26.3`

### Workspace label

Each node carries a **dynamic label** equal to the notebook workspace ID:

```cypher
MATCH (n:`my_research`) RETURN n LIMIT 10
```

Nodes store `entity_id` for lookups. Relationships connect entities within the same workspace label.

### Database name

Neo4j database name is derived from the workspace string (sanitized). Each isolated ZeRAG instance may use a separate logical database.

### Indexes

Created per workspace label on `entity_id` and full-text indexes at initialization.

**Override env:** `NEO4J_WORKSPACE` forces workspace label globally (admin use only).

### Admin access

Neo4j Browser: http://localhost:7474

---

## Qdrant

**Connection:** `QDRANT_URL` (default `http://localhost:6333`)

### Collection naming

```
{workspace}_{namespace}
```

Example for notebook `my_research`:

| Collection | Namespace | Content |
|---|---|---|
| `my_research_chunks` | `chunks` | Text chunk embeddings |
| `my_research_entities` | `entities` | Entity embeddings |
| `my_research_relationships` | `relationships` | Relationship embeddings |

Each point includes payload field `workspace_id` for filtered queries within shared legacy collections.

**Override env:** `QDRANT_WORKSPACE` forces workspace globally (admin use only).

Legacy collection patterns (`zerag_vdb_{namespace}`, etc.) are migrated automatically — see `qdrant_impl.py`.

---

## Filesystem (local)

| Path | Purpose |
|---|---|
| `backend/rag_storage/` | Default working dir (`config.yaml` → `server.working_dir`) |
| `rag_storage/{notebook_id}/inputs/` | Uploaded/copied source files per notebook |
| `rag_storage/{notebook_id}/mineru_output/` | MinerU parser output |
| `rag_storage/{workspace}/kv_store_*.json` | JSON fallback when Mongo doc_status unavailable |
| `backend/logs/server.log` | Backend runtime log |

Docker mounts `./backend/rag_storage` or `/app/rag_storage` inside the container.

---

## Data flow summary

```mermaid
flowchart LR
    Ingest[Ingest PDF/URL/Note] --> Mongo[MongoDB doc_status]
    Ingest --> Files[rag_storage/inputs]
    Ingest --> Parse[MinerU / MultiRAG]
    Parse --> Neo4j[Neo4j graph tree + entities]
    Parse --> Qdrant[Qdrant embeddings]
    Parse --> MongoKV[MongoDB KV stores]

    Chat[POST /chat] --> Qdrant
    Chat --> Neo4j
    Chat --> LLM[LLM + reranker]
    Chat --> Postgres[Save messages]
```

---

## Inspecting data by notebook

```bash
# Postgres — list notebooks
docker exec -it insightnote-postgres psql -U postgres -d insightnote \
  -c "SELECT id, name, status, source_count FROM notebook_workspaces;"

# Mongo — list collections for a notebook
docker exec -it insightnote-mongodb mongosh insightnote --eval \
  "db.getCollectionNames().filter(c => c.startsWith('my_research_'))"

# Qdrant — list collections (REST)
curl http://localhost:6333/collections

# Neo4j — count nodes by workspace label
# In Neo4j Browser: MATCH (n:`my_research`) RETURN count(n)
```

---

## Reset options

| Scope | Command |
|---|---|
| All databases | `docker compose down -v` |
| Single notebook | `DELETE /api/notebooks/{id}` via API |
| Local files only | Delete `backend/rag_storage/{notebook_id}/` |
| Postgres only | Drop rows in Adminer or `DELETE FROM notebook_workspaces WHERE id = '...'` |

Wiping Docker volumes does **not** delete `backend/rag_storage` on the host unless you remove it manually.
