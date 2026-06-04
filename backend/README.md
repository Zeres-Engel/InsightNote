# InsightNote Backend (ZeRAG)

InsightNote is a powerful Retrieval-Augmented Generation (RAG) system. This repository contains the **ZeRAG** (Zero-effort Retrieval-Augmented Generation) backend, which integrates Knowledge Graphs and Vector Databases for state-of-the-art context retrieval.

## Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Maintenance: Docker Volume Reset](#maintenance-docker-volume-reset)
- [Documentation](#documentation)

## Overview
ZeRAG is designed to overcome the limitations of traditional vector-only RAG systems. By maintaining a **Knowledge Graph** alongside a **Vector Database**, ZeRAG can understand complex relationships between entities, providing more accurate and conceptually relevant answers.

## Key Features
- **Hybrid Retrieval**: Combines Graph traversal (Neo4j) with Vector similarity (Qdrant) for multi-dimensional context.
- **Intelligent Keyword Extraction**: Uses LLMs to generate high-level and low-level keywords, optimizing the search space.
- **Multi-modal Document Ingestion**: Integrated with `MinerU` for high-quality parsing of PDFs, images, and layouts.
- **Workspace Isolation**: Securely partition data by project or tenant.
- **Flexible Query Modes**:
  - `mix`: Unified Graph + Vector retrieval (Recommended).
  - `hybrid`: Global patterns + Local entity context.
  - `local`: Deep dive into specific entities.
  - `global`: High-level thematic analysis.
  - `naive`: Standard vector search.

## Tech Stack
- **FastAPI**: Asynchronous high-performance web framework.
- **Neo4j**: Primary Knowledge Graph storage.
- **Qdrant**: High-density Vector database.
- **MongoDB**: Metadata, document tracking, and LLM cache storage.
- **LLM Support**: Built-in support for OpenAI (GPT-4o), Ollama, and Langfuse observability.

## System Architecture
For a detailed breakdown of the internal pipelines, extraction logic, and retrieval algorithms, please refer to our internal [ZeRAG Analysis Report](docs/analysis_zerag.md).

## Maintenance: Docker Volume Reset
Use these instructions if you need to wipe all processed data and LLM caches to start fresh.

### Volume Configuration
| Service | Docker Volume Name | Data Stored |
|---------|--------------------|-------------|
| MongoDB | `insightnote_mongo_data` | Metadata, Doc Status, LLM Cache |
| Neo4j   | `insightnote_neo4j_data` | Knowledge Graph (Entities & Relations) |
| Qdrant  | `insightnote_qdrant_data` | Vector Embeddings (Chunks & Entities) |

### Reset Procedures

#### 1. Full Environment Reset
To remove all data and stop all services:
```bash
docker-compose down -v
```

#### 2. Reset Individual Service
If you only want to clear specific data (e.g., only the Knowledge Graph):
```bash
# Example: Reset Neo4j
docker-compose stop neo4j
docker volume rm insightnote_neo4j_data
docker-compose up -d neo4j
```

#### 3. Clear Local File Cache
If you are running the backend locally, you may also want to clear document storage:
- **Windows (PowerShell)**: `Remove-Item -Recurse -Force rag_storage\*`
- **Linux/macOS**: `rm -rf rag_storage/*`

## Documentation
- [System Analysis](docs/analysis_zerag.md)
- [API Specification](http://localhost:8000/docs) (when running)

---
© 2026 InsightNote Team
