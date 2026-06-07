# API Integration Contract

Strict REST contract between the Vite React frontend (`frontend/src/lib/api.ts`) and the FastAPI backend (`backend/app/api/routers/insightnote_routes.py`).

---

## Conventions

| Item | Value |
|---|---|
| Base URL | `http://localhost:8000/api` |
| Override | `NEXT_PUBLIC_API_BASE_URL` env var |
| Content type | `application/json` (except file uploads) |
| Auth | Optional `ZERAG_API_KEY` header when configured |
| CORS | Enabled for all origins in `server.py` |

On any network/HTTP failure, the frontend falls back to sandbox data in `mock-data.ts`.

---

## Health

```
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "service": "insightnote-backend",
  "runtime": "gpu_env",
  "workspace": "default"
}
```

> There is also a root `GET /health` on the server with a different schema — the frontend uses `/api/health`.

---

## Notebooks

### List notebooks
```
GET /api/notebooks
```

**Response:** `NotebookListItem[]`
```json
[
  {
    "id": "default",
    "name": "My Notebook",
    "source_count": 2,
    "status": "ready"
  }
]
```

### Create notebook
```
POST /api/notebooks
```
```json
{ "name": "Research Project" }
```

**Response:** `NotebookListItem` with `status: "empty"`

### Get notebook
```
GET /api/notebooks/{notebook_id}
```

### Delete notebook
```
DELETE /api/notebooks/{notebook_id}
```

**Response:**
```json
{ "status": "success", "message": "Notebook ... deleted." }
```

Cascades deletion across Postgres, MongoDB, Qdrant, and Neo4j.

---

## Sources

### List sources
```
GET /api/notebooks/{notebook_id}/sources
```

**Response:** `SourceListItem[]`
```json
[
  {
    "id": "src_abc123",
    "name": "Report.pdf",
    "type": "pdf",
    "status": "ready",
    "entity_count": 12,
    "chunk_count": 8,
    "pipeline_job_id": "job_xyz"
  }
]
```

### Upload file
```
POST /api/notebooks/{notebook_id}/sources/upload
Content-Type: multipart/form-data
```
Field: `file` (PDF, TXT, MD, or office formats)

**Response:** `SourceAddResponse`
```json
{
  "source_id": "src_...",
  "name": "Report.pdf",
  "type": "pdf",
  "status": "processing",
  "pipeline_job_id": "job_..."
}
```

### Streaming upload (used by frontend)
```
POST /api/documents/upload/stream?workspace={notebook_id}&multi_modal=true&graph_mode=true
Content-Type: multipart/form-data
```

Returns newline-delimited JSON progress events.

### Add URL (streaming)
```
POST /api/notebooks/{notebook_id}/sources/url/stream
```
```json
{ "url": "https://example.com/article" }
```

### Add text note (streaming)
```
POST /api/notebooks/{notebook_id}/sources/note/stream
```
```json
{ "title": "My Note", "content": "Markdown content..." }
```

### Load example PDF
```
POST /api/notebooks/{notebook_id}/sources/load-example
```
```json
{
  "path": "example/Resume.pdf",
  "workspace": "default",
  "mode": "multimodal",
  "use_mineru": true
}
```

> Requires `example/Resume.pdf` on the backend filesystem. Not bundled in repo.

### Delete source
```
DELETE /api/notebooks/{notebook_id}/sources/{source_id}
```

---

## Pipeline jobs

```
GET /api/pipeline/jobs/{job_id}
```

**Response:** `PipelineJobResponse`
```json
{
  "job_id": "job_abc",
  "status": "processing",
  "steps": [
    { "name": "load_file", "status": "done" },
    { "name": "document_understanding", "status": "processing" },
    { "name": "vector_graph_sync", "status": "pending" }
  ],
  "extracted_nodes": [],
  "extracted_links": [],
  "progress_percentage": 45.0,
  "latest_message": "Extracting semantic chunks"
}
```

### Step names by source type

