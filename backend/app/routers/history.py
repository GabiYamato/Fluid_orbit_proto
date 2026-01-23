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
    products: Optional[List[dict]] = None  # List of product dicts for AI messages
    error: Optional[bool] = None
    details: Optional[str] = None
    clarification: Optional[dict] = None  # Clarification widget data


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


# ============== Chat Sessions Endpoints (Database Persisted) ==============

@router.get("/sessions", response_model=ChatSessionsResponse)
async def get_chat_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all chat sessions for the current user (persisted in DB)."""
    from app.models.chat_session import ChatSession as ChatSessionModel
    
    result = await db.execute(
        select(ChatSessionModel)
        .where(ChatSessionModel.user_id == str(current_user.id))
        .order_by(desc(ChatSessionModel.updated_at))
        .limit(10)
    )
    db_sessions = result.scalars().all()
    
    # Convert DB models to response format
    sessions = []
    for s in db_sessions:
        sessions.append(ChatSession(
            id=s.id,
            timestamp=s.created_at.isoformat() if s.created_at else "",
            messages=[ChatMessage(**m) for m in (s.messages or [])],
            preview=s.preview or "",
        ))
    
    return ChatSessionsResponse(
        sessions=sessions,
        total=len(sessions)
    )


@router.post("/sessions")
async def save_chat_session(
    request: SaveChatSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a chat session for the current user (persisted in DB)."""
    from app.models.chat_session import ChatSession as ChatSessionModel
    
    user_id = str(current_user.id)
    
    # Check if session exists
    result = await db.execute(
        select(ChatSessionModel).where(
            ChatSessionModel.id == request.session.id,
            ChatSessionModel.user_id == user_id,
        )
    )
    existing = result.scalar_one_or_none()
    
    messages_data = [m.model_dump() for m in request.session.messages]
    
    if existing:
        # Update existing session
        existing.messages = messages_data
        existing.preview = request.session.preview
    else:
        # Create new session
        new_session = ChatSessionModel(
            id=request.session.id,
            user_id=user_id,
            messages=messages_data,
            preview=request.session.preview,
        )
        db.add(new_session)
    
    await db.commit()
    
    return {"message": "Chat session saved", "session_id": request.session.id}


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a chat session."""
    from app.models.chat_session import ChatSession as ChatSessionModel
    
    user_id = str(current_user.id)
    
    result = await db.execute(
        select(ChatSessionModel).where(
            ChatSessionModel.id == session_id,
            ChatSessionModel.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    await db.delete(session)
    await db.commit()
    
    return {"message": "Chat session deleted"}


@router.delete("/sessions")
async def clear_chat_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clear all chat sessions for the current user."""
    from app.models.chat_session import ChatSession as ChatSessionModel
    
    user_id = str(current_user.id)
    
    await db.execute(
        delete(ChatSessionModel).where(ChatSessionModel.user_id == user_id)
    )
    await db.commit()
    
    return {"message": "All chat sessions cleared"}

