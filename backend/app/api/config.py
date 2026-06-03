import os
import argparse
from config import config

from app.core.base import OllamaServerInfos
from app.core.utils import get_env_value

# This is a compatibility layer for the existing routers that expect 'global_args'
class GlobalArgs:
    def __init__(self):
        self.host = config.HOST
        self.port = config.PORT
        self.working_dir = config.WORKING_DIR
        self.workspace = config.WORKSPACE
        self.input_dir = config.WORKING_DIR
        self.llm_binding = config.LLM_BINDING
        self.llm_model = config.LLM_MODEL
        self.embedding_binding = config.EMBEDDING_BINDING
        self.embedding_model = config.EMBEDDING_MODEL
        self.kv_storage = config.KV_STORAGE
        self.graph_storage = config.GRAPH_STORAGE
        self.vector_storage = config.VECTOR_STORAGE
        self.key = config.API_KEY
        
        # Add other fields used by routers (defaults)
        self.log_level = "INFO"
        self.verbose = False
        # Document extraction: PYPDF (pypdf/docx/pptx/openpyxl), DOCLING, or TEXTRACT
        self.document_loading_engine = os.getenv("DOCUMENT_LOADING_ENGINE", "PYPDF").upper()
        self.pdf_decrypt_password = None
        # MinerU integration settings
        # Set MINERU_ENABLED=true in .env to enable MinerU for PDF parsing (CPU mode)
        self.mineru_enabled = os.getenv("MINERU_ENABLED", "false").lower() == "true"
        # MinerU method: auto | txt | ocr
        self.mineru_method = os.getenv("MINERU_METHOD", "auto")
        self.cors_origins = "*"
        
        # Auth settings
        self.token_secret = os.getenv("TOKEN_SECRET", "super-secret-token")
        self.jwt_algorithm = os.getenv("JWT_ALGORITHM", "HS256")
        self.token_expire_hours = int(os.getenv("TOKEN_EXPIRE_HOURS", 24))
        self.guest_token_expire_hours = int(os.getenv("GUEST_TOKEN_EXPIRE_HOURS", 1))
        self.auth_accounts = os.getenv("AUTH_ACCOUNTS", "")
        
        # Security & Whitelist settings
        self.whitelist_paths = os.getenv("WHITELIST_PATHS", "/docs,/openapi.json,/redoc")
        self.ip_whitelist = os.getenv("IP_WHITELIST", "")
        self.ip_blacklist = os.getenv("IP_BLACKLIST", "")
        self.max_upload_size = int(os.getenv("MAX_UPLOAD_SIZE", 1024 * 1024 * 100)) # 100MB
        self.token_auto_renew = os.getenv("TOKEN_AUTO_RENEW", "true").lower() == "true"

global_args = GlobalArgs()
ollama_server_infos = OllamaServerInfos()

def get_default_host(binding_type: str) -> str:
    return "http://localhost:11434" # Dummy for compatibility
