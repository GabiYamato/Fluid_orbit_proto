"""
Product Enrichment Router.

Provides endpoints to enrich product data by crawling product pages
for better images and descriptions.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import logging

from app.services.product_enrichment_service import get_enrichment_service

# Configure logger
logger = logging.getLogger("product_router")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        "%(asctime)s | %(levelname)-8s | PRODUCT | %(message)s",
        datefmt="%H:%M:%S"
    ))
    logger.addHandler(handler)

router = APIRouter(prefix="/products", tags=["Products"])


class EnrichRequest(BaseModel):
    """Request to enrich a single product by URL."""
    url: str


class EnrichBatchRequest(BaseModel):
    """Request to enrich multiple products."""
    products: List[dict]
    max_concurrent: int = 5


class EnrichmentResult(BaseModel):
    """Result of product enrichment."""
    url: str
    images: List[str] = []
    description: str = ""
    price: Optional[float] = None
    enriched: bool = False
    error: Optional[str] = None


@router.post("/enrich", response_model=EnrichmentResult)
async def enrich_product(request: EnrichRequest):
    """
    Enrich a single product by crawling its product page.
    
    This extracts:
    - High-quality product images
    - Detailed description
    - Confirmed price
    
    Use this endpoint to get better product data for display.
    """
    if not request.url or not request.url.startswith('http'):
        raise HTTPException(status_code=400, detail="Invalid URL")
    
    logger.info(f"📦 Enrichment request: {request.url[:60]}...")
    
    service = get_enrichment_service()
    result = await service.enrich_product(request.url)
    
    return EnrichmentResult(
        url=request.url,
        images=result.get("images", []),
        description=result.get("description", ""),
        price=result.get("price"),
        enriched=result.get("enriched", False),
        error=result.get("error"),
    )


@router.post("/enrich-batch")
async def enrich_products_batch(request: EnrichBatchRequest):
    """
    Enrich multiple products concurrently.
    
    Returns the product list with enriched images/descriptions.
    """
    if not request.products:
        return {"products": []}
    
    logger.info(f"📦 Batch enrichment: {len(request.products)} products")
    
    service = get_enrichment_service()
    enriched = await service.enrich_products_batch(
        request.products, 
        max_concurrent=min(request.max_concurrent, 10)  # Cap at 10
    )
    
    return {"products": enriched}
