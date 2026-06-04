import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Callable, List

import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

# Add the current directory and 'app' directory to sys.path
base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(base_dir)
sys.path.append(os.path.join(base_dir, "app"))

from app.api.routers import (
    document_routes,
    graph_routes,
    insightnote_routes,
    query_routes,
)
from app.api.routers.document_routes import DocumentManager
from app.api.utils_api import get_combined_auth_dependency
from app.core import ZeRAG
from app.core.document.config import MultiRAGConfig
from app.core.document.multirag import MultiRAG
from app.core.llm.gemini import gemini_complete_if_cache, gemini_embed
from app.core.llm.ollama import ollama_embed, ollama_model_complete
from app.core.llm.openai import openai_complete_if_cache, openai_embed
from app.core.utils import EmbeddingFunc
from config import config

# Setup logging - console + file (logs/server.log)
log_dir = Path(__file__).parent / "logs"
log_dir.mkdir(exist_ok=True)
log_file = log_dir / "server.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("zerag-server")

# Add file handler for server.log
file_handler = logging.FileHandler(log_file, encoding="utf-8")
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(
    logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
    )
)
logging.getLogger().addHandler(file_handler)
logger.info("ZeRAG Integrated Server main module loaded successfully.")

# --- LLM & Embedding Initialization Logic ---


def create_llm_func() -> Callable:
    binding = config.LLM_BINDING.lower()
    model = config.LLM_MODEL
    api_key = config.LLM_API_KEY

    if binding == "openai":

        async def openai_llm(
            prompt, system_prompt=None, history_messages=None, **kwargs
        ):
            return await openai_complete_if_cache(
                model=model,
                prompt=prompt,
                system_prompt=system_prompt,
                history_messages=history_messages,
                api_key=api_key,
                base_url=config.LLM_BASE_URL,
                **kwargs,
            )

        return openai_llm
    elif binding == "ollama":

        async def ollama_llm(
            prompt, system_prompt=None, history_messages=None, **kwargs
        ):
            return await ollama_model_complete(
                prompt=prompt,
                system_prompt=system_prompt,
                history_messages=history_messages,
                model=model,
                **kwargs,
            )

        return ollama_llm
    elif binding == "gemini":

        async def gemini_llm(
            prompt, system_prompt=None, history_messages=None, **kwargs
        ):
            return await gemini_complete_if_cache(
                model=model,
                prompt=prompt,
                system_prompt=system_prompt,
                history_messages=history_messages,
                api_key=api_key,
                base_url=config.LLM_BASE_URL,
                **kwargs,
            )

        return gemini_llm
    raise ValueError(f"Unsupported LLM binding: {binding}")


def create_embedding_func() -> EmbeddingFunc:
    binding = config.EMBEDDING_BINDING.lower()
    model = config.EMBEDDING_MODEL
    api_key = config.EMBEDDING_API_KEY

    if binding == "openai":
        return EmbeddingFunc(
            embedding_dim=1536 if "small" in model else 3072,
            max_token_size=8192,
            model_name=model,
            func=lambda texts: openai_embed(
                texts, model=model, api_key=api_key, base_url=config.EMBEDDING_BASE_URL
            ),
        )
    elif binding == "ollama":
        return EmbeddingFunc(
            embedding_dim=1024,
            max_token_size=8192,
            model_name=model,
            func=lambda texts: ollama_embed(texts, model=model),
        )
    elif binding == "gemini":
        # gemini-embedding-001 has 3072 dim, text-embedding-004 has 768 dim
        dim = 3072 if "gemini-embedding-001" in model else 768
        return EmbeddingFunc(
            embedding_dim=dim,
            max_token_size=2048,
            model_name=model,
            func=lambda texts: gemini_embed.func(
                texts, model=model, api_key=api_key, base_url=config.EMBEDDING_BASE_URL
            ),
        )
    raise ValueError(f"Unsupported Embedding binding: {binding}")


def create_rerank_func() -> Callable:
    binding = config.RERANKER_BINDING.lower()
    model = config.RERANKER_MODEL
    api_key = config.RERANKER_API_KEY
    base_url = config.RERANKER_BASE_URL

    if not model or (
        not base_url and binding not in ("google", "vertex", "google_vertex")
    ):
        logger.info("Reranker is not configured (model or base_url missing). Skipping.")
        return None

    if binding == "jina":
        from app.core.rerank import jina_rerank

        async def v98_rerank(query: str, documents: List[str], **kwargs):
            return await jina_rerank(
                query=query,
                documents=documents,
                model=model,
                api_key=api_key,
                base_url=base_url,
                **kwargs,
            )

        return v98_rerank
    elif binding == "cohere":
        from app.core.rerank import cohere_rerank

        async def c_rerank(query: str, documents: List[str], **kwargs):
            return await cohere_rerank(
                query=query,
                documents=documents,
                model=model,
                api_key=api_key,
                base_url=base_url,
                **kwargs,
            )

        return c_rerank
    elif binding == "ali":
        from app.core.rerank import ali_rerank

        async def a_rerank(query: str, documents: List[str], **kwargs):
            return await ali_rerank(
                query=query,
                documents=documents,
                model=model,
                api_key=api_key,
                base_url=base_url,
                **kwargs,
            )

        return a_rerank
    elif binding in ("google", "vertex", "google_vertex"):
        from app.core.rerank import google_vertex_rerank

        async def g_rerank(query: str, documents: List[str], **kwargs):
            return await google_vertex_rerank(
                query=query,
                documents=documents,
                model=model,
                project_id=os.getenv("GCP_PROJECT_ID"),
                credentials_json_path=os.getenv("GOOGLE_APPLICATION_CREDENTIALS"),
                **kwargs,
            )

        return g_rerank

    logger.warning(f"Unsupported Reranker binding: {binding}")
    return None


