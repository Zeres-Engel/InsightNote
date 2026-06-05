import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.history.chat_history import chat_history_db

logger = logging.getLogger("insightnote-history-router")

# --- Pydantic Models for API Contract ---


class ConversationCreateRequest(BaseModel):
    conversation_id: str = Field(
        ...,
        description="Unique client-generated or server-generated UUID for the session",
    )
    title: Optional[str] = Field(
        None, description="Optional custom title for the chat thread"
    )


class ConversationResponse(BaseModel):
    id: str
    notebook_id: str
    title: str
    created_at: Any
    updated_at: Any


class MessageResponse(BaseModel):
    id: int
    conversation_id: str
    role: str
    content: str
    metadata: Dict[str, Any]
    created_at: Any


class TitleUpdateRequest(BaseModel):
    title: str = Field(..., description="New title for the conversation")


def create_history_routes(api_key: Optional[str] = None):
    router = APIRouter(prefix="/api/notebooks/{notebook_id}")

    @router.get("/conversations", response_model=List[ConversationResponse])
    async def list_conversations(notebook_id: str):
        """Get all conversation sessions/threads for a specific notebook."""
        try:
            conversations = await chat_history_db.get_conversations(notebook_id)
            return conversations
        except Exception as e:
            logger.error(f"Error listing conversations for notebook {notebook_id}: {e}")
            # Fallback to empty list instead of crashing, keeping the sandbox philosophy
            return []

    @router.post("/conversations", response_model=ConversationResponse)
    async def create_conversation(notebook_id: str, request: ConversationCreateRequest):
        """Create a new conversation session/thread under a notebook."""
        try:
            conv = await chat_history_db.create_conversation(
                notebook_id=notebook_id,
                conversation_id=request.conversation_id,
                title=request.title,
            )
            return conv
        except Exception as e:
            logger.error(
                f"Error creating conversation under notebook {notebook_id}: {e}"
            )
            raise HTTPException(status_code=500, detail=str(e))

    @router.get(
        "/conversations/{conversation_id}/messages",
        response_model=List[MessageResponse],
    )
    async def get_conversation_messages(notebook_id: str, conversation_id: str):
        """Retrieve all chat messages under a specific conversation session."""
        try:
            messages = await chat_history_db.get_messages(conversation_id)
            return messages
        except Exception as e:
            logger.error(f"Error fetching messages for session {conversation_id}: {e}")
            return []

    @router.put("/conversations/{conversation_id}/title")
    async def update_conversation_title(
        notebook_id: str, conversation_id: str, request: TitleUpdateRequest
    ):
        """Rename/update the title of an existing conversation thread."""
        try:
            success = await chat_history_db.update_conversation_title(
                conversation_id, request.title
            )
            if not success:
                raise HTTPException(
                    status_code=404, detail="Conversation session not found"
                )
            return {
                "status": "success",
                "message": "Conversation title updated successfully.",
            }
        except HTTPException as he:
            raise he
        except Exception as e:
            logger.error(f"Error updating title for session {conversation_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.delete("/conversations/{conversation_id}")
    async def delete_conversation(notebook_id: str, conversation_id: str):
        """Delete a conversation session and all of its associated messages."""
        try:
            success = await chat_history_db.delete_conversation(conversation_id)
            if not success:
                raise HTTPException(
                    status_code=404, detail="Conversation session not found"
                )
            return {
                "status": "success",
                "message": f"Conversation {conversation_id} successfully deleted.",
            }
        except HTTPException as he:
            raise he
        except Exception as e:
            logger.error(f"Error deleting conversation {conversation_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    return router
