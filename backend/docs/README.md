# InsightNote - Backend Documentation

The backend of InsightNote is a high-performance, asynchronous REST API built with FastAPI. It handles document ingestion, orchestration of the Retrieval-Augmented Generation (RAG) pipeline, and communication with the LLM.

## 🏗 Architecture

The backend pipeline leverages the following core technologies:

*   **FastAPI**: Provides a robust, auto-documenting REST API.
*   **MinerU**: Used for highly accurate PDF parsing and data extraction. It preserves the document's structure, layout, and extracts text along with bounding box coordinates.
*   **Qdrant**: A vector database used to store and query the embeddings of the document chunks for rapid semantic search.
*   **Neo4j**: A graph database used to build a Knowledge Graph representations of the documents (Graph RAG), allowing for complex multihop reasoning.
*   **MongoDB**: Serves as the primary metadata store, keeping track of uploaded documents, their processing status, and the user's chat history.
*   **LangChain / LlamaIndex**: Orchestration frameworks used to tie together the LLM, vector stores, and graph stores during the querying phase.
*   **OpenAI**: Provides the embedding models (e.g., `text-embedding-3-small` or `text-embedding-ada-002`) and the LLM (e.g., `gpt-4o`) for reasoning and final answer generation.

## 📂 Directory Structure

```text
backend/
├── app/
│   ├── api/            # FastAPI routers (endpoints)
│   ├── core/           # RAG logic, Database connection singletons (Neo4j, Qdrant, Mongo)
│   ├── models/         # Pydantic schema and MongoDB models
│   ├── services/       # Business logic for document processing and chat
│   └── main.py         # FastAPI application entry point
├── docs/               # You are here
├── rag_storage/        # Local storage for uploaded PDFs and MinerU outputs
├── Dockerfile          # Container definition
├── requirements.txt    # Python dependencies
└── .env                # Environment variables
```

## 🔌 Core Endpoints

Detailed endpoint documentation can be explored interactively via Swagger UI by navigating to `http://localhost:8000/docs` while the backend is running.

### Documents
*   `POST /documents/upload`: Uploads a PDF file, saves it to `rag_storage`, and enqueues it for the RAG ingestion pipeline.
*   `GET /documents/list`: Retrieves a list of all uploaded documents and their current processing status (`ENQUEUED`, `PROCESSING`, `PROCESSED`, `FAILED`).
*   `GET /documents/download/{filename}`: Downloads or streams a raw PDF file from storage.
*   `DELETE /documents`: Deletes a document's metadata from MongoDB and optionally removes its vector/graph data and physical file.

### Chat & Search
*   `POST /query`: Submits a user question along with a specific `doc_id`. The backend performs a hybrid search (Vector + Graph), sends the context to the LLM, and returns the answer along with precise citation coordinates (bounding boxes).

## 🚀 Setup & Execution (Without Docker)

While Docker Compose is the recommended way to run the entire stack, you can run the backend locally for development purposes.

### Prerequisites
You must have running instances of MongoDB, Neo4j, and Qdrant accessible on your machine or network.

1.  **Create a Virtual Environment**:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

2.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

3.  **Environment Variables**:
    Create a `.env` file in the `backend` folder:
    ```env
    OPENAI_API_KEY=sk-your-key
    MONGO_URI=mongodb://localhost:27017
    NEO4J_URI=bolt://localhost:7687
    NEO4J_USER=neo4j
    NEO4J_PASSWORD=password
    QDRANT_URL=http://localhost:6333
    ZERAG_WORKING_DIR=./rag_storage
    ```

4.  **Run the Server**:
    ```bash
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ```
