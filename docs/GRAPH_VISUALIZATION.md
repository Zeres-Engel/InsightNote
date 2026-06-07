# WebGL 3D Graph Visualization

Technical reference for the right-column knowledge graph panel (`frontend/src/components/graph/KnowledgeGraphPanel.tsx`).

![3D Knowledge Graph Panel](images/workspace_viewport.png)

---

## 1. Rendering stack

```txt
KnowledgeGraphPanel.tsx
        │
        ├── react-force-graph-3d  (WebGL canvas)
        ├── three@^0.184.0      (single deduplicated instance in package.json)
        └── d3-force-3d           (physics simulation)
```

- **OrbitControls** — pan, zoom, drag; gentle auto-rotation when idle (`autoRotateSpeed = 0.5`)
- **ResizeObserver** — resizes canvas when the right panel width changes
- **Curved links** — `linkCurvature={0.15}`, directional arrows on relationships

---

## 2. Highlight modes

`GraphPath` includes an optional `mode` field:

```typescript
interface GraphPath {
  node_ids: string[];
  link_ids: string[];
  mode?: "ingest" | "query" | "manual";
}
```

| Mode | Color | When |
|---|---|---|
| **`query`** (default) | Cyan `#38bdf8` | Chat reasoning path from `/chat` response |
| **`ingest`** | Emerald `#10b981` | New nodes/links after a document reaches `ready` |
| **`manual`** | Cyan | User-initiated node focus |

### Visual behavior

- **Active path nodes** — enlarged `val`, glow halo, full opacity
- **Active path links** — wider width, directional particles (`linkDirectionalParticles`)
- **Non-path elements** — dimmed (reduced opacity) while a highlight is active
- **Reset View** — clears all highlights and restores default styling

> Previous docs described orange-gold highlights. The current implementation uses **cyan for query** and **emerald for ingest** (see `AGENTS.md`).

---

## 3. Particle style recycling

`react-force-graph-3d` can leave stale particles when highlight state changes. InsightNote uses a triple-lock plus imperative refresh:

1. Set particle **count** to `0` when no active highlight
2. Set particle **width** to `0`
3. Set particle **speed** to `0`
4. Call `fgRef.current.refresh()` in a `useEffect` hooked to `highlightPath` changes

This ensures old relationship glows and particles are fully cleared before new highlights render.

---

## 4. Ingest focus (one-shot)

Graph ingest focus fires **once** when a document transitions to `ready`:
- Only nodes/relationships **newly added** by that document are highlighted in emerald
- Does not re-trigger while ingestion is still processing

---

## 5. Neighbor expansion API

```
GET /api/notebooks/{notebook_id}/graph/node/{node_id}/neighbors
```

- Undirected Cypher match: `(n)-[r]-(m)` within workspace label
- Properties sanitized (no `source_id`, `doc_id`, `chunk_id`, `track_id`)
- Falls back to mock graph data if Neo4j is offline

Legacy alias: `GET /api/graph/node/{node_id}/neighbors`

---

## 6. Camera focus on path change

When `highlightPath.node_ids` updates (query mode only):

1. Compute 3D centroid of highlighted nodes
2. Animate camera with `fgRef.current.cameraPosition(from, lookAt, 1800)` over 1.8 seconds
3. Auto-rotation pauses during user drag, resumes on release

---

## 7. Node type colors (default)

| Entity type | Color |
|---|---|
| Document | Emerald `#10b981` |
| Clause / section | Blue tones |
| Other entities | Palette by `group` field |

Colors apply in default (non-highlighted) state only.
