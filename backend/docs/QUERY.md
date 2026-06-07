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

Six modes are supported in the engine (`backend/app/core/base.py`):

| Mode | Engines used | Best for |
|---|---|---|
| **`mix`** (default) | Qdrant + Neo4j + reranker | General Q&A, multi-hop reasoning |
| **`hybrid`** | Local + global keyword paths | Deep cross-reference across entity levels |
| **`local`** | Neo4j entity neighborhoods | Specific facts, relationship lookups |
| **`global`** | Neo4j community summaries | Broad thematic questions |
| **`naive`** | Qdrant only | Fast semantic search; fallback when graph is offline |
| **`bypass`** | None (direct LLM) | Internal/debug — skips retrieval |

### mix (default)

1. Extract low-level and high-level keywords via LLM.
2. Qdrant dense vector search on low-level keywords.
3. Neo4j traversal on high-level keywords.
4. Merge contexts, deduplicate, and **rerank with the BAAI/bge-reranker-v2-m3 cross-encoder**.
5. Filter out low-scoring chunks (based on configured `rerank_score` threshold).
6. Generate answer; return `graph_path` for 3D WebGL highlight.

### hybrid

Combines **local** entity retrieval and **global** community retrieval in a round-robin merge. Uses both keyword types simultaneously.

### naive

Pure vector search — no graph traversal. Automatically useful when Neo4j is unavailable.

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
- [../../docs/GROUNDED_CITATIONS.md](../../docs/GROUNDED_CITATIONS.md) — citation grounding rules
- [../../frontend/docs/API_CONTRACT.md](../../frontend/docs/API_CONTRACT.md) — full REST contract
