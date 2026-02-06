"""
Jina AI Reader-based Scraping Service.

Uses the Jina Reader API (r.jina.ai) to extract clean, LLM-friendly content
from fashion retailer websites. This provides more reliable extraction than
raw HTML parsing and works better with Cloudflare-protected sites.
"""

import asyncio
import httpx
import json
import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from urllib.parse import quote_plus

from app.config import get_settings

settings = get_settings()

# Configure logger
logger = logging.getLogger("jina_scraper")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        "%(asctime)s | %(levelname)-8s | JINA | %(message)s",
        datefmt="%H:%M:%S"
    ))
    logger.addHandler(handler)

# Fashion Retailers Configuration
FASHION_RETAILERS: Dict[str, Dict[str, str]] = {
    "express": {"name": "Express", "domain": "express.com", "search_url": "https://www.express.com/s/{query}"},
    "urban_outfitters": {"name": "Urban Outfitters", "domain": "urbanoutfitters.com", "search_url": "https://www.urbanoutfitters.com/search?q={query}"},
    "old_navy": {"name": "Old Navy", "domain": "oldnavy.gap.com", "search_url": "https://oldnavy.gap.com/browse/search.do?searchText={query}"},
    "asos": {"name": "ASOS", "domain": "asos.com", "search_url": "https://www.asos.com/us/search/?q={query}"},
    "hm": {"name": "H&M", "domain": "hm.com", "search_url": "https://www2.hm.com/en_us/search-results.html?q={query}"},
    "abercrombie": {"name": "Abercrombie & Fitch", "domain": "abercrombie.com", "search_url": "https://www.abercrombie.com/shop/us/search?searchTerm={query}"},
    "hollister": {"name": "Hollister", "domain": "hollisterco.com", "search_url": "https://www.hollisterco.com/shop/us/search?searchTerm={query}"},
    "american_eagle": {"name": "American Eagle", "domain": "ae.com", "search_url": "https://www.ae.com/us/en/search/{query}"},
    "macys": {"name": "Macy's", "domain": "macys.com", "search_url": "https://www.macys.com/shop/featured/{query}"},
    "nordstrom": {"name": "Nordstrom", "domain": "nordstrom.com", "search_url": "https://www.nordstrom.com/sr?keyword={query}"},
    "uniqlo": {"name": "UNIQLO", "domain": "uniqlo.com", "search_url": "https://www.uniqlo.com/us/en/search?q={query}"},
    "reformation": {"name": "Reformation", "domain": "thereformation.com", "search_url": "https://www.thereformation.com/search?q={query}"},
    "everlane": {"name": "Everlane", "domain": "everlane.com", "search_url": "https://www.everlane.com/search?q={query}"},
    "jcrew": {"name": "J.Crew", "domain": "jcrew.com", "search_url": "https://www.jcrew.com/search?q={query}"},
    "madewell": {"name": "Madewell", "domain": "madewell.com", "search_url": "https://www.madewell.com/search?q={query}"},
    "anthropologie": {"name": "Anthropologie", "domain": "anthropologie.com", "search_url": "https://www.anthropologie.com/search?q={query}"},
    "lululemon": {"name": "Lululemon", "domain": "shop.lululemon.com", "search_url": "https://shop.lululemon.com/search?Ntt={query}"},
    "aloyoga": {"name": "Alo Yoga", "domain": "aloyoga.com", "search_url": "https://www.aloyoga.com/search?q={query}"},
    "aritzia": {"name": "Aritzia", "domain": "aritzia.com", "search_url": "https://www.aritzia.com/us/en/search?q={query}"},
    "shopbop": {"name": "Shopbop", "domain": "shopbop.com", "search_url": "https://www.shopbop.com/s?keywords={query}"},
    "revolve": {"name": "Revolve", "domain": "revolve.com", "search_url": "https://www.revolve.com/r/search?q={query}"},
    "farfetch": {"name": "Farfetch", "domain": "farfetch.com", "search_url": "https://www.farfetch.com/shopping/women/search/items.aspx?q={query}"},
    "zara": {"name": "Zara", "domain": "zara.com", "search_url": "https://www.zara.com/us/en/search?searchTerm={query}"},
    "gap": {"name": "Gap", "domain": "gap.com", "search_url": "https://www.gap.com/browse/search.do?searchText={query}"},
    "banana_republic": {"name": "Banana Republic", "domain": "bananarepublic.gap.com", "search_url": "https://bananarepublic.gap.com/browse/search.do?searchText={query}"},
}


