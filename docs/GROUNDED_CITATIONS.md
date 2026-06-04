# 📜 Grounded Citations & Progressive Reasoning System

This specification document details the design and implementation of InsightNote's core **Grounded Citation** mechanics and **Progressive Retrieval Log** console. It details how the system guarantees absolute semantic context truth, links vector-chunks directly to sub-pixel coordinates, and renders an interactive terminal-style reasoning UI.

---

## 🚫 1. Solving LLM Hallucinations via Coordinate Linking

Standard RAG systems present answers with inline references, but clicking them only points to a general PDF document name. If the document is 200 pages long, the user still suffers from information fatigue.

InsightNote solves this by linking **Qdrant Vector Points** directly to **Neo4j Bbox Coordinates**:

```txt
┌──────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│ Qdrant Dense     │     │ Neo4j Chunk Node   │     │ Frontend PDF       │
│ Vector Search    ├────➔│ (Retrives page num │────➔│ Highlight Overlay  │
│ (Top-k similarity│     │ & bbox coordinates)│     │ (Draws red box on  │
│ chunk matching)  │     │                    │     │ exact page region) │
└──────────────────┘     └────────────────────┘     └────────────────────┘
```

### The Provenance Chain:
1.  **Vector Match**: Qdrant identifies the highest-scoring text segment based on semantic vector similarity.
2.  **Topological Lookup**: Neo4j resolves the segment's Node ID, pulling:
    *   `content`: The raw text string.
    *   `page_number`: The exact physical page index where the paragraph resides.
    *   `bbox`: The MinerU visual bounding box array `[x_min, y_min, x_max, y_max]`.
3.  **Grounding Delivery**: The FastAPI router wraps these variables inside a `CitationItem` response array.
4.  **UI Render**: The chat panel displays **Citation Cards** below the answer, showing the exact source document title, page, similarity percentage score, and text snippet. Clicking the card triggers the PDF viewer to open the exact page and draw a semi-transparent red highlight overlay matching the `bbox` boundaries!

---

## 🛠️ 2. Collapsible Progressive Reasoning (Terminal Console)

To build user trust in corporate and medical applications, the AI must explain *how* it arrived at its conclusion. 

The middle chat panel features a collapsible **Retrieval & Reasoning Steps** console styled as an interactive, dark terminal window:

```txt
┌──────────────────────────────────────────────────────────────────────────────┐
│ >_ RETRIEVAL & REASONING STEPS (4)                                         ▲ │
├──────────────────────────────────────────────────────────────────────────────┤
│ > Extracted key entities: Policy, Coverage, Main                             │
│ > Retrieved Section 1.1 (Core Liability Coverage) from 'Insurance Policy'    │
│ > Traversed graph path from Policy -> HAS_COVERAGE -> Coverage               │
│ > Generated grounded answer with citations                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### The Logs Generation Loop:
*   During retrieval, the ZeRAG engine logs each milestone inside a Python string array (e.g. key extraction, similarity parameters, Cypher traversal queries, reranking outputs).
*   This array is delivered via the `retrieval_steps` response field.
*   The **`ChatPanel.tsx`** renders these steps inside an expandable, monospace shell. Clicking the header toggles a smooth Framer Motion height transition, giving users a complete audit trail of the RAG engine's internal cognitive process.

---

## 🎨 3. Grounded Citation Cards UI

Each citation card is dynamically rendered in the chat panel with specific visual badges:

1.  **Score Badge**: Displays the cosine similarity score of the segment normalized to a percentage (e.g. `Score: 95%`). If a reranker is active, this displays the reranker score.
2.  **Context Tooltip**: Hovering or clicking a citation card zooms the WebGL 3D Graph camera in the right column directly onto the matching `Document` node, creating an interlocking cross-panel visual coordination!
