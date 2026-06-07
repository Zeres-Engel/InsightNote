# InsightNote Frontend

Vite + React + TypeScript client for the three-column GraphRAG workspace.

**Setup:** [../docs/SETUP.md](../docs/SETUP.md) · **API contract:** [docs/API_CONTRACT.md](docs/API_CONTRACT.md) · **Architecture:** [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md)

---

## Start here

| Task | Where |
|---|---|
| Run dev server | `npm run dev` → http://localhost:3000 |
| All backend calls | `src/lib/api.ts` only — never call DBs from components |
| Sandbox / offline mode | `src/lib/mock-data.ts` — auto-activated on fetch failure |
| Graph highlight rules | [../docs/GRAPH_VISUALIZATION.md](../docs/GRAPH_VISUALIZATION.md) |
| Citations & streaming | [../docs/GROUNDED_CITATIONS.md](../docs/GROUNDED_CITATIONS.md) |
| Build check before push | `npm run build` |

---

## Three-column layout

```txt
┌───────────────────────┬─────────────────────────────────┬────────────────────┐
│ SourcesPanel (320px)  │ ChatPanel (flex-1)            │ KnowledgeGraph (480px)
│ URL / note / PDF      │ Streaming chat + citations      │ 3D force-directed graph
│ Pipeline badges       │ Retrieval steps (collapsible)   │ Path highlights
│ Delete sources        │ Preset action pills             │ Node properties drawer
└───────────────────────┴─────────────────────────────────┴────────────────────┘
```

State is coordinated in **`App.tsx`**. Pillars share props and callbacks — they do not call each other's internals or bypass `api.ts`.

| Pillar | Component | Backend routes |
|---|---|---|
| Sources | `components/sources/SourcesPanel.tsx` | `/api/notebooks/{id}/sources/…`, `/api/pipeline/jobs/{id}` |
| Chat | `components/chat/ChatPanel.tsx` | `/api/notebooks/{id}/chat`, `/chat/history` |
| Graph | `components/graph/KnowledgeGraphPanel.tsx` | `/api/notebooks/{id}/graph`, node/neighbors |

---

## Directory structure

```txt
frontend/
├── src/
│   ├── App.tsx                        # Layout hub, notebook state, pipeline polling
│   ├── components/
│   │   ├── sources/SourcesPanel.tsx   # Pillar 1 — ingestion
│   │   ├── chat/ChatPanel.tsx         # Pillar 2 — chat, citations, streaming
│   │   └── graph/KnowledgeGraphPanel.tsx  # Pillar 3 — WebGL graph
│   └── lib/
│       ├── api.ts                     # Sole HTTP broker (all backend calls)
│       ├── mock-data.ts               # Sandbox fallback stores
│       └── types.ts                   # Shared TypeScript interfaces
├── docs/
│   ├── API_CONTRACT.md
│   └── DEVELOPMENT_GUIDE.md
├── vite.config.ts                     # Port 3000, env injection
└── Dockerfile
```

---

## API broker (`src/lib/api.ts`)

All backend communication goes through this file.

| Setting | Value |
|---|---|
| Default base | `http://localhost:8000` |
| Override | `NEXT_PUBLIC_API_BASE_URL` in root `.env` |
| API prefix | `/api` appended automatically |
| On failure | Transparent fallback to `mock-data.ts` — no red error screens |

**Rules:**
- Components must not use `fetch` directly for InsightNote APIs
- Never expose raw IDs (`doc-*`, `chunk-*`, `job_*`) or local paths in UI copy
- Citations show only documents explicitly referenced in the answer

---

## UI behavior (must follow)

These rules are enforced in [AGENTS.md](../AGENTS.md) and detailed in linked docs.

| Area | Rule |
|---|---|
| **Chat loading** | Bouncing dots in assistant bubble — no skeleton paragraphs |
| **Streaming** | Pulsing inline cursor on last line while `isStreaming` |
| **Graph query focus** | Cyan `#38bdf8` on active reasoning path; dim unrelated nodes |
| **Graph ingest focus** | Emerald `#10b981` on nodes/links from newly `ready` document (one-shot) |
| **Reset view** | Clears all highlights; call `fgRef.current.refresh()` on highlight change |
| **Progress copy** | User-facing stage labels only — no raw job IDs or backend log prefixes |

See [../docs/GRAPH_VISUALIZATION.md](../docs/GRAPH_VISUALIZATION.md) · [../docs/GROUNDED_CITATIONS.md](../docs/GROUNDED_CITATIONS.md)

---

## Running locally

```bash
# Backend must be running first (see backend/README.md)
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

### Production build

```bash
npm run build    # output: dist/
```

Required before every push — see [../CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Docker

Frontend runs via root `docker-compose.yml` on port **3000** with hot-reload volume mount.

```bash
docker compose up -d frontend
# or full stack:
docker compose up -d --build
```

---

## Documentation

| Document | Content |
|---|---|
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md) | REST endpoints & JSON schemas |
| [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md) | Components, streaming, WebGL details |
| [../docs/SETUP.md](../docs/SETUP.md) | Environment configuration |
| [../docs/DEMO_DATA.md](../docs/DEMO_DATA.md) | Sandbox & mock data |
| [../docs/GRAPH_VISUALIZATION.md](../docs/GRAPH_VISUALIZATION.md) | Graph colors, particles, refresh |
| [../docs/GROUNDED_CITATIONS.md](../docs/GROUNDED_CITATIONS.md) | Citation cards & streaming order |
| [../backend/docs/BENCHMARKING.md](../backend/docs/BENCHMARKING.md) | Benchmark charts (mirrored under `docs/images/benchmark/`) |

---

## Key dependencies

| Package | Purpose |
|---|---|
| `react-force-graph-3d` | 3D WebGL knowledge graph |
| `three@^0.184.0` | Single Three.js instance (deduplicated in Vite) |
| `framer-motion` | Chat panel animations |
| `lucide-react` | Icons |
| `pdfjs-dist` / `react-pdf` | PDF citation viewer |

---

## Screenshots

| Dashboard | Workspace |
|---|---|
| ![Dashboard](docs/images/dashboard_main_view.png) | ![Workspace](docs/images/workspace_main_view.png) |
