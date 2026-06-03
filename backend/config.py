import os
import re

import yaml
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def env_var_constructor(loader, node):
    """
    Custom YAML constructor to handle environment variables in the form ${VAR_NAME} or ${VAR_NAME:-default}
    """
    value = loader.construct_scalar(node)
    # Match ${VAR_NAME} or ${VAR_NAME:-default}
    match = re.match(r"\$\{(?P<var>[^:-]+)(?::-(?P<default>.*))?\}", value)
    if match:
        var_name = match.group("var")
        default_value = match.group("default")
        return os.getenv(
            var_name, default_value if default_value is not None else value
        )
    return value


# Add constructor to YAML loader
yaml.SafeLoader.add_constructor("!env", env_var_constructor)
yaml.SafeLoader.add_implicit_resolver("!env", re.compile(r"\$\{(.*)\}"), None)


class Config:
    def __init__(self, config_path=None):
        # Default to config/config.yaml or the old config.yaml path if provided path is None
        if config_path is None:
            config_path = "config/config.yaml"
            if not os.path.exists(config_path):
                config_path = "config.yaml"
            if not os.path.exists(config_path):
                # Try relative to the config.py directory to support running from other directories
                dir_of_config_py = os.path.dirname(os.path.abspath(__file__))
                config_path = os.path.join(dir_of_config_py, "config", "config.yaml")
                if not os.path.exists(config_path):
                    config_path = os.path.join(dir_of_config_py, "config.yaml")
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                self._yaml_config = yaml.safe_load(f)
            self._interpolate_env_vars(self._yaml_config)
        else:
            self._yaml_config = {}
        self._load_config_values()

    def _load_config_values(self):
        # Server Settings
        server = self._yaml_config.get("server", {})
        self.HOST = server.get("host", "0.0.0.0")
        self.PORT = int(server.get("port", 8000))
        self.WORKING_DIR = server.get("working_dir", "./rag_storage")
        self.WORKSPACE = server.get("workspace", "default")

        # LLM Settings
        llm = self._yaml_config.get("llm", {})
        self.LLM_BINDING = llm.get("binding", "openai")
        self.LLM_MODEL = llm.get("model", "gpt-4o-mini")
        self.LLM_API_KEY = llm.get("api_key")
        self.LLM_BASE_URL = llm.get("base_url")
        self.LLM_OPTIONS = llm.get("options", {})

        # Embedding Settings
        embedding = self._yaml_config.get("embedding", {})
        self.EMBEDDING_BINDING = embedding.get("binding", "openai")
        self.EMBEDDING_MODEL = embedding.get("model", "text-embedding-3-small")
        self.EMBEDDING_API_KEY = embedding.get("api_key")
        self.EMBEDDING_BASE_URL = embedding.get("base_url")

        reranker = self._yaml_config.get("reranker", {})
        self.RERANKER_BINDING = reranker.get("binding", "lollms")
        self.RERANKER_MODEL = reranker.get("model", "")
        self.RERANKER_BASE_URL = reranker.get("base_url")
        self.RERANKER_API_KEY = reranker.get("api_key", self.LLM_API_KEY)
        self.RERANKER_MAX_TOKENS = int(reranker.get("max_tokens", 4096))
        self.RERANK_SCORE = float(
            reranker.get("rerank_score", os.getenv("RERANK_SCORE", 0.0))
        )

        # Vector Search (cosine similarity threshold for Qdrant, etc.)
        vector = self._yaml_config.get("vector", {})
        self.VECTOR_SCORE = float(
            vector.get("vector_score", os.getenv("VECTOR_SCORE", 0.2))
        )

        # Storage Backends
        storage = self._yaml_config.get("storage", {})
        self.KV_STORAGE = storage.get("kv", "MongoKVStorage")
        self.GRAPH_STORAGE = storage.get("graph", "Neo4jStorage")
        self.VECTOR_STORAGE = storage.get("vector", "QdrantVectorDBStorage")
        self.DOC_STATUS_STORAGE = storage.get("doc_status", "MongoDocStatusStorage")

        # --- Infrastructure & Services Deployment Metadata ---
        infrastructure = self._yaml_config.get("infrastructure", {})

        # MongoDB Infrastructure
        mongo_infra = infrastructure.get("mongodb", {})
        self.MONGO_IMAGE = mongo_infra.get("image", "mongo:latest")
        self.MONGO_URI = mongo_infra.get(
            "uri", os.getenv("MONGO_URI", "mongodb://mongodb:27017")
        )
        self.MONGO_DATABASE = mongo_infra.get("database", "lightrag")

        # Neo4j Infrastructure
        neo4j_infra = infrastructure.get("neo4j", {})
        self.NEO4J_IMAGE = neo4j_infra.get("image", "neo4j:latest")
        self.NEO4J_URI = neo4j_infra.get(
            "uri", os.getenv("NEO4J_URI", "bolt://neo4j:7687")
        )
        self.NEO4J_USER = neo4j_infra.get("user", os.getenv("NEO4J_USER", "neo4j"))
        self.NEO4J_PASSWORD = neo4j_infra.get(
            "password", os.getenv("NEO4J_PASSWORD", "password")
        )

        # Qdrant Infrastructure
        qdrant_infra = infrastructure.get("qdrant", {})
        self.QDRANT_IMAGE = qdrant_infra.get("image", "qdrant/qdrant:latest")
        self.QDRANT_URL = qdrant_infra.get(
            "url", os.getenv("QDRANT_URL", "http://qdrant:6333")
        )
        self.QDRANT_API_KEY = qdrant_infra.get(
            "api_key", os.getenv("QDRANT_API_KEY", "")
        )

        # Global API Security
        self.API_KEY = os.getenv("ZERAG_API_KEY", None)

    def _interpolate_env_vars(self, data):
        """
        Recursively find and replace ${VAR_NAME} or ${VAR_NAME:-default} in the config dictionary.
        """
        if isinstance(data, dict):
            for key, value in data.items():
                if isinstance(value, (dict, list)):
                    self._interpolate_env_vars(value)
                elif isinstance(value, str):
                    data[key] = self._replace_value(value)
        elif isinstance(data, list):
            for i, item in enumerate(data):
                if isinstance(item, (dict, list)):
                    self._interpolate_env_vars(item)
                elif isinstance(item, str):
                    data[i] = self._replace_value(item)

    def _replace_value(self, value):
        pattern = re.compile(r"\$\{(?P<var>[^:-]+)(?::-(?P<default>.*))?\}")

        def replacer(match):
            var_name = match.group("var")
            default_value = match.group("default")
            return os.getenv(
                var_name, default_value if default_value is not None else match.group(0)
            )

        return pattern.sub(replacer, value)


# Single instance of config
config = Config()
