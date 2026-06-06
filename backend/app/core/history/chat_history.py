import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional

import asyncpg

logger = logging.getLogger("insightnote-chat-history")


class PostgresChatHistory:
    def __init__(self):
        # Resolve connection string.
        # When running in docker container, host is 'postgres' or 'insightnote-postgres'.
        # When running locally on host machine, host is 'localhost'.
        default_uri = "postgresql://postgres:password@localhost:5432/insightnote"
        self.db_uri = os.getenv("POSTGRES_URI", default_uri)
        self._pool: Optional[asyncpg.Pool] = None
        self._initialized = False

    async def get_pool(self) -> asyncpg.Pool:
        """Lazily initialize and return the asyncpg connection pool with retry support."""
        if self._pool is not None:
            return self._pool

        # Attempt to connect with retries (Postgres might be starting up in Docker)
        for attempt in range(5):
            try:
                self._pool = await asyncpg.create_pool(
                    dsn=self.db_uri, min_size=1, max_size=10, timeout=10.0
                )
                logger.info(
                    "Successfully connected to PostgreSQL chat history database."
                )
                break
            except Exception as e:
                logger.warning(
                    f"PostgreSQL connection attempt {attempt + 1}/5 failed: {e}. "
                    f"Retrying in 2 seconds..."
                )
                await asyncio.sleep(2)

        if self._pool is None:
            # If Postgres is truly down, raise error but we can fall back in the router.
            raise RuntimeError(f"Could not connect to PostgreSQL at {self.db_uri}")

        return self._pool

    async def initialize(self):
        """Creates tables automatically if they do not exist."""
        if self._initialized:
            return

        try:
            pool = await self.get_pool()
            async with pool.acquire() as conn:
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS notebook_workspaces (
                        id VARCHAR(80) PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        status VARCHAR(40) DEFAULT 'empty',
                        source_count INTEGER DEFAULT 0,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS active_jobs (
                        job_id VARCHAR(80) PRIMARY KEY,
                        notebook_id VARCHAR(80) NOT NULL REFERENCES notebook_workspaces(id) ON DELETE CASCADE,
                        filename VARCHAR(255) NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        force_mineru_fallback BOOLEAN DEFAULT FALSE,
                        metadata JSONB DEFAULT '{}'
                    );

                    CREATE TABLE IF NOT EXISTS notebook_conversations (
                        id VARCHAR(50) PRIMARY KEY,
                        notebook_id VARCHAR(50) NOT NULL REFERENCES notebook_workspaces(id) ON DELETE CASCADE,
                        title VARCHAR(255) DEFAULT 'New Conversation',
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_conversations_notebook_id ON notebook_conversations(notebook_id);

                    CREATE TABLE IF NOT EXISTS conversation_messages (
                        id SERIAL PRIMARY KEY,
                        conversation_id VARCHAR(50) REFERENCES notebook_conversations(id) ON DELETE CASCADE,
                        role VARCHAR(20) NOT NULL,
                        content TEXT NOT NULL,
                        metadata JSONB DEFAULT '{}',
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON conversation_messages(conversation_id);
                """)

            self._initialized = True
            logger.info("PostgreSQL chat history tables initialized successfully.")
        except Exception as e:
            logger.error(
                f"Failed to initialize PostgreSQL chat history schema: {e}",
                exc_info=True,
            )
            # Do not crash the entire server - let graceful degradation handle it
            self._initialized = False

    async def close(self):
        """Close connection pool."""
        if self._pool:
            await self._pool.close()
            self._pool = None
            self._initialized = False
            logger.info("PostgreSQL chat history database pool closed.")

    # --- CRUD operations for notebooks ---

    async def upsert_notebook(
        self,
        notebook_id: str,
        name: str,
        status: str = "empty",
        source_count: int = 0,
    ) -> Dict[str, Any]:
        await self.initialize()
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO notebook_workspaces (id, name, status, source_count)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO UPDATE
                SET name = EXCLUDED.name,
                    status = EXCLUDED.status,
                    source_count = EXCLUDED.source_count,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id, name, status, source_count, created_at, updated_at
                """,
                notebook_id,
                name,
                status,
                source_count,
            )
            return dict(row)

    async def update_notebook_status(
        self,
        notebook_id: str,
        status: Optional[str] = None,
        source_count: Optional[int] = None,
    ) -> bool:
        await self.initialize()
        pool = await self.get_pool()
        assignments = ["updated_at = CURRENT_TIMESTAMP"]
        values: List[Any] = []
        if status is not None:
            values.append(status)
            assignments.append(f"status = ${len(values)}")
        if source_count is not None:
            values.append(source_count)
            assignments.append(f"source_count = ${len(values)}")
        values.append(notebook_id)
        async with pool.acquire() as conn:
            result = await conn.execute(
                f"""
                UPDATE notebook_workspaces
                SET {", ".join(assignments)}
                WHERE id = ${len(values)}
                """,
                *values,
            )
            return "UPDATE 1" in result

    async def get_notebook(self, notebook_id: str) -> Optional[Dict[str, Any]]:
        await self.initialize()
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, name, status, source_count, created_at, updated_at
                FROM notebook_workspaces
                WHERE id = $1
                """,
                notebook_id,
            )
            return dict(row) if row else None

    async def list_notebooks(self) -> List[Dict[str, Any]]:
        await self.initialize()
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, name, status, source_count, created_at, updated_at
                FROM notebook_workspaces
                ORDER BY updated_at DESC
                """
            )
            return [dict(row) for row in rows]

    async def delete_notebook(self, notebook_id: str) -> bool:
        await self.initialize()
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            status = await conn.execute(
                "DELETE FROM notebook_workspaces WHERE id = $1", notebook_id
            )
            return "DELETE 1" in status

    # --- CRUD operations for conversations ---

    async def create_conversation(
        self, notebook_id: str, conversation_id: str, title: Optional[str] = None
    ) -> Dict[str, Any]:
        """Creates a new chat session."""
        await self.initialize()
        pool = await self.get_pool()

        display_title = title or "New Conversation"
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO notebook_conversations (id, notebook_id, title)
                VALUES ($1, $2, $3)
                ON CONFLICT (id) DO UPDATE
                SET updated_at = CURRENT_TIMESTAMP;
                """,
                conversation_id,
                notebook_id,
                display_title,
            )

            row = await conn.fetchrow(
                "SELECT id, notebook_id, title, created_at, updated_at FROM notebook_conversations WHERE id = $1",
                conversation_id,
            )
            return dict(row)

    async def get_conversations(self, notebook_id: str) -> List[Dict[str, Any]]:
        """List all conversation sessions for a given notebook."""
        await self.initialize()
        pool = await self.get_pool()

        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, notebook_id, title, created_at, updated_at
                FROM notebook_conversations
                WHERE notebook_id = $1
                ORDER BY updated_at DESC
                """,
                notebook_id,
            )
            return [dict(r) for r in rows]

    async def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation thread and all corresponding messages (cascaded)."""
        await self.initialize()
        pool = await self.get_pool()

        async with pool.acquire() as conn:
            status = await conn.execute(
                "DELETE FROM notebook_conversations WHERE id = $1", conversation_id
            )
            return "DELETE 1" in status

    async def delete_notebook_conversations(self, notebook_id: str) -> bool:
        """Delete all conversations and messages associated with a notebook."""
        await self.initialize()
        try:
            pool = await self.get_pool()
            async with pool.acquire() as conn:
                status = await conn.execute(
                    "DELETE FROM notebook_conversations WHERE notebook_id = $1", notebook_id
                )
                logger.info(f"Purged conversations for notebook {notebook_id} from Postgres: {status}")
                return True
        except Exception as e:
            logger.error(f"Error purging conversations for notebook {notebook_id} from Postgres: {e}")
            return False

    async def update_conversation_title(self, conversation_id: str, title: str) -> bool:
        """Update the display title of a conversation thread."""
        await self.initialize()
        pool = await self.get_pool()

        async with pool.acquire() as conn:
            status = await conn.execute(
                """
                UPDATE notebook_conversations
                SET title = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                """,
                title,
                conversation_id,
            )
            return "UPDATE 1" in status

    # --- CRUD operations for messages ---

    async def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Saves a single message under a conversation."""
        await self.initialize()
        pool = await self.get_pool()

        metadata_json = json.dumps(metadata or {})
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO conversation_messages (conversation_id, role, content, metadata)
                VALUES ($1, $2, $3, $4)
                RETURNING id, conversation_id, role, content, metadata, created_at
                """,
                conversation_id,
                role,
                content,
                metadata_json,
            )

            await conn.execute(
                "UPDATE notebook_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                conversation_id,
            )

            result = dict(row)
            if isinstance(result.get("metadata"), str):
                result["metadata"] = json.loads(result["metadata"])
            return result

    async def get_messages(
        self, conversation_id: str, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Retrieve full details of messages in a conversation."""
        await self.initialize()
        pool = await self.get_pool()

        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, conversation_id, role, content, metadata, created_at
                FROM conversation_messages
                WHERE conversation_id = $1
                ORDER BY id ASC
                LIMIT $2
                """,
                conversation_id,
                limit,
            )

            results = []
            for r in rows:
                item = dict(r)
                if isinstance(item.get("metadata"), str):
                    item["metadata"] = json.loads(item["metadata"])
                results.append(item)
            return results

    async def get_conversation_history_formatted(
        self, conversation_id: str, limit: int = 15
    ) -> List[Dict[str, str]]:
        """Returns messages formatted as simple dictionaries for LLM context injection."""
        try:
            messages = await self.get_messages(conversation_id, limit=limit)
            return [{"role": m["role"], "content": m["content"]} for m in messages]
        except Exception as e:
            logger.warning(f"Error reading conversation history for LLM context: {e}")
            return []

    # --- CRUD operations for active jobs ---

    async def create_job(
        self,
        job_id: str,
        notebook_id: str,
        filename: str,
        force_mineru_fallback: bool = False,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        await self.initialize()
        pool = await self.get_pool()
        meta_json = json.dumps(metadata or {})
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO active_jobs (job_id, notebook_id, filename, force_mineru_fallback, metadata)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (job_id) DO UPDATE
                SET notebook_id = EXCLUDED.notebook_id,
                    filename = EXCLUDED.filename,
                    force_mineru_fallback = EXCLUDED.force_mineru_fallback,
                    metadata = EXCLUDED.metadata,
                    created_at = CURRENT_TIMESTAMP
                RETURNING job_id, notebook_id, filename, force_mineru_fallback, metadata, created_at
                """,
                job_id,
                notebook_id,
                filename,
                force_mineru_fallback,
                meta_json,
            )
            item = dict(row)
            if isinstance(item.get("metadata"), str):
                item["metadata"] = json.loads(item["metadata"])
            return item

    async def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        await self.initialize()
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT job_id, notebook_id, filename, force_mineru_fallback, metadata, EXTRACT(EPOCH FROM created_at) AS created_at_epoch
                FROM active_jobs
                WHERE job_id = $1
                """,
                job_id,
            )
            if not row:
                return None
            item = dict(row)
            item["created_at"] = float(item.pop("created_at_epoch"))
            if isinstance(item.get("metadata"), str):
                item["metadata"] = json.loads(item["metadata"])
            return item

    async def delete_job(self, job_id: str) -> bool:
        await self.initialize()
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM active_jobs WHERE job_id = $1", job_id
            )
            return "DELETE 1" in result

    async def delete_jobs_for_notebook(self, notebook_id: str) -> bool:
        await self.initialize()
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM active_jobs WHERE notebook_id = $1", notebook_id
            )
            return "DELETE" in result


# Instantiate global singleton
chat_history_db = PostgresChatHistory()