class JinaScraperService:
    """
    Scraping service using Jina AI Reader API for reliable content extraction.
    
    The Jina Reader API:
    - Handles Cloudflare and bot protection
    - Returns clean markdown content
    - Supports JavaScript-rendered pages
    - Free tier: 1000 requests/day
    """
    
    JINA_READER_URL = "https://r.jina.ai"
    JINA_SEARCH_URL = "https://s.jina.ai"
    
    def __init__(self):
        self.jina_api_key = getattr(settings, 'jina_api_key', None)
        self.gemini_client = None
        self._init_gemini()
    
    def _init_gemini(self):
        """Initialize Gemini for structured extraction."""
        if settings.gemini_api_key:
            try:
                from google import genai
                self.gemini_client = genai.Client(api_key=settings.gemini_api_key)
                self.model_name = "gemini-2.0-flash-lite"
                logger.info("✅ Gemini initialized for product extraction")
            except Exception as e:
                logger.warning(f"Gemini init error: {e}")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for Jina API requests."""
        headers = {
            "Accept": "application/json",
            "X-Return-Format": "markdown",
        }
        if self.jina_api_key:
            headers["Authorization"] = f"Bearer {self.jina_api_key}"
        return headers
    
    async def _fetch_with_jina(self, url: str) -> Optional[str]:
        """Fetch a URL using Jina Reader API."""
        jina_url = f"{self.JINA_READER_URL}/{url}"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(jina_url, headers=self._get_headers())
                
                if response.status_code == 200:
                    # Jina returns markdown content
                    return response.text
                else:
                    logger.debug(f"Jina fetch failed for {url}: {response.status_code}")
                    return None
        except Exception as e:
            logger.debug(f"Jina fetch error for {url}: {e}")
            return None
    
    async def _extract_products_with_gemini(
        self,
        content: str,
        retailer_name: str,
        retailer_domain: str,
    ) -> List[Dict[str, Any]]:
        """
        Use Gemini to extract structured product data from markdown content.
        This is more reliable than regex/HTML parsing for varied site structures.
        """
        if not self.gemini_client or not content:
            return []
        
        # Truncate content to avoid token limits
        content = content[:15000]
        
        prompt = f"""You are a product data extractor. Extract ALL products from this {retailer_name} search results page.

CONTENT:
{content}

For each product found, extract:
- title: Product name
- price: Numeric price (USD, no $ symbol)
- description: Brief description if available (or create from title)
- image_url: Image URL if visible
- product_url: Product page URL (make absolute using domain: {retailer_domain})

Return a JSON array of products. Only include products with BOTH title AND price.
If price shows a range (e.g., "$50-$70"), use the lower price.
If no products found, return empty array: []

Example format:
[
  {{"title": "Classic Cotton T-Shirt", "price": 29.99, "description": "Comfortable cotton tee", "image_url": "https://...", "product_url": "https://..."}}
]