# Initialize ZeRAG instance
rag = ZeRAG(
    working_dir=config.WORKING_DIR,
    workspace=config.WORKSPACE,
    kv_storage=config.KV_STORAGE,
    graph_storage=config.GRAPH_STORAGE,
    vector_storage=config.VECTOR_STORAGE,
    doc_status_storage=config.DOC_STATUS_STORAGE,
    llm_model_func=create_llm_func(),
    embedding_func=create_embedding_func(),
    rerank_model_func=create_rerank_func(),
)

# API Key Security Setup
api_key = config.API_KEY
combined_auth = get_combined_auth_dependency(api_key)

# Initialize MultiRAG with the existing ZeRAG instance
# No extra ZeRAG is created - reuses rag (zerag=rag)
multi_rag = MultiRAG(
    zerag=rag,
    config=MultiRAGConfig(
        working_dir=config.WORKING_DIR,
        parse_method="auto",
        parser="mineru",
        # Force CPU backend for MinerU (no GPU required)
        parser_output_dir=os.path.join(config.WORKING_DIR, "mineru_output"),
    ),
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize ZeRAG
    await rag.initialize_storages()
    if hasattr(rag, "check_and_migrate_data"):
        await rag.check_and_migrate_data()

    logger.info("=" * 60)
    logger.info("ZeRAG Server Configuration")
    logger.info("=" * 60)
    logger.info(f"  Workspace   : {config.WORKSPACE}")
    logger.info(f"  Working Dir : {config.WORKING_DIR}")
    logger.info("-" * 60)
    logger.info(
        f"  LLM         : {config.LLM_MODEL} (binding: {config.LLM_BINDING}, base_url: {config.LLM_BASE_URL})"
    )
    logger.info(
        f"  Embedding   : {config.EMBEDDING_MODEL} (binding: {config.EMBEDDING_BINDING}, base_url: {config.EMBEDDING_BASE_URL})"
    )
    reranker_status = (
        f"{config.RERANKER_MODEL} (binding: {config.RERANKER_BINDING}, base_url: {config.RERANKER_BASE_URL})"
        if config.RERANKER_MODEL
        else "DISABLED"
    )
    logger.info(f"  Reranker    : {reranker_status}")
    logger.info("-" * 60)
    logger.info(f"  KV Storage  : {config.KV_STORAGE}")
    logger.info(f"  Graph       : {config.GRAPH_STORAGE}")
    logger.info(f"  Vector DB   : {config.VECTOR_STORAGE}")
    logger.info(f"  Doc Status  : {config.DOC_STATUS_STORAGE}")
    logger.info("=" * 60)

    yield
    await rag.finalize_storages()
    logger.info("ZeRAG storage finalized")


# Initialize FastAPI app
app = FastAPI(title="ZeRAG Integrated Server", version="1.4.0", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Document Manager Setup
doc_manager = DocumentManager(config.WORKING_DIR, workspace=config.WORKSPACE)

# Include routers with security and RAG instance
app.include_router(
    document_routes.create_document_routes(
        rag, doc_manager, api_key, multi_rag=multi_rag
    ),
    tags=["Document"],
)
app.include_router(
    query_routes.create_query_routes(rag, api_key, top_k=60),  # Default top_k
    tags=["Query"],
)
app.include_router(graph_routes.create_graph_routes(rag, api_key), tags=["Graph"])
app.include_router(
    insightnote_routes.create_insightnote_routes(
        rag, doc_manager, api_key, multi_rag=multi_rag
    ),
    tags=["InsightNote"],
)


@app.get("/health", dependencies=[Depends(combined_auth)])
async def health_check():
    return {
        "status": "healthy",
        "configuration": {
            "kv": config.KV_STORAGE,
            "graph": config.GRAPH_STORAGE,
            "vector": config.VECTOR_STORAGE,
            "llm": config.LLM_MODEL,
            "embedding": config.EMBEDDING_MODEL,
        },
    }


if __name__ == "__main__":
    uvicorn.run(app, host=config.HOST, port=config.PORT)
