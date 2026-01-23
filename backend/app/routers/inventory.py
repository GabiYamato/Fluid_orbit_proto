"""
Inventory Scraping API Endpoints.

Provides endpoints to:
- Trigger a full inventory scrape of all 35+ retailers
- Check the status of ongoing/completed scrapes
- Get inventory statistics
"""

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import asyncio
import logging

from app.services.inventory_scrape_service import (
    get_inventory_service,
    get_scrape_status,
    run_inventory_scrape_job,
)

logger = logging.getLogger("inventory_router")

router = APIRouter(prefix="/inventory", tags=["Inventory"])


class ScrapeRequest(BaseModel):
    """Request body for triggering a scrape."""
    queries: Optional[List[str]] = None  # Custom search queries
    async_mode: bool = True  # Run in background


class ScrapeResponse(BaseModel):
    """Response from triggering a scrape."""
    message: str
    status: str
    job_id: Optional[str] = None


@router.post("/scrape", response_model=ScrapeResponse)
async def trigger_inventory_scrape(
    request: ScrapeRequest,
    background_tasks: BackgroundTasks,
):
    """
    Trigger a full inventory scrape of all 35+ fashion retailers.
    
    This will:
    1. Scrape ALL retailers asynchronously (at the same time)
    2. Generate embeddings for all products
    3. Store products in SQLite/PostgreSQL
    4. Store products in Qdrant vector database
    
    By default, runs in the background. Set async_mode=false to wait for completion.
    """
    # Check if already scraping
    status = get_scrape_status()
    if status["is_scraping"]:
        raise HTTPException(
            status_code=409,
            detail="A scrape is already in progress. Check /inventory/status for details."
        )
    
    if request.async_mode:
        # Run in background
        background_tasks.add_task(run_inventory_scrape_job, request.queries)
        return ScrapeResponse(
            message="Inventory scrape started in background",
            status="started",
            job_id="inventory_scrape_" + str(int(asyncio.get_event_loop().time()))
        )
    else:
        # Run synchronously (blocks the request)
        try:
            stats = await run_inventory_scrape_job(request.queries)
            return ScrapeResponse(
                message=f"Scrape completed. {stats.total_products_scraped} products from {stats.successful_retailers}/{stats.total_retailers} retailers.",
                status="completed",
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_inventory_status():
    """
    Get the current inventory scraping status.
    
    Returns:
    - is_scraping: Whether a scrape is currently running
    - current_scrape: Stats for the ongoing scrape (if any)
    - last_scrape: Stats from the most recent completed scrape
    """
    return get_scrape_status()


@router.get("/stats")
async def get_inventory_stats():
    """
    Get inventory database statistics.
    
    Returns counts of products in both SQLite and Qdrant.
    """
    from app.database import async_session_maker
    from app.models.product import Product
    from sqlalchemy import func, select
    
    # Count products in SQLite
    db_count = 0
    sources = {}
    try:
        async with async_session_maker() as session:
            result = await session.execute(select(func.count(Product.id)))
            db_count = result.scalar_one()
            
            # Count by source
            source_result = await session.execute(
                select(Product.source, func.count(Product.id))
                .group_by(Product.source)
            )
            for source, count in source_result:
                sources[source] = count
    except Exception as e:
        logger.error(f"DB stats error: {e}")
    
    # Count products in Qdrant using the singleton service (avoids lock issues)
    vector_count = 0
    vector_error = None
    try:
        service = get_inventory_service()
        if service.qdrant_client:
            try:
                info = service.qdrant_client.get_collection("inventory_products")
                vector_count = info.points_count
            except Exception as e:
                vector_error = f"Collection may not exist yet: {str(e)[:50]}"
    except Exception as e:
        vector_error = str(e)[:100]
        logger.error(f"Qdrant stats error: {e}")
    
    return {
        "database": {
            "total_products": db_count,
            "by_source": sources,
        },
        "vector_db": {
            "total_indexed": vector_count,
            "collection": "inventory_products",
            "error": vector_error,
        },
    }


@router.get("/retailers")
async def list_retailers():
    """
    List all available fashion retailers that will be scraped.
    """
    from app.services.scraping_service import FASHION_RETAILERS
    
    retailers = []
    for key, config in FASHION_RETAILERS.items():
        retailers.append({
            "key": key,
            "name": config["name"],
            "domain": config["domain"],
        })
    
    return {
        "total_retailers": len(retailers),
        "retailers": retailers,
    }


@router.post("/scrape/{retailer_key}")
async def scrape_single_retailer(
    retailer_key: str,
    background_tasks: BackgroundTasks,
    queries: Optional[List[str]] = None,
):
    """
    Trigger a scrape for a single specific retailer.
    Useful for testing or refreshing a specific store.
    """
    from app.services.scraping_service import FASHION_RETAILERS
    
    if retailer_key not in FASHION_RETAILERS:
        raise HTTPException(
            status_code=404,
            detail=f"Retailer '{retailer_key}' not found. Use /inventory/retailers to see available options."
        )
    
    service = get_inventory_service()
    
    async def scrape_task():
        result = await service.scrape_single_retailer(retailer_key, queries)
        if result.success and result.products:
            # Embed and store
            product_embeddings = await service.embed_products(result.products)
            await service.store_in_database(result.products)
            await service.store_in_vector_db(product_embeddings)
        return result
    
    background_tasks.add_task(scrape_task)
    
    retailer_name = FASHION_RETAILERS[retailer_key]["name"]
    return {
        "message": f"Scrape started for {retailer_name}",
        "retailer": retailer_key,
        "status": "started",
    }
