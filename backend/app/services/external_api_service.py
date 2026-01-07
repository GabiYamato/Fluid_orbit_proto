from typing import List, Dict, Any, Optional
import httpx
from datetime import datetime
from serpapi import GoogleSearch

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
        self.serpapi_key = settings.serpapi_key
        self.cache: Dict[str, Dict] = {}
        self.cache_ttl = 3600  # 1 hour
    
    async def search_products(
        self,
        query: str,
        category: Optional[str] = None,
        budget_max: Optional[float] = None,
        platform: str = "amazon",
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Search for products via external APIs.
        Returns normalized product data.
        """
        if not self.rapidapi_key and not self.serpapi_key: # Added check for serpapi_key
            print("No API keys found for external services.")
            return []
        
        # Check cache first (include offset in key)
        cache_key = f"{platform}:{query}:{category}:{budget_max}:{offset}"
        cached = self._get_cached(cache_key)
        if cached:
            return cached
        
        try:
            products = []
            if platform == "amazon":
                # Only Amazon/Google implementation supports proper offset passing for now
                products = await self._search_amazon(query, category, offset=offset)
            elif platform == "ebay":
                products = await self._search_ebay(query, category)
            else:
                products = await self._search_amazon(query, category, offset=offset)
            
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
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Search Amazon/Google products via SerpAPI."""
        if not self.serpapi_key:
            print("SerpAPI key not found, skipping search")
            return []

        try:
            print(f"SerpAPI Search (Google Shopping) [Offset {offset}]: {query}")
            params = {
                "engine": "google_shopping",
                "q": query,
                "api_key": self.serpapi_key,
                "google_domain": "google.com",
                "hl": "en",
                "gl": "us",
                "start": offset,
                "num": 10, # Fetch 10 items
            }
            
            if category:
                pass

            # Run in executor to avoid blocking async loop since SerpAPI is sync
            import asyncio
            from functools import partial
            
            loop = asyncio.get_running_loop()
            search = GoogleSearch(params)
            results = await loop.run_in_executor(None, search.get_dict)
            
            if "error" in results:
                print(f"SerpAPI Error: {results['error']}")
                return []
                
            shopping_results = results.get("shopping_results", [])
            
            # Normalize to our format
            normalized = []
            for product in shopping_results: 
                link = product.get("link", "")
                if link and link.startswith("/"):
                    link = f"https://www.google.com{link}"
                
                normalized.append({
                    "id": product.get("product_id", "") or product.get("docid", ""),
                    "external_id": product.get("product_id", "") or product.get("docid", ""),
                    "title": product.get("title", ""),
                    "description": product.get("snippet", "") or product.get("source", ""),
                    "price": self._parse_price(product.get("price")),
                    "rating": float(product.get("rating", 0)),
                    "review_count": product.get("reviews", 0),
                    "image_url": product.get("thumbnail", ""),
                    "affiliate_url": link,
                    "source": "google_shopping",
                    "last_updated": datetime.utcnow().isoformat(),
                })
            
            return normalized

        except Exception as e:
            print(f"Amazon search error: {e}")
            return []
    
    async def _search_ebay(
        self,
        query: str,
        category: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Search eBay products via RapidAPI."""
        if not self.rapidapi_key:
            return []

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
    
    def _parse_price(self, price_val: Any) -> float:
        """Parse price value to float."""
        if not price_val:
            return 0.0
            
        if isinstance(price_val, (int, float)):
            return float(price_val)
        
        # Handle string like "$1,234.99"
        import re
        cleaned = re.sub(r"[^\d.]", "", str(price_val))
        
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