| Source type | Steps |
|---|---|
| PDF / file | `load_file` → `document_understanding` → `vector_graph_sync` |
| URL / note / text | `load_file` → `chunking` → `entity_extraction` → `vector_graph_sync` |

Step statuses: `pending` | `processing` | `done` | `failed_fallback_used`

Job statuses: `processing` | `ready` | `failed`

Frontend polls every ~1.5 seconds while jobs are active.

---

## Graph

### Full graph
```
GET /api/notebooks/{notebook_id}/graph
```

**Response:**
```json
{
  "nodes": [
    {
      "id": "entity_001",
      "label": "Insurance Policy",
      "type": "Document",
      "group": "document",
      "properties": { "summary": "..." }
    }
  ],
  "links": [
    {
      "id": "rel_001",
      "source": "entity_001",
      "target": "entity_002",
      "label": "HAS_COVERAGE"
    }
  ]
}
```

Internal IDs (`source_id`, `doc_id`, `chunk_id`, `track_id`) are stripped from properties before response.

### Node details
```
GET /api/notebooks/{notebook_id}/graph/node/{node_id}
```

**Response:** `NodeDetailsResponse` with `id`, `label`, `type`, `properties`, optional `citations`

### Node neighbors
```
GET /api/notebooks/{notebook_id}/graph/node/{node_id}/neighbors
```

**Response:** `GraphResponse` (connected nodes and links)

---

## Chat

### Chat history
```
GET /api/notebooks/{notebook_id}/chat/history
```

**Response:** array of conversation messages with metadata (citations, graph_path per turn)

### Ask copilot
```
POST /api/notebooks/{notebook_id}/chat
```
```json
{
  "message": "Does this policy cover motorcycle accidents?",
  "chat_history": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ],
  "mode": "mix",
  "stream": true,
  "rerank": true,
  "conversation_id": "session_default"
}
```

**Non-streaming response (`stream: false`):**
```json
{
  "answer": "Yes, Section 1.1 covers...",
  "citations": [
    {
      "source_id": "policy_main",
      "title": "Policy Section 1.1",
      "chunk_id": "chk_012",
      "text": "Coverage extends to motorcycles...",
      "score": 0.94
    }
  ],
  "retrieval_steps": [
    "Extracted keywords: ['motorcycle', 'coverage']",
    "Vector search in Qdrant (k=3)",
    "Graph traversal in Neo4j"
  ],
  "graph_path": {
    "node_ids": ["entity_a", "entity_b"],
    "link_ids": ["rel_1"],
    "mode": "query"
  },
  "suggested_questions": ["What are the exclusions?"]
}
```

**Streaming (`stream: true`):** SSE events — see [GROUNDED_CITATIONS.md](../../docs/GROUNDED_CITATIONS.md)

---

## Legacy endpoints (flat workspace)

Still supported for backward compatibility. Use notebook-scoped endpoints for new code.

| Method | Endpoint | Maps to |
|---|---|---|
| GET | `/api/sources` | Default workspace source list |
| POST | `/api/sources` | Add URL/text/PDF to default workspace |
| POST | `/api/chat` | Chat on default workspace |
| GET | `/api/graph` | Default workspace graph |
| GET | `/api/graph/node/{id}` | Node details |
| GET | `/api/graph/node/{id}/neighbors` | Node neighbors |

Legacy `POST /api/sources` body:
```json
{
  "workspace_id": "default",
  "type": "url",
  "value": "https://example.com"
}
```

---

## Sandbox fallback

When the backend is unreachable, `api.ts` maintains in-memory stores (`localNotebooks`, `localSources`, `localJobs`) and serves mock graph/chat data from `mock-data.ts`.

Any new backend endpoint must match these JSON shapes exactly to avoid breaking the sandbox-to-live transition.

---

## Related docs

- [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) — frontend architecture
- [../../docs/SETUP.md](../../docs/SETUP.md) — configuration
- [../../docs/GROUNDED_CITATIONS.md](../../docs/GROUNDED_CITATIONS.md) — citation rules
