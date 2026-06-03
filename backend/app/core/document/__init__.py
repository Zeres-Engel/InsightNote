from .multirag import MultiRAG as MultiRAG
from .config import MultiRAGConfig as MultiRAGConfig

__version__ = "1.2.9"
__author__ = "Zirui Guo"
__url__ = "https://github.com/HKUDS/RAG-Anything"

__all__ = ["MultiRAG", "MultiRAGConfig"]


def get_version() -> str:
    """Return the RAG-Anything version string."""
    return __version__
