# 🎨 InsightNote - Frontend Development Guide

Welcome to the **InsightNote** Frontend development guide. This document provides a deep, comprehensive overview of the Frontend structure, the 3-column layout coordination, WebGL 3D Graph optimizations, and the offline fallback engine.

---

## 🏗️ 1. Project Directory Layout

The frontend is structured to keep UI presentation, state coordination, and data ingestion strictly modularized:

```txt
frontend/
├── docs/
│   ├── API_CONTRACT.md         # Full request/response API specifications
│   └── DEVELOPMENT_GUIDE.md    # [This File] Frontend architecture guide
├── src/
│   ├── components/
│   │   ├── chat/
│   │   │   └── ChatPanel.tsx   # Pillar 2: Copilot Chat with Citations & Steps
│   │   ├── graph/
│   │   │   └── KnowledgeGraphPanel.tsx # Pillar 3: WebGL 3D relation graph
│   │   └── sources/
│   │       └── SourcesPanel.tsx # Pillar 1: Ingest panel & pipeline tracker
│   ├── lib/
│   │   ├── api.ts              # Data broker connecting to FastAPI (with fallbacks)
│   │   ├── mock-data.ts        # Dynamic mock stores (Insurance & Resume Q&A)
│   │   └── types.ts            # Shared strictly-typed TypeScript definitions
│   ├── App.tsx                 # Core Hub orchestrating layout & state sync
│   ├── index.css               # Global Tailwind CSS configurations
│   └── main.tsx                # React ReactDOM bootstrapper
├── Dockerfile                  # Production-ready docker environment
├── tailwind.config.js          # Tailwind theme and accent palette config
└── vite.config.ts              # Vite bundle configuration
```

---

## 🎨 2. The 3-Column State Coordination (`App.tsx`)

`App.tsx` acts as the single source of truth for the entire workspace. To prevent component lag and ensure reactive rendering, the three columns communicate solely by listening to central state variables:

```txt
                       ┌───────────────┐
                       │    App.tsx    │ (Coordinating Hub)
                       └───────┬───────┘
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
   ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
   │  SourcesPanel  │ │   ChatPanel    │ │  KnowledgeGraph│
   │   (Pillar 1)   │ │   (Pillar 2)   │ │   (Pillar 3)   │
   └────────────────┘ └────────────────┘ └────────────────┘
```

*   **Pillar 1 (Left: Ingestion)**: Triggers file/URL upload. When indexing, it monitors the `pipelineJob` status, which is polled inside a React `useEffect` interval (every 1.5 seconds) in `App.tsx`.
*   **Pillar 2 (Middle: Copilot Chat)**: Collects text queries, appends full conversation history, and invokes `api.askChat`. On response, it updates `messages` and passes the traversed `graph_path` back to `App.tsx`.
*   **Pillar 3 (Right: 3D Graph)**: Listens to the `graphData` and `highlightPath` states. It displays active reasoning paths using pulsing glowing particles traveling along the links and centers the camera automatically.

---

## 🌐 3. WebGL 3D Graph Optimization & Controls (`KnowledgeGraphPanel.tsx`)

The WebGL 3D Graph uses `react-force-graph-3d` powered by **ThreeJS**. The following high-performance enhancements are implemented:

1.  **Deduplicated ThreeJS Engine**: The dependencies are synchronized at `three@^0.184.0` in `package.json` to prevent multiple conflicting instances of ThreeJS. This guarantees WebGL canvases render cleanly without throwing black screens.
2.  **Parent Dimension Measurement (`ResizeObserver`)**: A custom `ResizeObserver` is attached to the parent div container. It dynamically feeds pixel dimensions (`width` and `height`) to the `<ForceGraph3D>` component. This aligns the camera coordinate center precisely to the visual area of the right panel, preventing graph nodes from shifting off-screen.
3.  **Auto slow-rotation camera**: Utilizes the native ThreeJS `OrbitControls` auto-rotation:
    ```typescript
    const controls = fgRef.current.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5; // slow, gentle, buttery-smooth rotation
    }
    ```
    This slow rotation engages the viewer. Dragging with the mouse naturally overrides it and resumes once mouse interaction ends.
4.  **Directional arrows & Curvatures**:
    *   `linkCurvature={0.15}` curves the relationship lines, creating an elegant, organic visual network instead of straight overlapping lines.
    *   `linkDirectionalArrowLength={3.5}` and `linkDirectionalArrowRelPos={1.0}` display arrowhead directories indicating the flow of relationship dependencies.

---

## 🛡️ 4. Dynamic Sandbox Fallback Architecture (`api.ts`)

A key pillar of InsightNote's robustness is **transparent error boundary switching** at the API broker level:

```typescript
export async function getGraph(notebookId: string): Promise<GraphResponse> {
  try {
    const res = await fetch(`${BASE_URL}/notebooks/${notebookId}/graph`);
    if (res.ok) return await res.json();
    throw new Error();
  } catch (e) {
    // If backend is unreachable or returns non-ok, transparently fall back
    console.warn("Backend down. Loading mock graph data instead.");
    return notebookId.includes("resume") 
      ? { nodes: resumeNodes, links: resumeLinks }
      : { nodes: [...MOCK_NODES], links: [...MOCK_LINKS] };
  }
}
```

*   **Self-healing Local Stores**: In fallback mode, `api.ts` maintains its own `let` stores (`localNotebooks` and `localSources`) representing local states.
*   **Wiped Items Sync**: When a user clicks **Delete Document** or **Delete Notebook** in fallback mode, `api.ts` runs a `.filter` array re-assignment on its local store, immediately updating the UI as if a real database transaction successfully completed.

---

## ⚡ 5. Setup & Launch Instructions

### 1. Local Run
To run the frontend dev server locally on your host machine:
```bash
cd frontend
npm install
npm run dev
```
The server will boot up and serve the Vite application on port `3000`.

### 2. Docker Compose Stack
The frontend is pre-packaged with a hot-reload volume mount inside the general docker-compose configuration.
To spin up the entire multi-notebook stack (databases, backend FastAPI, and Vite frontend):
```bash
docker compose up -d --build
```
*   **Vite Dev Server URL**: `http://localhost:3000`
*   **FastAPI Backend URL**: `http://localhost:8000`
*   **Neo4j Browser URL**: `http://localhost:7474`
*   **Mongo Express admin URL**: `http://localhost:8081`
