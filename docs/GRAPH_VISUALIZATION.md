# 🌐 WebGL 3D Graph Visualization & Animation Engine

This document details the advanced engineering principles behind InsightNote's interactive **WebGL 3D Knowledge Graph** panel. It explains the integration of `react-force-graph-3d`, sub-pixel coordinate alignment, path-highlighting animation mechanics, and the smooth camera target-focus algorithm.

---

## 🎨 1. Interactive 3D WebGL Rendering Engine

The right column of InsightNote features a high-performance, physics-directed 3D network graph built using **Three.js** and **WebGL** via the `react-force-graph-3d` library. It visualizes the active entities and relationships extracted from Neo4j (DozerDB).

![3D Knowledge Graph Panel](images/workspace_viewport.png)

```txt
  ┌────────────────────────────────────────────────────────┐
  │                 KnowledgeGraphPanel.tsx                │
  └───────────────────────────┬────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
  ┌───────────────────┐               ┌───────────────────┐
  │  Three.js Camera  │               │ d3-force-3d Engine│
  │ (OrbitControls)   │               │ (Physics Layout)  │
  └─────────┬─────────┘               └─────────┬─────────┘
            │                                   │
            └─────────────────┬─────────────────┘
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │                   WebGL Canvas                         │
  │  (Renders Nodes, Links, Textures, & Pulsing Particles) │
  └────────────────────────────────────────────────────────┘
```

*   **d3-force-3d Simulation**: Nodes are treated as physical particles with mass, charges, and mutual repulsions. Relationships act as elastic springs pulling connected nodes together. The engine runs a continuous numerical integration loop to solve particle positions in real-time, resulting in an organic, self-organizing 3D structure.
*   **Performance Optimization**: To maintain a consistent 60 FPS under massive document graph datasets, the canvas utilizes GPU-accelerated WebGL geometry caching.

---

## ⚡ 2. Reasoning Path Highlighting & Glowing Pulses

When the user queries the chatbot in the middle column, the backend returns a `graph_path` payload containing the specific node and link IDs traversed by the ZeRAG engine:

```json
{
  "graph_path": {
    "node_ids": ["policy_001", "coverage_012", "vehicle_accident_007"],
    "link_ids": ["edge_001", "edge_002"]
  }
}
```

The **`KnowledgeGraphPanel.tsx`** hooks directly into this state, dynamically updating rendering shaders on the WebGL canvas:

### 1. Active Node Highlight & Growth
*   **Default State**: Nodes render as compact 3D spheres (default size `1.5`) painted with colors corresponding to their entity type (e.g., emerald for documents, blue for clauses).
*   **Highlighted State**: Nodes belonging to the `graph_path.node_ids` are painted a vibrant orange-gold (`#fbbf24`) and their size value `val` is dynamically grown to `3.5` to emphasize their importance.
*   **Dimmed State**: If a path is highlighted, all non-path nodes are instantly dimmed by reducing their opacity to `0.25` and painting them gray, focusing the user's attention entirely on the AI's reasoning path.

### 2. Directional Particle Glow (Pulsing Links)
*   Relationships matching `graph_path.link_ids` are colored amber (`#f59e0b`) and expanded in width.
*   The engine injects glowing, golden directional energy light pulses traveling down active links to visually represent RAG query traversals.

---

## 🛡️ 3. Particle Style Recycling (Triple-Lock Safety)

In older versions of `react-force-graph-3d`, there is a notorious rendering bug where changing `linkDirectionalParticles` to `0` leaves existing in-flight particles frozen or floating infinitely in space because the Three.js render loop stops updating their coordinates without actually deleting them from the scene.

InsightNote solves this completely using a **Triple-Lock** particle recycling approach.

### The Triple-Lock Solution:
*   **Lock 1: Particles Count**: Sets particle count to `0` when `link.width <= 1.5` or when there is no active highlight.
*   **Lock 2: Particles Width**: Sets the particle visual width (`linkDirectionalParticleWidth`) explicitly to `0` to make them completely invisible.
*   **Lock 3: Particles Speed**: Sets the speed of particles (`linkDirectionalParticleSpeed`) to `0` to prevent any further animations.
*   **Imperative Refresh**: A `useEffect` hook listens to `highlightPath` and `newlyIngestedNodeIds` and triggers an imperative refresh on the WebGL scene, forcing Three.js to recycle the line shaders and completely clear old particles:
    ```typescript
    useEffect(() => {
      if (fgRef.current) {
        fgRef.current.refresh();
      }
    }, [highlightPath, newlyIngestedNodeIds]);
    ```

---

## 🔍 4. Undirected Neighbor Expansion API

InsightNote features a rich neighboring links expansion API (`/graph/node/{node_id}/neighbors`) that allows users to explore connected entities interactively.

### Execution Flow:
1.  **Undirected Cypher Match**: When a node is clicked, the backend executes a highly optimized, undirected neighbor matching query in Neo4j:
    ```cypher
    MATCH (n:`{workspace_label}` {entity_id: $node_id})
    OPTIONAL MATCH (n)-[r]-(m:`{workspace_label}`)
    RETURN r, n, m
    ```
2.  **Privacy Redaction**: Filters out internal database columns and identifiers (`source_id`, `doc_id`, `chunk_id`, `track_id`) from the neighbor nodes' and edges' properties before serialization.
3.  **High-Fidelity Sandbox Fallback**: If Neo4j is offline or fails to connect, the API catches the exception, logs a warning, and gracefully falls back to returning designated in-memory mocks (`MOCK_NODES_RESUME` or `MOCK_NODES_INSURANCE`), preventing any frontend sập (crashes).

---

## 🎥 5. Smooth Camera Target-Focus Algorithm

To prevent the user from getting lost in 3D space, the panel implements an automated, buttery-smooth camera target-tracking and auto-zoom algorithm.

### 1. Spatial Average Centering
When the reasoning path updates, the system calculates the exact 3D coordinate average (bounding box center) of the highlighted nodes:

$$\bar{X} = \frac{1}{N}\sum_{i=1}^{N} X_i, \quad \bar{Y} = \frac{1}{N}\sum_{i=1}^{N} Y_i, \quad \bar{Z} = \frac{1}{N}\sum_{i=1}^{N} Z_i$$

### 2. Smooth Transition (Camera HUD)
Using the calculated coordinates, the camera performs an interpolating flight transition (1.8 seconds) to focus on the reasoning center, automatically adjusting the camera zoom:
```typescript
fgRef.current.cameraPosition(
  { x: avgX, y: avgY, z: avgZ + 120 }, // Position camera offset on Z-axis
  { x: avgX, y: avgY, z: avgZ },       // LookAt target center
  1800                                 // Duration in milliseconds
);
```

### 3. Gentle Auto-Rotation (Living Presentation)
When there is no active user drag interaction, the camera slowly rotates around the graph center at a gentle speed (`autoRotateSpeed = 0.5`) to keep the visual presentation dynamic and alive. Click-dragging anywhere instantly yields control to the user.