Return ONLY the JSON array, no explanation."""

        try:
            response = self.gemini_client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config={
                    'temperature': 0.1,
                    'response_mime_type': 'application/json',
                }
            )
            
            result_text = response.text.strip()
            
            # Parse JSON
            products = json.loads(result_text)
            
            if not isinstance(products, list):
                return []
            
            # Validate and normalize products
            valid_products = []
            for p in products:
                if not p.get('title') or not p.get('price'):
                    continue
                
                try:
                    price = float(str(p.get('price', 0)).replace('$', '').replace(',', ''))
                    if price <= 0:
                        continue
                except:
                    continue
                
                product_url = p.get('product_url', '')
                if product_url and not product_url.startswith('http'):
                    product_url = f"https://{retailer_domain}{product_url}"
                
                valid_products.append({
                    "id": product_url or f"{retailer_name}-{p.get('title', '')[:30]}",
                    "title": p.get('title', ''),
                    "description": p.get('description', f"{p.get('title', '')} from {retailer_name}"),
                    "price": price,
                    "image_url": p.get('image_url', ''),
                    "affiliate_url": product_url,
                    "source": retailer_name,
                    "last_updated": datetime.utcnow().isoformat(),
                })
            
            return valid_products[:15]  # Limit per retailer
            
        except Exception as e:
            logger.debug(f"Gemini extraction error for {retailer_name}: {e}")
            return []
    
    async def scrape_retailer(
        self,
        retailer_key: str,
        query: str,
    ) -> Tuple[List[Dict[str, Any]], bool]:
        """
        Scrape a single retailer using Jina + Gemini.
        
        Returns:
            Tuple of (products, success)
        """
        config = FASHION_RETAILERS.get(retailer_key)
        if not config:
            return [], False
        
        retailer_name = config["name"]
        domain = config["domain"]
        search_url = config["search_url"].format(query=quote_plus(query))
        
        try:
            # Step 1: Fetch page with Jina Reader
            content = await self._fetch_with_jina(search_url)
            
            if not content:
                return [], False
            
            # Step 2: Extract products with Gemini
            products = await self._extract_products_with_gemini(
                content=content,
                retailer_name=retailer_name,
                retailer_domain=domain,
            )
            
            if products:
                logger.info(f"✅ {retailer_name}: {len(products)} products")
                return products, True
            else:
                return [], False
                
        except Exception as e:
            logger.debug(f"❌ {retailer_name}: {e}")
            return [], False
    
    async def search_and_scrape(
        self,
        query: str,
        limit: int = 10,
        max_retailers: int = 10,
    ) -> Dict[str, Any]:
        """
        Search multiple retailers concurrently using Jina + Gemini.
        
        Args:
            query: Search query
            limit: Max products to return
            max_retailers: Max retailers to query (for rate limiting)
            
        Returns:
            Dict with products and metadata
        """
        logger.info(f"🚀 Jina Scraper: Searching '{query}' across {max_retailers} retailers")
        
        all_products = []
        sources = []
        
        # Select retailers to scrape
        retailer_keys = list(FASHION_RETAILERS.keys())[:max_retailers]
        
        # Create tasks for concurrent scraping
        tasks = [
            self.scrape_retailer(key, query)
            for key in retailer_keys
        ]
        
        # Run all scrapes concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for idx, result in enumerate(results):
            if isinstance(result, Exception):
                continue
            
            products, success = result
            if success and products:
                all_products.extend(products)
                sources.append(retailer_keys[idx])
        
        # Deduplicate by title
        seen_titles = set()
        unique_products = []
        for p in all_products:
            title_key = re.sub(r'[^\w]', '', p.get('title', '').lower())
            if title_key not in seen_titles:
                seen_titles.add(title_key)
                unique_products.append(p)
        
        logger.info(f"📊 Total: {len(unique_products)} unique products from {len(sources)} retailers")
        
        return {
            "products": unique_products[:limit * 3],  # Return more for filtering
            "total_found": len(unique_products),
            "source": ", ".join(sources) if sources else "jina_reader",
        }
    
    async def jina_web_search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Use Jina's search endpoint (s.jina.ai) to find products across the web.
        This is a fallback when direct retailer scraping fails.
        """
        search_url = f"{self.JINA_SEARCH_URL}/{quote_plus(query + ' buy online fashion')}"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(search_url, headers=self._get_headers())
                
                if response.status_code != 200:
                    return []
                
                content = response.text
                
                # Use Gemini to extract product links and info
                if self.gemini_client:
                    return await self._extract_products_with_gemini(
                        content=content,
                        retailer_name="Web Search",
                        retailer_domain="",
                    )
                
                return []
                
        except Exception as e:
            logger.warning(f"Jina web search error: {e}")
            return []


# Singleton instance
_jina_scraper: Optional[JinaScraperService] = None


def get_jina_scraper() -> JinaScraperService:
    """Get or create the Jina scraper singleton."""
    global _jina_scraper
    if _jina_scraper is None:
        _jina_scraper = JinaScraperService()
    return _jina_scraper
