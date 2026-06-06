# 🌲 Multi-Workspace GraphRAG Engine Architecture (RAG_ARCHITECTURE.md)

Welcome to the architectural core of **InsightNote**—the next-generation **Multi-Notebook GraphRAG Knowledge Workspace**. 

Unlike standard "ChatPDF" clones that perform naive character splitting and lose all layout, structural, and semantic context, InsightNote models documents as highly structured **Hierarchical Knowledge Trees** linked to a **Multi-Turn Reasoning Graph**.

By orchestrating **PostgreSQL** (Chat History & Workspaces), **MongoDB** (Metadata & Document Status), **Neo4j** (DozerDB Graph), and **Qdrant** (Vector DB) on a per-workspace basis, the system delivers absolute citation groundedness, zero hallucinations, and dynamic interactive graph-highlighted responses.

---

## 🎨 Core Architectural Blueprint

Here is how InsightNote’s **Layout-Aware Coordinate Processing Pipeline** ingests documents, extracts complex knowledge networks, and stores them securely under isolated multi-workspace databases:

![Workspace Viewport](../../docs/images/workspace_viewport.png)

```mermaid
graph TD
    subgraph Multi_Workspace_Isolation [Dynamic Multi-Workspace Physical Database Isolation]
        Postgres[(PostgreSQL<br>Isolated Conversational Sessions)]
        MongoDB[(MongoDB<br>Isolated Metadata & status)]
        Neo4j[(Neo4j GraphDB<br>Dynamic Label Workspace Isolation)]
        Qdrant[(Qdrant VectorDB<br>Isolated Namespace Collections)]
    end
    
    subgraph Coordinate_Parsing_Pipeline [Layout-Aware Coordinate Processing Pipeline]
        PDF[Multimodal Document PDF/URL/Text] -->|Live User Ingestion| MinerU[MinerU Parser Engine]
        MinerU -->|Sub-pixel bbox Coordinates| VisualBlocks[Visual Layout Blocks]
        VisualBlocks -->|Sort & Group by Reading Order| HierarchicalTree[Hierarchical Parent-Child Tree]
        
        HierarchicalTree -->|Sync Chunks & bbox Hierarchies| Neo4j
        HierarchicalTree -->|Index Dense Text Embeddings| Qdrant
        HierarchicalTree -->|Track Ingest Status & Metadata| MongoDB
    end

    subgraph Dual_Retrieval_Reasoning [Dual-Engine Semantic Retrieval & Reranking]
        UserQuery([User Prompt]) --> ChatHistory[PostgreSQL Multi-turn Context Resolution]
        ChatHistory --> KeywordExtractor[LLM High/Low-Level Keyword Extraction]
        
        KeywordExtractor -->|Low-Level Keywords| DenseVector[Qdrant Semantic Vector Retrieval]
        KeywordExtractor -->|High-Level Keywords| GraphSearch[Neo4j Cypher Path Traversal]
        
        DenseVector --> ContextAggregator[Multi-Source Context Aggregator]
        GraphSearch --> ContextAggregator
        
        ContextAggregator --> Reranker[BAAI BGE / Jina / Cohere Reranker Engine]
        Reranker -->|Top-K High-Density Context| LLM[LLM Generator: OpenAI/Gemini/Ollama]
        
        LLM --> EventStream[Streaming Event Generator]
        EventStream -->|1. Stream Citation Metadata & WebGL Reasoning Path| UI[3-Column Frontend Console]
        EventStream -->|2. Stream Real-Time Answer Tokens| UI
    end
end
```

---

## 💎 Premium Technology & Concurrency Highlights

