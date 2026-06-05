# 🎨 InsightNote Frontend — Connected GraphRAG Workspace Client

This is the front-end application of **InsightNote**, constructed using **Vite + React + TypeScript + Tailwind CSS** and **Three.js / react-force-graph-3d** for high-density, real-time interactive knowledge graph visualization.

---

## 🏗 Three-Column Responsive Layout

Our premium, glassmorphic workspace features a locked three-column layout, perfectly segmenting raw ingestion, reasoning conversations, and visual relations.

```txt
┌──────────────────────────────────────────────────────────────────────────────┐
│ InsightNote                                      Workspace: Active Notebook  │
├───────────────────────┬─────────────────────────────────┬────────────────────┤
│ Sources               │ Ask InsightNote                  │ Knowledge Graph    │
│                       │                                 │                    │
│ Add URL               │ ChatGPT-style messages           │ 3D Neo4j Graph     │
│ Add Text Note         │ Citations (Bbox highlighting)   │                    │
│ Upload PDF            │ Retrieval steps (Collapsible)   │ Highlighted path   │
│ Trash bin (Delete)    │ Composer                         │ Node details       │
│                       │                                 │ Navigation Guide   │
└───────────────────────┴─────────────────────────────────┴────────────────────┘
```

### 1. Left Column (Sources Panel — 320px)
*   **Multi-Notebook Switcher**: Choose from different Notebooks. Each triggers workspace isolation, isolating document directories, Qdrant vectors, and PostgreSQL chat histories.
*   **Source Crawling**: Ingest clean text from URLs or add instant rich Markdown notes.
*   **PDF Ingestion**: Drag-n-drop PDFs directly into the workspace. Shows live progress status badges synced with our backend task pipeline.
*   **Source Index**: List, view metrics (chunk size, entity relationships extracted), and delete files cleanly via the garbage bin buttons.

### 2. Middle Column (Chat Q&A Console — Flex-1)
*   **PostgreSQL Conversation Threads**: Fully persistent, multi-session chat historical records.
*   **Double-Payload Dynamic Stream**:
    *   **Phase 1**: Instantly receives and formats metadata, generating **Grounded Citations** cards and drawing active reasoning routes.
    *   **Phase 2**: Streams individual text tokens from the isolated LLM generator, rendering rich markdown with syntax code highlighting.
*   **Collapsible Retrieval Steps**: Unpacks the black-box of GraphRAG, explaining exact vector metrics, graph traversals, and reranking threshold logs.

### 3. Right Column (Knowledge Graph Panel — 480px)
*   **WebGL 3D Interactive Force Graph**: Complete zoom, rotation, and panning using WebGL.
*   **Slow-Rotation Camera Overlay**: Automatically rotates the graph slowly to provide a beautiful, cinematic overview of concepts.
*   **Interactive Traversal Highlighting**: Chatting with the AI dims the inactive canvas, lighting up the active reasoning path in gold, with glowing directional particle pulses moving down relationships.
*   **Properties Sliding Tray**: Clicking any node slides up a comprehensive inspect panel revealing deep attributes and confidence ratings.
*   **Automatic ResizeObserver**: Listens to column sizing and auto-adjusts the 3D canvas on the fly, centering nodes perfectly.

---

## 📖 Sub-Folder Documentation

For deeper developer setups, please explore:
*   📘 **[`frontend/docs/API_CONTRACT.md`](docs/API_CONTRACT.md)**: Query parameters, upload payloads, and response JSON formats.
*   📘 **[`frontend/docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md)**: Component directory structures, React state hook bindings, and WebGL graph styling variables.

---

## ⚡ Quick Start

### 1. Installation
Ensure Node.js (v18+) is installed.
```bash
cd frontend
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000` inside your browser.

### 3. Build for Production
To compile and test type-safety before pushing to git:
```bash
npm run build
```
The compiled build is output to the `/dist` folder.
