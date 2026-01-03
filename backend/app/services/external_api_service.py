from typing import List, Dict, Any, Optional
import httpx
import json
from datetime import datetime

from app.config import get_settings

settings = get_settings()


class ExternalAPIService:
    """
    Service for fetching product data from external APIs.
    
    Used when:
    - Vector search confidence < threshold
    - Category not yet indexed
    - Long-tail product queries
    """
    
    def __init__(self):
        self.rapidapi_key = settings.rapidapi_key
        self.cache: Dict[str, Dict] = {}
        self.cache_ttl = 3600  # 1 hour
    
    async def search_products(
        self,
        query: str,
        category: Optional[str] = None,
        budget_max: Optional[float] = None,
        platform: str = "amazon",
    ) -> List[Dict[str, Any]]:
        """
        Search for products via external APIs.
        Returns normalized product data.
        """
        if not self.rapidapi_key:
            return []
        
        # Check cache first
        cache_key = f"{platform}:{query}:{category}:{budget_max}"
        cached = self._get_cached(cache_key)
        if cached:
            return cached
        
        try:
            if platform == "amazon":
                products = await self._search_amazon(query, category)
            elif platform == "ebay":
                products = await self._search_ebay(query, category)
            else:
                products = await self._search_amazon(query, category)
            
            # Filter by budget
            if budget_max:
                products = [p for p in products if p.get("price", 0) <= budget_max]
            
            # Cache results
            self._set_cached(cache_key, products)
            
            return products
            
        except Exception as e:
            print(f"External API error: {e}")
            return []
    
    async def _search_amazon(
        self,
        query: str,
        category: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Search Amazon products via RapidAPI."""
        # Using Real-Time Amazon Data API on RapidAPI
        url = "https://real-time-amazon-data.p.rapidapi.com/search"
        
        headers = {
            "X-RapidAPI-Key": self.rapidapi_key,
            "X-RapidAPI-Host": "real-time-amazon-data.p.rapidapi.com",
        }
        
        params = {
            "query": query,
            "page": "1",
            "country": "US",
            "category_id": category or "aps",
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params, timeout=10.0)
            
            if response.status_code != 200:
                return []
            
            data = response.json()
            products = data.get("data", {}).get("products", [])
            
            # Normalize to our format
            normalized = []
            for product in products[:10]:  # Limit to 10
                normalized.append({
                    "id": product.get("asin", ""),
                    "external_id": product.get("asin", ""),
                    "title": product.get("product_title", ""),
                    "description": product.get("product_description", ""),
                    "price": self._parse_price(product.get("product_price", "")),
                    "rating": float(product.get("product_star_rating", 0) or 0),
                    "review_count": self._parse_reviews(product.get("product_num_ratings", 0)),
                    "image_url": product.get("product_photo", ""),
                    "affiliate_url": product.get("product_url", ""),
                    "source": "amazon_api",
                    "category": category,
                    "last_updated": datetime.utcnow().isoformat(),
                })
            
            return normalized
    
    async def _search_ebay(
        self,
        query: str,
        category: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Search eBay products via RapidAPI."""
        # Using eBay Search Result API on RapidAPI
        url = "https://ebay-search-result.p.rapidapi.com/search"
        
        headers = {
            "X-RapidAPI-Key": self.rapidapi_key,
            "X-RapidAPI-Host": "ebay-search-result.p.rapidapi.com",
        }
        
        params = {
            "keywords": query,
            "page": "1",
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params, timeout=10.0)
            
            if response.status_code != 200:
                return []
            
            data = response.json()
            products = data.get("results", [])
            
            # Normalize to our format
            normalized = []
            for product in products[:10]:
                normalized.append({
                    "id": product.get("epid", ""),
                    "external_id": product.get("epid", ""),
                    "title": product.get("title", ""),
                    "description": "",
                    "price": self._parse_price(product.get("price", {}).get("value", "")),
                    "rating": 0,  # eBay doesn't always provide ratings
                    "review_count": 0,
                    "image_url": product.get("image", {}).get("imageUrl", ""),
                    "affiliate_url": product.get("itemWebUrl", ""),
                    "source": "ebay_api",
                    "category": category,
                    "last_updated": datetime.utcnow().isoformat(),
                })
            
            return normalized
    
    def _parse_price(self, price_str: str) -> float:
        """Parse price string to float."""
        if isinstance(price_str, (int, float)):
            return float(price_str)
        
        if not price_str:
            return 0.0
        
        # Remove currency symbols and commas
        import re
        cleaned = re.sub(r"[^\d.]", "", str(price_str))
        
        try:
            return float(cleaned) if cleaned else 0.0
        except ValueError:
            return 0.0
    
    def _parse_reviews(self, reviews: Any) -> int:
        """Parse review count to int."""
        if isinstance(reviews, int):
            return reviews
        
        if not reviews:
            return 0
        
        # Handle strings like "1,234" or "1.2K"
        import re
        cleaned = str(reviews).replace(",", "").upper()
        
        if "K" in cleaned:
            cleaned = cleaned.replace("K", "")
            return int(float(cleaned) * 1000)
        elif "M" in cleaned:
            cleaned = cleaned.replace("M", "")
            return int(float(cleaned) * 1000000)
        
        try:
            return int(float(cleaned))
        except ValueError:
            return 0
    
    def _get_cached(self, key: str) -> Optional[List[Dict[str, Any]]]:
        """Get cached results if not expired."""
        if key not in self.cache:
            return None
        
        cached = self.cache[key]
        if datetime.utcnow().timestamp() - cached["timestamp"] > self.cache_ttl:
            del self.cache[key]
            return None
        
        return cached["data"]
    
    def _set_cached(self, key: str, data: List[Dict[str, Any]]):
        """Cache results with timestamp."""
        self.cache[key] = {
            "data": data,
            "timestamp": datetime.utcnow().timestamp(),
        }
