# Frontend Development Guide

Architecture reference for the InsightNote Vite + React client.

---

## Project layout

```txt
frontend/src/
├── App.tsx                     # Central state hub
├── components/
│   ├── sources/SourcesPanel.tsx
│   ├── chat/ChatPanel.tsx
│   └── graph/KnowledgeGraphPanel.tsx
└── lib/
    ├── api.ts                  # All HTTP calls + sandbox fallback
    ├── mock-data.ts            # Offline demo data
    └── types.ts                # Shared interfaces
```

---

## State coordination (`App.tsx`)

```txt
                    App.tsx
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
  SourcesPanel   ChatPanel   KnowledgeGraphPanel
```

| State | Owner | Consumers |
|---|---|---|
| `notebooks`, `activeNotebook` | App | SourcesPanel, header |
| `sources`, `pipelineJobs` | App | SourcesPanel (polls jobs every ~1.5s) |
| `messages`, `chatLoading` | App | ChatPanel |
| `graphData`, `highlightPath` | App | KnowledgeGraphPanel |

**Rule:** pillars never call each other directly — they receive callbacks and props from `App.tsx`.

### Pipeline polling

When `activeJobIds` is non-empty, `App.tsx` runs a `useEffect` interval polling `api.getPipelineStatus(jobId)`. On `ready`, it refreshes sources and graph, then sets an emerald ingest highlight on new nodes.

---

## API broker (`api.ts`)

All backend calls live here. Components must not use `fetch()` directly.

```typescript
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const BASE_URL = `${API_BASE_URL.replace(/\/$/, "")}/api`;
```

Key functions:

| Function | Endpoint |
|---|---|
| `checkBackendHealth()` | `GET /api/health` |
| `listNotebooks()` | `GET /api/notebooks` |
| `createNotebook(name)` | `POST /api/notebooks` |
| `listSources(notebookId)` | `GET /api/notebooks/{id}/sources` |
| `uploadFile(notebookId, file)` | streaming upload |
| `addUrlStream(notebookId, url)` | URL stream |
| `addNoteStream(notebookId, title, content)` | note stream |
| `getPipelineStatus(jobId)` | `GET /api/pipeline/jobs/{id}` |
| `getGraph(notebookId)` | `GET /api/notebooks/{id}/graph` |
| `askChat(notebookId, message, history, onChunk)` | `POST /api/notebooks/{id}/chat` |
| `getChatHistory(notebookId)` | `GET /api/notebooks/{id}/chat/history` |

On error → fallback to `localNotebooks` / `localSources` / mock graph data.

---

## Chat panel (`ChatPanel.tsx`)

- Renders markdown answers with syntax highlighting
- Citation cards below answers (grounded sources only)
- Collapsible retrieval steps (monospace terminal style)
- **Pending:** 3 bouncing dots in assistant bubble
- **Streaming:** pulsing indigo cursor on last line until complete

Chat history:
1. Loaded from Postgres via `getChatHistory()` on notebook switch
2. Cached in `localStorage` keyed by notebook ID as offline fallback

---

## Graph panel (`KnowledgeGraphPanel.tsx`)

Built on `react-force-graph-3d` + `three@^0.184.0`.

### Highlight colors

| Mode | Color | Trigger |
|---|---|---|
| Query reasoning | Cyan `#38bdf8` | Chat `graph_path.mode = "query"` |
| Ingest complete | Emerald `#10b981` | Document reaches `ready` |
| Manual focus | Cyan | User clicks node |

### Required refresh on highlight change

```typescript
useEffect(() => {
  if (fgRef.current) {
    fgRef.current.refresh();
  }
}, [highlightPath]);
```

Without this, stale link colors and particles persist in the WebGL cache.

### Auto-rotation

```typescript
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
```

Pauses during mouse drag.

### ResizeObserver

Measures parent container and passes `width`/`height` to `<ForceGraph3D>` so the canvas centers correctly when the panel resizes.

---

## Sources panel (`SourcesPanel.tsx`)

- Notebook switcher
- URL input, rich note editor, PDF drag-and-drop
- Source list with status badges (`processing` / `ready` / `failed`)
- Delete button (garbage bin) per source

Progress messages are sanitized — no raw IDs or file paths shown.

---

## Vite configuration

`vite.config.ts`:
- Dev server port **3000**, host `true` (Docker-compatible)
- Injects `NEXT_PUBLIC_API_BASE_URL` at build time
- Local dev middleware: `/api/upload-local`, `/api/local-files` for PDF viewer

---

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Backend base (without `/api`) |
| `VITE_API_BASE_URL` | set in docker-compose | Same purpose in Docker |

---

## Build & lint

```bash
cd frontend
npm install
npm run dev       # development
npm run build     # tsc + vite build (required before push)
```

From project root: `task app:lint-frontend`

---

## Related docs

- [API_CONTRACT.md](API_CONTRACT.md) — REST schemas
- [../../docs/GRAPH_VISUALIZATION.md](../../docs/GRAPH_VISUALIZATION.md) — WebGL details
- [../../docs/SETUP.md](../../docs/SETUP.md) — backend configuration
- [../../AGENTS.md](../../AGENTS.md) — UI rules for agents
