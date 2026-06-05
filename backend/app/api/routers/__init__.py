"""
This module contains all the routers for the ZeRAG API.
"""

from .document_routes import router as document_router
from .graph_routes import router as graph_router
from .history_routes import create_history_routes
from .insightnote_routes import create_insightnote_routes
from .ollama_api import OllamaAPI
from .query_routes import router as query_router

__all__ = [
    "document_router",
    "query_router",
    "graph_router",
    "OllamaAPI",
    "create_history_routes",
    "create_insightnote_routes",
]
