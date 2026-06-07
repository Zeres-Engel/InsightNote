# Grounded Citations & Retrieval Logs

How InsightNote links answers to source documents, sanitizes internal identifiers, and renders the collapsible retrieval steps panel.

---

## 1. Citation provenance chain

```txt
Qdrant vector match  ──►  Neo4j chunk node (page, bbox)  ──►  CitationItem API  ──►  ChatPanel cards
```

1. **Vector match** — Qdrant returns top-k text chunks by cosine similarity.
2. **Graph lookup** — Neo4j resolves chunk metadata: `content`, `page_number`, `bbox` (`[x_min, y_min, x_max, y_max]`, normalized 0–1).
3. **API response** — FastAPI wraps results in `CitationItem`:
   ```json
   {
     "source_id": "policy_main",
     "title": "Policy Section 1.1",
     "chunk_id": "chk_ins_012",
     "text": "The policy extends coverage to motorcycles...",
     "score": 0.94
   }
   ```
4. **UI** — `ChatPanel.tsx` renders citation cards below the answer. Cards show document title, snippet, and score — **not** raw database IDs.

### Grounding rule (AGENTS.md)

Only documents **explicitly cited** in the final answer (bracket references or LLM metadata) appear as citation cards. Retrieved-but-unused chunks are not shown.

---

## 2. Multi-key path matching

Citations must resolve crawled URLs and local PDF paths to user-friendly titles without exposing server directories. `insightnote_routes.py` indexes each source under multiple keys:

| Key | Example |
|---|---|
| Document ID | Internal doc hash |
| Normalized path | Forward-slash unified path |
| Basename | `Resume.pdf` |
| URL metadata | Original crawled URL from MongoDB `metadata.url` |

On Windows, backslash paths are normalized to forward slashes before lookup. Absolute paths are reduced to basenames in user-facing output.

---

## 3. Identifier redaction

Internal IDs must never appear in UI progress logs, citations, graph tooltips, or chat bubbles.

Stripped prefixes: `doc-`, `chunk-`, `track-`, `src_`, `job_`, `source_id`, `doc_id`, `chunk_id`, `track_id`.

Progress copy uses stage labels such as:
- `Reading layout`
- `Extracting semantic chunks`
- `Mapping relationships`
- `Finalizing graph sync`

Implementation: `_sanitize_string` and related helpers in `insightnote_routes.py`.

---

## 4. Collapsible retrieval steps

The chat panel shows a collapsible **Retrieval & Reasoning Steps** console (monospace, dark terminal style).

- Backend populates `retrieval_steps: string[]` in the chat response (or streaming metadata event).
- `ChatPanel.tsx` toggles visibility with Framer Motion height animation.
- Steps describe keyword extraction, vector search, graph traversal, and reranking — without raw Cypher or internal IDs.

---

## 5. Chat UI loading states

| State | Behavior |
|---|---|
| **Pending** | Compact assistant bubble with 3 bouncing dots (`animate-bounce`, staggered delays) — no skeleton paragraphs |
| **Streaming** | Inline pulsing indigo cursor appended to last line in `MarkdownRenderer`; removed when `isStreaming` becomes false |

---

## 6. Streaming response format

When `stream: true` is sent to `POST /api/notebooks/{id}/chat`:

1. **Metadata event** — citations, `retrieval_steps`, `graph_path`, `suggested_questions`
2. **Token events** — answer text streamed word-by-word
3. **Done event** — signals completion

The frontend (`api.ts`) parses Server-Sent Events (`data: {...}\n\n`) and updates the chat bubble incrementally.
