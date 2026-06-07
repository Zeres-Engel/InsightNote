# Demo Data & Sandbox Mode

How to set up demo notebooks, example files, and understand offline sandbox behavior.

**Related:** [SETUP.md](SETUP.md) · [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)

---

## Sandbox mode (automatic)

When the backend is unreachable or returns errors, `frontend/src/lib/api.ts` transparently falls back to in-memory stores and static mock data in **`frontend/src/lib/mock-data.ts`**.

| Trigger | Frontend behavior |
|---|---|
| `fetch()` network error | Use local notebooks/sources |
| Backend down at startup | `checkBackendHealth()` → false, sandbox graph/chat |
| Empty notebook list | UI still renders; user can create local notebooks |

**No red error screens** — this is intentional (see `AGENTS.md`).

Backend also degrades gracefully: if a DB is offline at startup, the server logs a warning and continues with reduced functionality.

---

## Built-in mock content

### Insurance demo graph

`MOCK_NODES`, `MOCK_LINKS`, `MOCK_SOURCES` in `mock-data.ts`:

- Insurance policy entities (Policy, Coverage, Motorcycle, Claim, …)
- Preset Q&A in `PRESET_QA` for common insurance questions
- Used when backend is down or notebook ID doesn't match resume variant

### Resume demo variant

When `notebookId` contains `"resume"`, sandbox graph falls back to resume-themed nodes/links (`resumeNodes`, `resumeLinks` in `api.ts`).

---

## Hardcoded demo notebooks (backend)

`insightnote_routes.py` recognizes these IDs even without Postgres entry:

| Notebook ID | Behavior |
|---|---|
| `notebook_insurance_demo` | Insurance-themed mock fallbacks |
| `notebook_resume_demo` | Resume-themed mock fallbacks |

These exist for demo/testing when PostgreSQL is unavailable.

---

## Example PDF (`load-example` endpoint)

```
POST /api/notebooks/{id}/sources/load-example
```

Request body:
```json
{
  "path": "example/Resume.pdf",
  "workspace": "default",
  "mode": "multimodal",
  "use_mineru": true
}
```

The backend searches for the file in:

1. `example/Resume.pdf` (relative to CWD)
2. `../example/Resume.pdf`
3. `backend/example/Resume.pdf`

**The file is not bundled in the repository.** To use this endpoint:

```bash
mkdir -p backend/example
cp /path/to/your/Resume.pdf backend/example/Resume.pdf
```

Or upload any PDF via `POST /api/notebooks/{id}/sources/upload` instead.

---

## Setting up a fresh demo workspace

### Option 1 — Sandbox only (no backend)

```bash
cd frontend && npm run dev
```

Open http://localhost:3000 — works offline with mock insurance data.

### Option 2 — Full stack with real ingestion

```bash
cp .env.example .env
# Configure backend/config/config.yaml (see SETUP.md)
docker compose up -d postgres mongodb neo4j qdrant
conda activate gpu_env && cd backend && python server.py
cd frontend && npm run dev
```

Then in the UI:

1. Create a notebook (e.g. "Insurance Test")
2. Upload a PDF or add a URL
3. Wait for pipeline `ready`
4. Ask a question — verify citations and graph highlight

### Option 3 — Sample text fixture

A plain text sample exists for backend tests:

```
backend/tests/fixtures/inputs/sample_note.txt
```

Use the note ingest endpoint or unit tests — not wired to the UI demo by default.

---

## Local PDF viewer files

Vite dev server exposes local PDF helpers (`vite.config.ts`):

| Endpoint | Purpose |
|---|---|
| `POST /api/upload-local` | Save PDF copy to `frontend/public/pdfs/default/` |
| `GET /api/local-files` | List local PDFs for viewer |

Used for bbox citation highlighting in the chat panel when viewing uploaded PDFs locally.

---

## Clearing demo / test data

| What to clear | How |
|---|---|
| Docker databases | `docker compose down -v` |
| Local rag files | Delete `backend/rag_storage/` |
| Frontend localStorage chat cache | Browser DevTools → Application → Local Storage → clear keys starting with `insightnote_chat_` |
| Sandbox in-memory state | Refresh page (resets `localNotebooks` in `api.ts`) |

---

## Testing sandbox fallback manually

1. Start frontend only: `cd frontend && npm run dev`
2. Do **not** start backend
3. Open http://localhost:3000
4. Verify: sources/graph/chat work with mock insurance data
5. Start backend → refresh → real API takes over (`checkBackendHealth()` → true)

---

## Related docs

- [GROUNDED_CITATIONS.md](GROUNDED_CITATIONS.md) — citation card rules
- [frontend/docs/API_CONTRACT.md](../frontend/docs/API_CONTRACT.md) — load-example schema
- [frontend/docs/DEVELOPMENT_GUIDE.md](../frontend/docs/DEVELOPMENT_GUIDE.md) — `api.ts` fallback architecture
