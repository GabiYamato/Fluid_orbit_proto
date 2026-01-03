from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import time

from app.database import get_db
from app.models.user import User
from app.models.query_history import QueryHistory
from app.schemas.query import QueryRequest, QueryResponse, ParsedIntent
from app.utils.jwt import get_current_user
from app.utils.rate_limiter import check_rate_limit
from app.services.query_service import QueryService
from app.services.rag_service import RAGService

router = APIRouter(prefix="/query", tags=["Query"])


@router.post("", response_model=QueryResponse)
async def query_products(
    request: QueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Process a natural language product query.
    Returns AI-powered recommendations with transparent scoring.
    """
    start_time = time.time()
    
    # Check rate limits
    await check_rate_limit(current_user)
    
    # Initialize services
    query_service = QueryService(db)
    rag_service = RAGService()
    
    # Parse intent from query
    parsed_intent = await query_service.parse_intent(request.query)
    
    # Get recommendations via RAG pipeline
    result = await rag_service.get_recommendations(
        query=request.query,
        parsed_intent=parsed_intent,
        max_results=request.max_results,
    )
    
    # Save to query history
    query_history = QueryHistory(
        user_id=current_user.id,
        query_text=request.query,
        parsed_intent=str(parsed_intent.model_dump()),
        response_summary=result.get("summary", ""),
        source_type=result.get("data_source", "unknown"),
        confidence_score=result.get("confidence_score"),
    )
    db.add(query_history)
    await db.commit()
    
    # Update demand counters
    if parsed_intent.category:
        await query_service.increment_demand(parsed_intent.category)
    
    response_time = int((time.time() - start_time) * 1000)
    
    return QueryResponse(
        query=request.query,
        parsed_intent=parsed_intent,
        recommendations=result.get("recommendations", []),
        summary=result.get("summary", ""),
        data_source=result.get("data_source", "unknown"),
        confidence_level=result.get("confidence_level", "low"),
        disclaimer=result.get("disclaimer"),
        response_time_ms=response_time,
    )


@router.get("/health")
async def health_check():
    """Health check endpoint for query service."""
    return {"status": "healthy", "service": "query"}
