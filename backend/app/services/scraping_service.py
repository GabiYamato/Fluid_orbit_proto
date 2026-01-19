"""
Scraping Service with SerpAPI Primary and Direct Scrape Fallback.

Uses SerpAPI (Google Shopping) as primary source since direct Amazon
scraping is heavily blocked. Falls back to direct scraping with
anti-bot measures if SerpAPI is unavailable.
"""

import asyncio
import httpx
import random
from bs4 import BeautifulSoup
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import quote_plus, urljoin
from datetime import datetime
from app.config import get_settings
import logging

settings = get_settings()

# Configure logger
logger = logging.getLogger("scraper")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        "%(asctime)s | %(levelname)-8s | SCRAPER | %(message)s",
        datefmt="%H:%M:%S"
    ))
    logger.addHandler(handler)

# Rotating User Agents
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]


class ScrapingService:
    """
    Service to scrape product information.
    Primary: SerpAPI (Google Shopping) - Reliable, no blocks
    Fallback: Direct scraping with anti-bot measures
    """
    
    def __init__(self):
        self.serpapi_key = getattr(settings, 'serpapi_key', None)
        if not self.serpapi_key:
            logger.warning("⚠️ SERPAPI_KEY not configured. Direct scraping only (may be blocked).")

    def _get_headers(self) -> Dict[str, str]:
        """Get randomized headers to avoid detection."""
        return {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "max-age=0",
            "DNT": "1",
        }

    async def search_and_scrape(self, query: str, limit: int = 10) -> Dict[str, Any]:
        """
        Search for products. Uses SerpAPI first, then direct scraping.
        """
        logger.info(f"🔍 Searching for: '{query}' (limit: {limit})")
        
        products = []
        total_found = 0
        source = "none"
        
        # Try SerpAPI first (more reliable)
        if self.serpapi_key:
            logger.info("📡 Using SerpAPI (Google Shopping)...")
            products, total_found = await self._search_serpapi(query, limit)
            if products:
                source = "serpapi"
                logger.info(f"✅ SerpAPI returned {len(products)} products")
        
        # Fallback to direct Amazon scraping
        if not products:
            logger.info("🔄 Falling back to direct Amazon scraping...")
            products, total_found = await self._scrape_amazon(query, limit)
            if products:
                source = "amazon_direct"
                logger.info(f"✅ Amazon direct returned {len(products)} products")
        
        # Final fallback to eBay
        if not products:
            logger.info("🔄 Trying eBay as last resort...")
            products = await self._scrape_ebay(query, limit)
            total_found = len(products)
            if products:
                source = "ebay"
                logger.info(f"✅ eBay returned {len(products)} products")
        
        if not products:
            logger.warning(f"❌ No products found for '{query}'")
        
        return {"products": products[:limit], "total_found": total_found, "source": source}

    async def _search_serpapi(self, query: str, limit: int) -> Tuple[List[Dict[str, Any]], int]:
        """Search using SerpAPI Google Shopping."""
        try:
            from serpapi import GoogleSearch
            
            params = {
                "engine": "google_shopping",
                "q": query,
                "api_key": self.serpapi_key,
                "num": min(limit * 2, 40),  # Request more to filter
                "hl": "en",
                "gl": "us",
            }
            
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            search = await loop.run_in_executor(None, lambda: GoogleSearch(params))
            results = await loop.run_in_executor(None, search.get_dict)
            
            shopping_results = results.get("shopping_results", [])
            total_found = len(shopping_results)
            
            products = []
            for item in shopping_results[:limit]:
                try:
                    # Extract price
                    price_str = item.get("extracted_price") or item.get("price", "0")
                    if isinstance(price_str, str):
                        price = self._parse_price(price_str)
                    else:
                        price = float(price_str) if price_str else 0.0
                    
                    products.append({
                        "id": item.get("product_id", item.get("link", "")),
                        "title": item.get("title", ""),
                        "description": item.get("snippet", item.get("title", "")),
                        "price": price,
                        "rating": float(item.get("rating", 0) or 0),
                        "review_count": int(item.get("reviews", 0) or 0),
                        "image_url": item.get("thumbnail", ""),
                        "affiliate_url": item.get("link", ""),
                        "source": item.get("source", "google_shopping"),
                        "last_updated": datetime.utcnow().isoformat(),
                    })
                except Exception as e:
                    logger.debug(f"SerpAPI item parse error: {e}")
                    continue
            
            return products, total_found
            
        except Exception as e:
            logger.error(f"SerpAPI error: {e}")
            return [], 0

    async def _scrape_amazon(self, query: str, limit: int = 10) -> Tuple[List[Dict[str, Any]], int]:
        """Direct Amazon scraping with anti-bot measures."""
        url = f"https://www.amazon.com/s?k={quote_plus(query)}"
        products = []
        total_found = 0
        
        try:
            # Add random delay to seem more human
            await asyncio.sleep(random.uniform(1, 3))
            
            async with httpx.AsyncClient(
                timeout=15.0, 
                follow_redirects=True, 
                headers=self._get_headers()
            ) as client:
                resp = await client.get(url)
                
                # Check for bot detection
                if resp.status_code == 503 or "Sorry!" in resp.text[:500]:
                    logger.warning("⚠️ Amazon detected bot, returning empty")
                    return [], 0
                
                if resp.status_code != 200:
                    logger.warning(f"Amazon HTTP error: {resp.status_code}")
                    return [], 0
                
                soup = BeautifulSoup(resp.text, 'lxml')
                
                # Check for captcha
                if soup.select_one("form[action*='captcha']"):
                    logger.warning("⚠️ Amazon showing captcha, blocked")
                    return [], 0
                
                items = soup.select('[data-component-type="s-search-result"]')
                total_found = len(items)
                logger.info(f"📦 Amazon HTML contains {len(items)} search result divs")
                
                for i, item in enumerate(items):
                    if len(products) >= limit:
                        break
                    
                    try:
                        # Title - try multiple selectors
                        title_el = item.select_one("h2 a span") or item.select_one("h2 span") or item.select_one("h2 a")
                        if not title_el:
                            # logger.debug(f"Amazon Item {i}: Missing title")
                            continue
                        title = title_el.text.strip()
                        
                        # Price - try multiple selectors
                        price_whole = item.select_one(".a-price-whole")
                        price_frac = item.select_one(".a-price-fraction")
                        
                        price = 0.0
                        if price_whole:
                            price_str = f"{price_whole.text.strip()}.{price_frac.text.strip() if price_frac else '00'}"
                            price = self._parse_price(price_str)
                        else:
                            # Try looking for other price classes
                            price_el = item.select_one(".a-color-price") or item.select_one(".a-offscreen")
                            if price_el:
                                price = self._parse_price(price_el.text)
                        
                        if price == 0.0:
                             # logger.debug(f"Amazon Item {i}: Zero/Missing price")
                             # Use a placeholder price if scraping fails but we have other data? 
                             # For now, let's be strict but helpful in logs
                             pass

                        # Image
                        img_el = item.select_one("img.s-image")
                        image_url = img_el['src'] if img_el else ""
                        
                        # Link
                        link_el = item.select_one("h2 a")
                        link = urljoin("https://www.amazon.com", link_el['href']) if link_el else ""
                        
                        # Rating
                        rating_el = item.select_one(".a-icon-star-small .a-icon-alt")
                        rating = 0.0
                        if rating_el:
                            try:
                                rating = float(rating_el.text.split(' ')[0])
                            except:
                                pass
                        
                        # Reviews
                        review_el = item.select_one('[data-csa-c-type="rating"] + span') or item.select_one('.a-size-base.s-underline-text')
                        review_count = 0
                        if review_el:
                            try:
                                review_count = int(review_el.text.replace(',', '').replace('(', '').replace(')', '').strip())
                            except:
                                pass
                        
                        products.append({
                            "id": link,
                            "title": title,
                            "description": title,
                            "price": price,
                            "rating": rating,
                            "review_count": review_count,
                            "image_url": image_url,
                            "affiliate_url": link,
                            "source": "amazon",
                            "last_updated": datetime.utcnow().isoformat()
                        })
                    except Exception as e:
                        # logger.warning(f"Amazon parsing error item {i}: {e}")
                        continue
                        
        except Exception as e:
            logger.error(f"Amazon scrape error: {repr(e)}")
            
        return products, total_found

    async def _scrape_ebay(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Direct eBay scraping (usually less protected)."""
        url = f"https://www.ebay.com/sch/i.html?_nkw={quote_plus(query)}"
        products = []
        
        try:
            await asyncio.sleep(random.uniform(0.5, 1.5))
            
            async with httpx.AsyncClient(
                timeout=15.0, 
                follow_redirects=True, 
                headers=self._get_headers()
            ) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    logger.warning(f"eBay HTTP error: {resp.status_code}")
                    return []
                
                soup = BeautifulSoup(resp.text, 'lxml')
                items = soup.select('.s-item')
                logger.info(f"📦 eBay found {len(items)} items")
                
                for item in items:
                    if len(products) >= limit:
                        break
                    
                    try:
                        title_el = item.select_one(".s-item__title")
                        if not title_el or "Shop on eBay" in title_el.text:
                            continue
                        title = title_el.text.strip()
                        
                        price_el = item.select_one(".s-item__price")
                        if not price_el:
                            continue
                        price = self._parse_price(price_el.text)
                        
                        img_el = item.select_one(".s-item__image-img")
                        image_url = img_el['src'] if img_el and 'src' in img_el.attrs else ""
                        
                        link_el = item.select_one(".s-item__link")
                        link = link_el['href'] if link_el else ""
                        
                        products.append({
                            "id": link,
                            "title": title,
                            "description": title,
                            "price": price,
                            "rating": 0,
                            "review_count": 0,
                            "image_url": image_url,
                            "affiliate_url": link,
                            "source": "ebay",
                            "last_updated": datetime.utcnow().isoformat()
                        })
                    except Exception as e:
                        continue
                        
        except Exception as e:
            logger.error(f"eBay scrape error: {repr(e)}")
            
        return products

    def _parse_price(self, price_raw: Any) -> float:
        """Parse price string to float."""
        if not price_raw:
            return 0.0
        try:
            import re
            s = str(price_raw).replace('$', '').replace(',', '')
            match = re.search(r"[\d\.]+", s)
            if match:
                return float(match.group(0))
            return 0.0
        except:
            return 0.0
