from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.database import get_db
from app.models.user import User
from app.models.query_history import QueryHistory
from app.schemas.query import QueryHistoryResponse, QueryHistoryItem
from app.utils.jwt import get_current_user

router = APIRouter(prefix="/history", tags=["History"])


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
        from fastapi import HTTPException, status
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
    from sqlalchemy import delete
    
    await db.execute(
        delete(QueryHistory).where(QueryHistory.user_id == current_user.id)
    )
    await db.commit()
    
    return {"message": "Query history cleared"}
