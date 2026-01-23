from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime


class SaveProductRequest(BaseModel):
    """Request schema for saving a product."""
    product_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    price: Optional[float] = None
    currency: str = "USD"
    rating: Optional[float] = None
    review_count: Optional[int] = None
    image_url: Optional[str] = None
    affiliate_url: str  # Required - the product link
    source: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    notes: Optional[str] = None


class SavedProductResponse(BaseModel):
    """Response schema for a saved product."""
    id: str
    user_id: str
    product_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    price: Optional[float] = None
    currency: str = "USD"
    rating: Optional[float] = None
    review_count: Optional[int] = None
    image_url: Optional[str] = None
    affiliate_url: str
    source: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    notes: Optional[str] = None
    saved_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SavedProductsListResponse(BaseModel):
    """Response schema for listing saved products."""
    products: list[SavedProductResponse]
    total: int


class UpdateSavedProductRequest(BaseModel):
    """Request schema for updating a saved product."""
    notes: Optional[str] = None