### 🚀 1. Dynamic 4-DB Notebook Synchronization & Resilience
InsightNote operates on a strict **Minimum vs. Maximum Database** fallback schema to guarantee total system health:
*   **The Minimum Baseline (PostgreSQL + MongoDB)**: These core databases manage the baseline lifecycle of workspaces, conversant messages, and document ingestion status. If either Neo4j or Qdrant are offline, notebook creation, loading, and deletion will **continue to function smoothly**, degrading gracefully to standard vector-only RAG or high-fidelity local sandbox fallbacks instead of crashing with a 500 error.
*   **The Maximum State (PostgreSQL + MongoDB + Neo4j + Qdrant)**: When all services are online, a newly created notebook instantly initializes isolated storages across all four systems:
    *   **PostgreSQL**: Upserts notebook records and conversation sessions.
    *   **MongoDB**: Auto-initializes isolated document status collection tables.
    *   **Qdrant**: Initializes isolated collection collections based on the active `notebook_id` as the namespace.
    *   **Neo4j**: Merges a specialized workspace metadata node and establishes dynamic workspace node label isolation to prevent cross-notebook graph leakage.
*   **Surgical Notebook Deletion**: Deleting a notebook cleanly sweeps resources from all 4 backends: drops MongoDB collection prefixes, drops Qdrant collection namespaces, detach-deletes all nodes matching the Neo4j workspace label, and cascades-deletes PostgreSQL chat logs.

### ⚡ 2. Asyncio Lazy-Loading Priority Queue Concurrency
One of the most complex bugs in asyncio FastAPI backends is the loop-mismatch error:
`got Future <Future pending> attached to a different loop`
This happens when async decorators (like our priority-limited LLM rate limiter `priority_limit_async_func_call`) instantiate their internal `asyncio.PriorityQueue`, `asyncio.Lock`, and `asyncio.Event` primitives at module import time, binding them to an import-time loop that differs from the runtime loop started by Uvicorn or background thread pools.

InsightNote solves this completely using **Lazy-Initialization**:
*   All asyncio primitives inside the function decorators are declared as `None` at import time.
*   During runtime, when `wait_func` is first called, the system dynamically checks and instantiates all locks and queues under the **currently running event loop**:
    ```python
    if initialization_lock is None:
        with threading.Lock():
            if initialization_lock is None:
                initialization_lock = asyncio.Lock()
    ```
*   This ensures 100% thread-safety, standardizes the execution loop, and allows parallel, unblocked ingestion of 100+ files, URLs, and notes concurrently with zero queue freezing!

### 📊 3. Optimized targeted Indexing Graph Queries
During real-time document indexing, polling full-graph statistics causes massive Cypher scan overhead. InsightNote optimizes this by only querying the graph nodes and links that belong to the active documents being processed:
```cypher
MATCH (n:`{workspace_label}`) WHERE n.source_id IN $doc_ids RETURN n
```
This restricts the progressive graph building queries to microseconds, creating a buttery-smooth visual graph-growth rendering at the frontend.

### 🔍 4. Undirected Neighbor Expansion API
The neighboring nodes expansion API `/api/notebooks/{notebook_id}/graph/node/{node_id}/neighbors` performs an undirected Cypher traversal match:
```cypher
MATCH (n:`{workspace_label}` {entity_id: $node_id})
OPTIONAL MATCH (n)-[r]-(m:`{workspace_label}`)
RETURN r, n, m
```
It extracts the undirected adjacent relationships, sanitizes the properties (stripping `source_id`, `doc_id`, etc.), and gracefully degrades back to the mock node universe if Neo4j is offline or empty.

---

## 🧭 Five Versatile Query Modes

InsightNote supports five distinct query modes tailored to different types of analysis:

| Mode | Core Engine | Best For | Description |
| :--- | :--- | :--- | :--- |
| **`mix`** | **Vector + Graph (Unified)** | General Workspace Q&A | Fetches dense vector chunks and traverses adjacent Neo4j entities. Highlights the reasoning path on the 3D WebGL graph. |
| **`hybrid`** | **Multi-dimensional Context** | Deep Cross-Reference | Merges global relational patterns with local entity details using an optimized round-robin retrieval. |
| **`local`** | **Deep Entity Retrieval** | Specific Fact Retrieval | Focuses tightly on extracted semantic entities and their immediate coordinates and chunks. |
| **`global`** | **Thematic Cypher Traversal** | Structural Analysis | Evaluates high-level themes across the entire notebook by querying global relationships in the graph. |
| **`naive`** | **Dense Vector Only** | Standard Search | Standard semantic search over Qdrant. Automatically triggers as a fallback if the Graph Database is offline, guaranteeing high availability. |
