from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import Optional
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
optional_security = HTTPBearer(auto_error=False)


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


@router.post("/stream")
async def stream_query_products(
    request: QueryRequest,
    db: AsyncSession = Depends(get_db),
    token_creds: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
):
    """
    Stream product recommendations and chat response (SSE).
    """
    try:
        if token_creds:
            current_user = await get_current_user(token_creds, db)
        else:
            raise Exception("No token")
    except Exception:
        # Allow guest access if auth fails
        # Create a temporary guest user object
        current_user = User(id="guest", email="guest@localhost")
    
    if current_user.id != "guest":
        await check_rate_limit(current_user)
    
    query_service = QueryService(db)
    rag_service = RAGService()
    
    # Intent parsing moves inside generator to use refined query
    # parsed_intent = await query_service.parse_intent(request.query)
    
    async def event_generator():
        # Update status
        if request.history:
            yield "event: status\ndata: Understanding context...\n\n"
            
        history_dicts = [h.model_dump() for h in request.history]
        refined_query = await rag_service.refine_query(request.query, history_dicts)
        
        # Parse intent from refined query
        parsed_intent = await query_service.parse_intent(refined_query)
        
        yield "event: status\ndata: Searching options...\n\n"

        # 1. Search Products (Wait for full retrieval)
        search_result = await rag_service.search_products(
            query=refined_query,
            parsed_intent=parsed_intent,
            max_results=request.max_results,
            offset=request.offset,
        )
        products = search_result["products"]
        total_found = search_result.get("total_found", 0)
        
        # 2. Send Products Event
        # Convert datetime/decimal objects to string for JSON serialization
        import json
        from datetime import datetime
        from decimal import Decimal
        
        def json_serial(obj):
            if isinstance(obj, (datetime, datetime.date)):
                return obj.isoformat()
            if isinstance(obj, Decimal):
                return float(obj)
            raise TypeError (f"Type {type(obj)} not serializable")

        # Yield products immediately
        yield f"event: products\ndata: {json.dumps(products, default=json_serial)}\n\n"
        
        if total_found > 0:
             yield f"event: scraped_count\ndata: {total_found}\n\n"
        
        # Update status
        yield "event: status\ndata: Generating analysis...\n\n"
        
        # 3. Stream Chat Response (if not just requesting more items)
        # If this is a "Show more" request (offset > 0), we might skip the chat or provide a shorter one.
        # But for now, let's just stream a short acknowledgment or full response.
        
        if request.offset == 0:
            async for chunk in rag_service.stream_chat_response(
                query=request.query,
                products=products,
                intent=parsed_intent,
            ):
                # Clean up chunk to ensure it's safe for SSE data
                 safe_chunk = json.dumps({"text": chunk})
                 yield f"event: token\ndata: {safe_chunk}\n\n"
        
        yield "event: done\ndata: [DONE]\n\n"
        
        # Background: Save history using a fresh session (since request session closes)
        if request.offset == 0 and current_user.id != "guest":
            from app.database import async_session_maker
            
            async with async_session_maker() as session:
                try:
                    query_history = QueryHistory(
                        user_id=current_user.id,
                        query_text=request.query,
                        parsed_intent=str(parsed_intent.model_dump()),
                        response_summary="Streamed Response",
                        source_type=search_result.get("data_source", "unknown"),
                    )
                    session.add(query_history)
                    await session.commit()
    
                    # Update demand
                    if parsed_intent.category:
                        qs = QueryService(session)
                        await qs.increment_demand(parsed_intent.category)
                except Exception as e:
                    print(f"Failed to save history: {e}")

    from fastapi.responses import StreamingResponse
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/health")
async def health_check():
    """Health check endpoint for query service."""
    return {"status": "healthy", "service": "query"}
