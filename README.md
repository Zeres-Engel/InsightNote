# 🎨 InsightNote — Connected GraphRAG Multi-Notebook Workspace

> Transform messy documents into clean, interconnected, and isolated multi-notebook knowledge bases.

InsightNote is a state-of-the-art **Multi-Notebook GraphRAG knowledge workspace** (similar to NotebookLM, but powered by interactive graph databases). It features a gorgeous glassmorphic three-column interface combining **Hybrid GraphRAG retrieval**, **collapsible reasoning logs**, and a **live 3D force-directed knowledge graph** representation.

By orchestrating **Neo4j** (Graph Database), **Qdrant** (Vector Database), **MongoDB** (Metadata store), and **PostgreSQL** (Conversational persistence) under an isolated namespace model, InsightNote delivers absolute citation groundedness, precise layout coordinates, and responsive conversational thread memory.

---

## 🌟 Dynamic Multi-Workspace Technology

Unlike flat, single-collection RAG search tools, InsightNote is built for **true multi-notebook scaling**. Switching notebooks dynamically partitions the underlying database instances:
*   **Vector Isolation**: Qdrant collections are created on the fly with the active `notebook_id` as a namespace prefix.
*   **Graph Isolation**: All extracted Nodes and Relationships are dynamically prefixed and queries are isolated in Neo4j using a specialized **Workspace label identifier**.
*   **Conversational Isolation**: PostgreSQL hosts isolated chat histories where conversations are dynamically tracked exclusively under their parent `notebook_id`.

---

## 📸 Core Visual Journey

### 1. Live Progressive User Ingestion
Watch the pipeline parse layout blocks, perform chunking, extract semantic entities and relationships, and index them into Neo4j and Qdrant in real-time as files are uploaded.
![InsightNote Interactive Ingestion](docs/images/ingest.gif)

### 2. Layout-Aware Multimodal Processing
InsightNote parses complex layouts (multi-column text, LaTeX formulas, and sections) with sub-pixel coordinate precision (`bbox` coordinates) using MinerU to construct hierarchical knowledge representations.
![InsightNote Multimodal Processing](docs/images/Multimodal-Processing.png)

### 3. Redesigned Glassmorphic Dashboard
Our premium landing dashboard provides clear, high-tech metrics summarizing Active Notebooks, Ingested Documents, and Live Database sync metrics.
![InsightNote Redesigned Dashboard](docs/images/dashboard.png)

### 4. The 3-Column Interactive Workspace
Ingest files on the left, Q&A with conversational LLM reasoning in the middle, and watch your 3D Knowledge Graph bend, curve, and glow on the right!
![InsightNote 3-Column Workspace with 3D Graph](docs/images/workspace.png)

### 5. Interlocking 3D Navigation Guide
Rotate, Pan, Zoom, and click nodes smoothly while taking advantage of our helpful built-in navigation guide overlay.
![InsightNote 3D Navigation Guide](docs/images/navigation_guide.png)

---

## 🚀 Key Features

*   **Pillar 1: Sources / Notebook Panel (Left Column)**:
    *   Add URLs (with automated server-side crawling).
    *   Add raw Text Notes (saved and indexed in the background).
    *   PDF Drag & Drop or file upload (processed by the real MultiRAG OCR/MinerU parser pipeline).
    *   **Garbage Bin Purges 🆕**: Click the red trash icon next to any document to cleanly remove it from the index list (and databases).
*   **Pillar 2: Conversational Chat Q&A & Copilot (Middle Column)**:
    *   Responsive chat thread with streaming capabilities and markdown rendering.
    *   **PostgreSQL Conversation History 🆕**: Persistent thread management. All custom messages are fed directly into the live LLM + ZeRAG engine.
    *   **Grounded Citations**: Source cards appear below answers, showing exactly where facts are retrieved from.
    *   **Collapsible Retrieval Steps**: Explains precisely what the GraphRAG pipeline did (entity lookups, semantic connections found, vector search results, and reranking thresholds).
*   **Pillar 3: WebGL 3D Force-Directed Graph (Right Column)**:
    *   **3D WebGL Force Graph**: Fully interactive, panning, zooming, and dragging.
    *   **Auto slow-rotation camera 🆕**: Slowly rotates the graph in 3D space to provide a live, cinematic representation.
    *   **Active Traversal Highlighting**: Asking a question highlights the exact retrieval path in gold/orange. Non-path nodes are dimmed, and light particles animate down relationships!
    *   **Properties Inspector**: Clicking a node slides up a properties tray displaying custom JSON attributes.

---

## 🛠 Tech Stack

*   **Frontend**: React (Vite) + TypeScript + Tailwind CSS + Lucide Icons + Framer Motion + `react-force-graph-3d` (WebGL/Three.js).
*   **Backend**: FastAPI + Pydantic + PostgreSQL (Chat History) + MongoDB (Doc Status & Metadata) + Neo4j (GraphDB) + Qdrant (VectorDB) + BAAI/bge-reranker-v2-m3.

---

## 📖 Component Documentation Map

For deep development configurations and architecture details, please refer to:
*   📁 **[`frontend/README.md`](frontend/README.md)**: Frontend components layout, state bindings, three-column design specs, and WebGL setups.
*   📁 **[`backend/README.md`](backend/README.md)**: Backend directory structure, routing schemas, local setup instructions, and database volume maintenance.
*   📁 **[`backend/docs/RAG_ARCHITECTURE.md`](backend/docs/RAG_ARCHITECTURE.md)**: Deep breakdown of the coordinate-aware extraction pipeline, multi-database tri-service orchestration, and querymodes.

---

## ⚡ Quick Start (Docker Compose)

Running the entire stack, including all 4 databases and both applications, is as simple as:

### 1. Configure Environment Variables
Copy the `.env.example` file to `.env` in the root directory:
```bash
cp .env.example .env
```
Open `.env` and fill in your **OpenAI API Key**:
```env
OPENAI_API_KEY=sk-your-openai-key-here
```

### 2. Launch the Application Stack
Run the docker compose start command:
```bash
docker compose up -d --build
```

### 3. Open your browser
*   **Frontend Client Interface**: `http://localhost:3000`
*   **FastAPI Backend Health**: `http://localhost:8000/api/health`
*   **FastAPI Swagger Docs**: `http://localhost:8000/docs`
*   **PostgreSQL Adminer Dashboard**: `http://localhost:8082`

---

*InsightNote makes GraphRAG visible. Enjoy building!*
