# 🔌 Advanced Query Methods & Multi-Turn Conversation Architecture

This specification document details the core conversational architecture and retrieval mechanics of InsightNote's RAG query engine. It explains the multi-turn chat history resolution and the four distinct query modes supported by the backend: `naive`, `local`, `global`, and `mix`.

---

## 💬 1. Multi-Turn Conversation History Architecture

Conversational RAG requires the LLM to understand contextual references across multiple message turns (e.g. resolving pronouns like "What are *its* exclusions?" referring to a previously mentioned "Motorcycle policy").

```txt
  ┌────────────────────────────────────────────────────────┐
  │                   Vite Frontend                        │
  │  (Saves messages array & persists in localStorage)      │
  └───────────────────────────┬────────────────────────────┘
                              │
                              │ Post ChatRequest
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │                    FastAPI Router                      │
  │     (Maps payload to chat_history: List[Dict])         │
  └───────────────────────────┬────────────────────────────┘
                              │
                              │ Pass history to QueryParam
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │                    ZeRAG Query Engine                  │
  │ (Summarizes history ➔ Extracts contextual keywords)    │
  └────────────────────────────────────────────────────────┘
```

### The Multi-Turn Pipeline:
1.  **State Persistence**: The React frontend maintains the conversation thread inside the `messages` array, persisting it inside browser `localStorage` on a per-notebook basis.
2.  **API Shipping**: When a user submits a query, the frontend maps the history into a structured Pydantic `ChatRequest`:
    ```json
    {
      "message": "Does this policy cover motorcycle accidents?",
      "chat_history": [
        { "role": "user", "content": "Hello!" },
        { "role": "assistant", "content": "Hi! How can I help you research insurance?" },
        { "role": "user", "content": "Does this policy cover motorcycle accidents?" }
      ]
    }
    ```
3.  **Contextual Re-Writing**: The ZeRAG engine intercepts the `chat_history` and first requests the LLM to rewrite the current message into a standalone query. For example, *"Does this policy cover it?"* is rewritten into *"Does the main Insurance Policy cover motorcycle accidents?"* using prior conversation context. This rewritten query is then used for semantic database retrieval.

---

## 🧭 2. The Four RAG Query Modes

InsightNote supports four specialized RAG query modes, each optimized for different types of information abstraction:

| Mode | Database Target | Retrieval Approach | Best Suited For |
| :--- | :--- | :--- | :--- |
| **Naive (`naive`)** | Qdrant (Vector DB) | Standard Flat Dense Vector Similarity | Direct, single-paragraph lookup questions |
| **Local (`local`)** | Neo4j (Graph DB) | Entity-Centric Neighbor Triplets | Relationship-heavy, specific entity lookups |
| **Global (`global`)** | Neo4j (DozerDB) | Hierarchical Community Summary Scanning | Broad summaries, high-level thematic queries |
| **Mix (`mix`)** | Qdrant + Neo4j | Hybrid Vector + Relation Traversals | Complex multi-hop reasoning (Default) |

---

### 1. Naive Mode (`naive`)
This is the baseline flat vector RAG method. It completely bypasses the Neo4j knowledge graph.
*   **Retrieval loop**: The query is converted into a vector and searched in Qdrant. The top $k$ chunks are retrieved and fed to the LLM.
*   **Pros**: High retrieval speed, extremely simple.
*   **Cons**: Lacks relational awareness; cannot answer questions requiring connection between different documents or distant entities.

### 2. Local Mode (`local`)
This is an entity-centric GraphRAG mode, designed to fetch rich local neighborhoods of knowledge.
*   **Retrieval loop**: Extracts core entities from the prompt, queries Neo4j to pull their immediate nodes, attributes, and connected relationship triplets (e.g. `(Customer)-[:OWNS]->(Policy)`).
*   **Pros**: Highly precise for specific entity inquiries, lists properties and concrete facts with absolute citation grounding.
*   **Cons**: Struggles with broad, document-wide summaries.

### 3. Global Mode (`global`)
This is a community-centric GraphRAG mode designed for high-level summarizing questions (e.g., *"What are the primary structural differences between these policy templates?"*).
*   **Retrieval loop**: During graph indexing, Neo4j clusters nodes into hierarchical semantic communities using graph community algorithms (such as Leiden/Louvain). It generates pre-summarized LLM descriptions for each community. The global query scans these high-level community summaries instead of individual raw text chunks.
*   **Pros**: Captures broad, holistic themes across thousands of documents.
*   **Cons**: High token consumption, lacks sub-pixel paragraph details.

### 4. Mix Mode (`mix`) — Default
This is the flagship hybrid retrieval mode implemented by default in InsightNote, combining the best of flat vectors and entity graphs.
*   **Retrieval loop**:
    1.  Queries Qdrant for semantic similarity dense vector chunks.
    2.  Queries Neo4j to extract neighboring entity-relationship triplets.
    3.  Merges both contexts, removes duplicates, and passes them to a **Cross-Encoder Reranker** (`BAAI/bge-reranker-v2-m3`).
    4.  Feeds the highest-scoring hybrid context into the LLM.
*   **Pros**: Maximizes context density, performs complex multi-hop reasoning, and animates pulsing light particles along the traversed reasoning path in the 3D graph!
*   **Cons**: Requires both vector and graph databases to be fully synchronized.
