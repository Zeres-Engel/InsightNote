# Query Modes & Chat History

Conversational retrieval architecture: multi-turn history, query modes, and streaming responses.

---

## Chat history flow

```txt
Frontend (App.tsx)
  ├── PostgreSQL via GET /api/notebooks/{id}/chat/history  (primary)
  └── localStorage cache per notebook                          (offline fallback)
              │
              ▼
POST /api/notebooks/{id}/chat
  body: { message, chat_history, stream, mode, conversation_id }
              │
              ▼
insightnote_routes.py  ──►  ZeRAG query engine
              │
              ▼
PostgreSQL persists conversation turns (when DB online)
```

### Request fields (`ChatRequest`)

| Field | Type | Notes |
|---|---|---|
| `message` or `user_prompt` | string | Required — user question |
| `chat_history` or `conversation_history` | array | Prior turns `{ role, content }` |
| `conversation_id` | string | Optional — auto-resolved from Postgres if omitted |
| `mode` | string | Default `"mix"` |
| `stream` | boolean | Default `false`; frontend sends `true` for live streaming |
| `rerank` | boolean | Default `true`; bypasses or enables cross-encoder reranking |

### Context rewriting & Reranking Optimization

*   **Context Rewriting**: ZeRAG uses chat history to rewrite follow-up questions into standalone queries before retrieval (e.g. "Does it cover motorcycles?" → full contextual question using prior turns).
*   **Reranking Filtration**: Once chunks, entities, and relationships are retrieved from Qdrant and Neo4j, they are sent to the **BAAI/bge-reranker-v2-m3** cross-encoder model. The model computes a precise semantic matching score for each segment. Only high-density, top-ranked chunks that pass the `rerank_score` are retained, ensuring that the context window contains zero redundant data and the LLM response is perfectly grounded.

---

## Query modes

Six modes are supported in the engine (`backend/app/core/base.py`, `_perform_kg_search()` in `operate.py`):

| Mode | Retrieval path | Engines |
|---|---|---|
| **`naive`** | Vector chunks only | Qdrant dense search — no graph keyword branches |
| **`local`** | **Entity focus** | Low-level keywords → Neo4j nodes + entities VDB |
| **`global`** | **Relationship focus** | High-level keywords → Neo4j edges + relationships VDB |
| **`hybrid`** | Entity + relationship | Both node and edge retrieval — no extra vector pass |
| **`mix`** (default) | Entity + relationship + vector | Hybrid **plus** Qdrant chunk similarity (`_get_vector_context`) |
| **`bypass`** | None | Direct LLM — skips retrieval (debug) |

### Cost & latency ordering

```txt
naive  <  local ≈ global  <  hybrid  <  mix
```

`mix` is the slowest mode because it executes the most retrieval branches before reranking. See [BENCHMARKING.md](BENCHMARKING.md) for measured latencies and Locust pipeline.

### naive

Pure vector search via `naive_query()` — no entity/relationship graph traversal. Fastest mode; lower recall on multi-hop questions.

### local (entity focus)

Extracts low-level keywords, retrieves entity neighborhoods from Neo4j and the entities vector store.

### global (relationship focus)

Extracts high-level keywords, retrieves relationship triplets from Neo4j and the relationships vector store.

### hybrid

Runs **both** local (entity) and global (relationship) branches and round-robin merges results. No additional vector chunk pass.

### mix (default)

1. Extract low-level and high-level keywords via LLM
2. Entity retrieval (`local` branch) + relationship retrieval (`global` branch)
3. **Additional** dense vector chunk search on Qdrant
4. Merge, deduplicate, rerank with BGE cross-encoder
5. Generate answer; return `graph_path` for 3D highlight

---

## Streaming response

When `stream: true`:

```
data: {"type":"metadata","citations":[...],"retrieval_steps":[...],"graph_path":{...}}
data: {"type":"token","content":"Yes,"}
data: {"type":"token","content":" the"}
...
data: {"type":"done"}
```

Frontend (`api.ts`) parses SSE lines and updates the chat bubble incrementally.

---

## Graph path in responses

```json
{
  "graph_path": {
    "node_ids": ["entity_a", "entity_b"],
    "link_ids": ["rel_1"],
    "mode": "query"
  }
}
```

Passed to `KnowledgeGraphPanel` for cyan highlight animation. See [../../docs/GRAPH_VISUALIZATION.md](../../docs/GRAPH_VISUALIZATION.md).

---

## Low-level query API

Additional endpoints in `query_routes.py` (used internally / for advanced clients):

```
POST /query
POST /query/stream
```

These accept `QueryParam` with the same mode enum. Protected by `ZERAG_API_KEY` when configured.

---

## Related docs

- [RAG_ARCHITECTURE.md](RAG_ARCHITECTURE.md) — dual retrieval overview
- [BENCHMARKING.md](BENCHMARKING.md) — latency benchmarks & Locust pipeline
- [../../docs/GROUNDED_CITATIONS.md](../../docs/GROUNDED_CITATIONS.md) — citation grounding rules
- [../../frontend/docs/API_CONTRACT.md](../../frontend/docs/API_CONTRACT.md) — full REST contract
