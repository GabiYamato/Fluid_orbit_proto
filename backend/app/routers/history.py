from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, delete
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import json

from app.database import get_db
from app.models.user import User
from app.models.query_history import QueryHistory
from app.schemas.query import QueryHistoryResponse, QueryHistoryItem
from app.utils.jwt import get_current_user

router = APIRouter(prefix="/history", tags=["History"])


# Chat Session Models
class ChatMessage(BaseModel):
    role: str  # 'user' or 'ai'
    content: str
    timestamp: Optional[str] = None


class ChatSession(BaseModel):
    id: str
    timestamp: str
    messages: List[ChatMessage]
    preview: str


class SaveChatSessionRequest(BaseModel):
    session: ChatSession


class ChatSessionsResponse(BaseModel):
    sessions: List[ChatSession]
    total: int


# In-memory storage for chat sessions (per user)
# In production, this would be stored in the database
_chat_sessions: dict = {}  # user_id -> List[ChatSession]


@router.get("", response_model=QueryHistoryResponse)
async def get_query_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the current user's query history."""
    offset = (page - 1) * per_page
    
    # Get total count
    count_result = await db.execute(
        select(func.count(QueryHistory.id)).where(QueryHistory.user_id == current_user.id)
    )
    total = count_result.scalar()
    
    # Get paginated history
    result = await db.execute(
        select(QueryHistory)
        .where(QueryHistory.user_id == current_user.id)
        .order_by(desc(QueryHistory.created_at))
        .offset(offset)
        .limit(per_page)
    )
    queries = result.scalars().all()
    
    return QueryHistoryResponse(
        queries=[QueryHistoryItem.model_validate(q) for q in queries],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.delete("/{query_id}")
async def delete_query_from_history(
    query_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a query from history."""
    from uuid import UUID
    
    result = await db.execute(
        select(QueryHistory).where(
            QueryHistory.id == UUID(query_id),
            QueryHistory.user_id == current_user.id,
        )
    )
    query = result.scalar_one_or_none()
    
    if not query:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Query not found"
        )
    
    await db.delete(query)
    await db.commit()
    
    return {"message": "Query deleted successfully"}


@router.delete("")
async def clear_query_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clear all query history for the current user."""
    await db.execute(
        delete(QueryHistory).where(QueryHistory.user_id == current_user.id)
    )
    await db.commit()
    
    return {"message": "Query history cleared"}


# ============== Chat Sessions Endpoints ==============

@router.get("/sessions", response_model=ChatSessionsResponse)
async def get_chat_sessions(
    current_user: User = Depends(get_current_user),
):
    """Get all chat sessions for the current user."""
    user_id = str(current_user.id)
    sessions = _chat_sessions.get(user_id, [])
    
    return ChatSessionsResponse(
        sessions=sessions,
        total=len(sessions)
    )


@router.post("/sessions")
async def save_chat_session(
    request: SaveChatSessionRequest,
    current_user: User = Depends(get_current_user),
):
    """Save a chat session for the current user."""
    user_id = str(current_user.id)
    
    if user_id not in _chat_sessions:
        _chat_sessions[user_id] = []
    
    # Check if session already exists (update it)
    existing_idx = None
    for idx, session in enumerate(_chat_sessions[user_id]):
        if session.id == request.session.id:
            existing_idx = idx
            break
    
    if existing_idx is not None:
        _chat_sessions[user_id][existing_idx] = request.session
    else:
        # Add new session at the beginning
        _chat_sessions[user_id].insert(0, request.session)
    
    # Keep only last 10 sessions
    _chat_sessions[user_id] = _chat_sessions[user_id][:10]
    
    return {"message": "Chat session saved", "session_id": request.session.id}


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a chat session."""
    user_id = str(current_user.id)
    
    if user_id not in _chat_sessions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    _chat_sessions[user_id] = [
        s for s in _chat_sessions[user_id] if s.id != session_id
    ]
    
    return {"message": "Chat session deleted"}


@router.delete("/sessions")
async def clear_chat_sessions(
    current_user: User = Depends(get_current_user),
):
    """Clear all chat sessions for the current user."""
    user_id = str(current_user.id)
    _chat_sessions[user_id] = []
    
    return {"message": "All chat sessions cleared"}

