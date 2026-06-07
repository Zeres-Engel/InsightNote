# InsightNote Frontend

Vite + React + TypeScript client for the three-column GraphRAG workspace.

---

## Layout

```txt
┌───────────────────────┬─────────────────────────────────┬────────────────────┐
│ SourcesPanel (320px)  │ ChatPanel (flex-1)            │ KnowledgeGraph (480px)
│ URL / note / PDF      │ Streaming chat + citations      │ 3D force-directed graph
│ Pipeline badges       │ Retrieval steps (collapsible)   │ Path highlights
│ Delete sources        │ Preset action pills             │ Node properties drawer
└───────────────────────┴─────────────────────────────────┴────────────────────┘
```

State is coordinated centrally in **`App.tsx`** — pillars communicate via shared props, not direct API calls to each other.

---

## Directory structure

```txt
frontend/
├── src/
│   ├── App.tsx                        # Layout hub, notebook state, pipeline polling
│   ├── components/
│   │   ├── sources/SourcesPanel.tsx   # Pillar 1 — ingestion
│   │   ├── chat/ChatPanel.tsx         # Pillar 2 — chat & citations
│   │   └── graph/KnowledgeGraphPanel.tsx  # Pillar 3 — WebGL graph
│   └── lib/
│       ├── api.ts                     # HTTP broker (all backend calls)
│       ├── mock-data.ts               # Sandbox fallback data
│       └── types.ts                   # Shared TypeScript interfaces
├── docs/
│   ├── API_CONTRACT.md
│   └── DEVELOPMENT_GUIDE.md
├── vite.config.ts                     # Port 3000, env injection
└── Dockerfile
```

---

## API broker

All backend communication goes through **`frontend/src/lib/api.ts`**.

- Base URL: `http://localhost:8000/api` (override via `NEXT_PUBLIC_API_BASE_URL` in `.env`)
- On fetch failure → transparent fallback to `mock-data.ts` local stores
- Never call databases directly from components

---

## Running locally

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

### Production build

```bash
npm run build
```

Output: `frontend/dist/`

---

## Docker

Frontend runs in Docker via root `docker-compose.yml` on port 3000 with hot-reload volume mount.

```bash
docker compose up -d frontend
```

---

## Documentation

| Document | Content |
|---|---|
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md) | REST endpoints & JSON schemas |
| [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md) | Component architecture & WebGL details |
| [../docs/SETUP.md](../docs/SETUP.md) | Environment configuration |
| [../docs/DEMO_DATA.md](../docs/DEMO_DATA.md) | Sandbox & mock data |
| [../docs/GRAPH_VISUALIZATION.md](../docs/GRAPH_VISUALIZATION.md) | Graph highlight colors & particles |

---

## Key dependencies

| Package | Purpose |
|---|---|
| `react-force-graph-3d` | 3D WebGL graph |
| `three@^0.184.0` | Single Three.js instance (deduplicated) |
| `framer-motion` | Chat panel animations |
| `lucide-react` | Icons |
| `pdfjs-dist` / `react-pdf` | PDF citation viewer |
