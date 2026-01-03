from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from decimal import Decimal


class ProductScore(BaseModel):
    """Schema for product scoring breakdown."""
    price_score: float
    rating_score: float
    review_volume_score: float
    spec_match_score: float
    final_score: float
    
    class Config:
        json_schema_extra = {
            "example": {
                "price_score": 85.0,
                "rating_score": 90.0,
                "review_volume_score": 75.0,
                "spec_match_score": 80.0,
                "final_score": 82.5
            }
        }


class ProductResponse(BaseModel):
    """Schema for product in API responses."""
    id: str
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    price: Optional[float] = None
    currency: str = "USD"
    rating: Optional[float] = None
    review_count: Optional[int] = None
    image_url: Optional[str] = None
    affiliate_url: Optional[str] = None
    source: str
    last_updated: Optional[datetime] = None
    scores: Optional[ProductScore] = None
    
    class Config:
        from_attributes = True


class RecommendationItem(BaseModel):
    """Schema for a single recommendation."""
    product: ProductResponse
    rank: int
    pros: List[str]
    cons: List[str]
    pick_type: Optional[str] = None  # 'best', 'value', 'budget'


class RecommendationResponse(BaseModel):
    """Schema for full recommendation response."""
    query: str
    recommendations: List[RecommendationItem]
    summary: str
    data_source: str  # 'indexed', 'external_api', 'hybrid'
    confidence_level: str  # 'high', 'medium', 'low'
    disclaimer: Optional[str] = None
    last_updated: datetime
