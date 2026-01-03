from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, List


class QueryRequest(BaseModel):
    """Schema for product query request."""
    query: str
    max_results: int = 5
    
    class Config:
        json_schema_extra = {
            "example": {
                "query": "best wireless earbuds under $100",
                "max_results": 5
            }
        }


class ParsedIntent(BaseModel):
    """Schema for parsed query intent."""
    category: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    features: List[str] = []
    brand_preferences: List[str] = []
    use_case: Optional[str] = None


class QueryResponse(BaseModel):
    """Schema for query response."""
    query: str
    parsed_intent: ParsedIntent
    recommendations: List[dict]
    summary: str
    data_source: str
    confidence_level: str
    disclaimer: Optional[str] = None
    response_time_ms: int


class QueryHistoryItem(BaseModel):
    """Schema for a single query history item."""
    id: str
    query_text: str
    response_summary: Optional[str] = None
    source_type: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class QueryHistoryResponse(BaseModel):
    """Schema for query history response."""
    queries: List[QueryHistoryItem]
    total: int
    page: int
    per_page: int
