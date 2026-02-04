"""
Scraping Service with Fashion Retailers + SerpAPI + Web Crawler Fallback.
"""

import asyncio
import httpx
from curl_cffi.requests import AsyncSession
import random
import re
from bs4 import BeautifulSoup
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import quote_plus, urljoin, urlparse
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

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

# Comprehensive Fashion Retailers List
FASHION_RETAILERS = {
    "express": {"name": "Express", "domain": "express.com", "search_url": "https://www.express.com/s/{query}", "listing_url": "https://www.express.com/mens-clothing/new-arrivals/cat1490006"},
    "urban_outfitters": {"name": "Urban Outfitters", "domain": "urbanoutfitters.com", "search_url": "https://www.urbanoutfitters.com/search?q={query}", "listing_url": "https://www.urbanoutfitters.com/new-arrivals"},
    "old_navy": {"name": "Old Navy", "domain": "oldnavy.gap.com", "search_url": "https://oldnavy.gap.com/browse/search.do?searchText={query}", "listing_url": "https://oldnavy.gap.com/browse/category.do?cid=5155"},
    "asos": {"name": "ASOS", "domain": "asos.com", "search_url": "https://www.asos.com/us/search/?q={query}", "listing_url": "https://www.asos.com/us/men/new-in/cat/?cid=27110"},
    "us_polo": {"name": "U.S. Polo Assn.", "domain": "uspoloassn.com", "search_url": "https://uspoloassn.com/search?q={query}", "listing_url": "https://uspoloassn.com/collections/new-arrivals"},
    "garage": {"name": "Garage", "domain": "garageclothing.com", "search_url": "https://www.garageclothing.com/us/search?q={query}", "listing_url": "https://www.garageclothing.com/us/g/clothing/new-arrivals/"},
    "banana_factory": {"name": "Banana Republic Factory", "domain": "bananarepublicfactory.gapfactory.com", "search_url": "https://bananarepublicfactory.gapfactory.com/browse/search.do?searchText={query}", "listing_url": "https://bananarepublicfactory.gapfactory.com/browse/category.do?cid=1045227"},
    "hm": {"name": "H&M", "domain": "hm.com", "search_url": "https://www2.hm.com/en_us/search-results.html?q={query}", "listing_url": "https://www2.hm.com/en_us/men/new-arrivals/view-all.html"},
    "abercrombie": {"name": "Abercrombie & Fitch", "domain": "abercrombie.com", "search_url": "https://www.abercrombie.com/shop/us/search?searchTerm={query}", "listing_url": "https://www.abercrombie.com/shop/us/mens-new-arrivals"},
    "edikted": {"name": "Edikted", "domain": "edikted.com", "search_url": "https://edikted.com/search?q={query}", "listing_url": "https://edikted.com/collections/new-in"},
    "hollister": {"name": "Hollister", "domain": "hollisterco.com", "search_url": "https://www.hollisterco.com/shop/us/search?searchTerm={query}", "listing_url": "https://www.hollisterco.com/shop/us/mens-new-arrivals"},
    "altard_state": {"name": "Altar'd State", "domain": "altardstate.com", "search_url": "https://www.altardstate.com/search?q={query}", "listing_url": "https://www.altardstate.com/as/new-arrivals/clothing/"},
    "american_eagle": {"name": "American Eagle", "domain": "ae.com", "search_url": "https://www.ae.com/us/en/search/{query}", "listing_url": "https://www.ae.com/us/en/c/men/new-arrivals/cat7730004"},
    "macys": {"name": "Macy's", "domain": "macys.com", "search_url": "https://www.macys.com/shop/featured/{query}", "listing_url": "https://www.macys.com/shop/mens-clothing/new-arrivals?id=30514"},
    "nordstrom": {"name": "Nordstrom", "domain": "nordstrom.com", "search_url": "https://www.nordstrom.com/sr?keyword={query}", "listing_url": "https://www.nordstrom.com/browse/men/new-arrivals"},
    "saks": {"name": "Saks Fifth Avenue", "domain": "saksfifthavenue.com", "search_url": "https://www.saksfifthavenue.com/search?q={query}", "listing_url": "https://www.saksfifthavenue.com/c/men/new-arrivals"},
    "uniqlo": {"name": "UNIQLO", "domain": "uniqlo.com", "search_url": "https://www.uniqlo.com/us/en/search?q={query}", "listing_url": "https://www.uniqlo.com/us/en/men/new-arrivals"},
    "saks_off": {"name": "Saks OFF 5TH", "domain": "saksoff5th.com", "search_url": "https://www.saksoff5th.com/search?q={query}", "listing_url": "https://www.saksoff5th.com/c/men/new-arrivals"},
    "reformation": {"name": "Reformation", "domain": "thereformation.com", "search_url": "https://www.thereformation.com/search?q={query}", "listing_url": "https://www.thereformation.com/new-arrivals"},
    "everlane": {"name": "Everlane", "domain": "everlane.com", "search_url": "https://www.everlane.com/search?q={query}", "listing_url": "https://www.everlane.com/collections/mens-new-arrivals"},
    "jcrew": {"name": "J.Crew", "domain": "jcrew.com", "search_url": "https://www.jcrew.com/search?q={query}", "listing_url": "https://www.jcrew.com/r/new-arrivals/men"},
    "madewell": {"name": "Madewell", "domain": "madewell.com", "search_url": "https://www.madewell.com/search?q={query}", "listing_url": "https://www.madewell.com/mens/new-arrivals"},
    "anthropologie": {"name": "Anthropologie", "domain": "anthropologie.com", "search_url": "https://www.anthropologie.com/search?q={query}", "listing_url": "https://www.anthropologie.com/new-arrivals"},
    "eloquii": {"name": "ELOQUII", "domain": "eloquii.com", "search_url": "https://www.eloquii.com/search?q={query}", "listing_url": "https://www.eloquii.com/new-arrivals"},
    "girlfriend": {"name": "Girlfriend Collective", "domain": "girlfriend.com", "search_url": "https://girlfriend.com/search?q={query}", "listing_url": "https://girlfriend.com/collections/new-arrivals"},
    "lululemon": {"name": "Lululemon", "domain": "shop.lululemon.com", "search_url": "https://shop.lululemon.com/search?Ntt={query}", "listing_url": "https://shop.lululemon.com/c/whats-new/_/N-1z0xk6o"},
    "aloyoga": {"name": "Alo Yoga", "domain": "aloyoga.com", "search_url": "https://www.aloyoga.com/search?q={query}", "listing_url": "https://www.aloyoga.com/collections/new-arrivals"},
    "bandit": {"name": "Bandit Running", "domain": "banditrunning.com", "search_url": "https://banditrunning.com/search?q={query}", "listing_url": "https://banditrunning.com/collections/new-arrivals"},
    "carbon38": {"name": "Carbon38", "domain": "carbon38.com", "search_url": "https://carbon38.com/search?q={query}", "listing_url": "https://carbon38.com/collections/new-arrivals"},
    "pistola": {"name": "Pistola Denim", "domain": "pistoladenim.com", "search_url": "https://pistoladenim.com/search?q={query}", "listing_url": "https://pistoladenim.com/collections/new-arrivals"},
    "frankie": {"name": "The Frankie Shop", "domain": "thefrankieshop.com", "search_url": "https://thefrankieshop.com/search?q={query}", "listing_url": "https://thefrankieshop.com/collections/new-arrivals-men"},
    "aritzia": {"name": "Aritzia", "domain": "aritzia.com", "search_url": "https://www.aritzia.com/us/en/search?q={query}", "listing_url": "https://www.aritzia.com/us/en/new-arrivals"},
    "shopbop": {"name": "Shopbop", "domain": "shopbop.com", "search_url": "https://www.shopbop.com/s?keywords={query}", "listing_url": "https://www.shopbop.com/clothing-new-arrivals/br/v=1/13444.htm"},
    "wolf_badger": {"name": "Wolf & Badger", "domain": "wolfandbadger.com", "search_url": "https://www.wolfandbadger.com/us/search/?q={query}", "listing_url": "https://www.wolfandbadger.com/us/category/men/new-in/"},
    "revolve": {"name": "Revolve", "domain": "revolve.com", "search_url": "https://www.revolve.com/r/search?q={query}", "listing_url": "https://www.revolve.com/men/new-arrivals/br/662866/"},
    "farfetch": {"name": "Farfetch", "domain": "farfetch.com", "search_url": "https://www.farfetch.com/shopping/women/search/items.aspx?q={query}", "listing_url": "https://www.farfetch.com/shopping/men/new-in/items.aspx"},
    "sustainable": {"name": "Sustainable", "domain": "thereformation.com", "search_url": "https://www.thereformation.com/search?q={query}", "listing_url": "https://www.thereformation.com/new-arrivals"},
}


class ScrapingService:
    """Targeted and Fallback scraping."""
    
    def __init__(self):
        self.serpapi_key = getattr(settings, 'serpapi_key', None)
        self.retailer_concurrency = 10  # Scrape 10 stores concurrently

    def _get_headers(self) -> Dict[str, str]:
        return {"User-Agent": random.choice(USER_AGENTS)}

    async def search_and_scrape(self, query: str, limit: int = 10) -> Dict[str, Any]:
        """Implements the multi-level discovery logic."""
        logger.info(f"🚀 LEVEL 2: Scraping Fashion Retailers + SerpAPI for '{query}'")
        
        all_products = []
        sources = []
        
        # Step 1: Run Retailer Scrape + SerpAPI concurrently
        tasks = [
            self._scrape_fashion_retailers(query),
            self._search_serpapi(query, limit)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Collect results
        for res in results:
            if isinstance(res, tuple) and len(res) == 2:
                prods, src_list = res
                all_products.extend(prods)
                sources.extend(src_list)

        # Step 2: LEVEL 3: Deep Web Crawler Fallback
        if len(all_products) < 5:
            logger.info("🚨 LEVEL 3: Low results. Launching Web Crawler...")
            crawled = await self._crawl_web(query, limit=10)
            if crawled:
                all_products.extend(crawled)
                sources.append("web_crawler")

        # Deduplicate
        unique_products = self._deduplicate(all_products)
        
        return {
            "products": unique_products,
            "total_found": len(unique_products),
            "source": ", ".join(set(sources))
        }

    async def _scrape_fashion_retailers(self, query: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """Scrape ALL retailers simultaneously for maximum speed and product count."""
        products = []
        effective_sources = []
        
        retailer_keys = list(FASHION_RETAILERS.keys())
        
        # Scrape ALL retailers at once (truly async)
        logger.info(f"🚀 Scraping ALL {len(retailer_keys)} retailers simultaneously...")
        
        tasks = [self._scrape_single_store(k, query) for k in retailer_keys]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for idx, res in enumerate(results):
            if isinstance(res, list) and res:
                products.extend(res)
                effective_sources.append(retailer_keys[idx])
        
        logger.info(f"✅ Scraped {len(products)} products from {len(effective_sources)} retailers")
        return products, effective_sources

    async def _scrape_single_store(self, key: str, query: Optional[str] = None, use_listing: bool = False) -> List[Dict[str, Any]]:
        """Scrapes a single fashion store using generic e-commerce patterns."""
        config = FASHION_RETAILERS[key]
        
        if use_listing:
            url = config.get("listing_url") or f"https://{config['domain']}"
            logger.info(f"📋 BROAD SCRAPE: {config['name']} from {url}")
        else:
            url = config["search_url"].format(query=quote_plus(query or ""))
        
        try:
            # Using curl_cffi to impersonate Chrome 124 to bypass Cloudflare/TLS blocks
            async with AsyncSession(impersonate="chrome124", headers=self._get_headers(), timeout=15) as client:
                resp = await client.get(url)
                if resp.status_code != 200: return []
                
                soup = BeautifulSoup(resp.text, 'lxml')
                
                # Generic e-commerce detection strategy
                items = soup.select('.product-card, .product-item, .product-tile, article, [class*="product"]')
                if not items:
                     items = soup.select('li, div[data-product-id]')
                     
                found = []
                
                for item in items[:15]:  # Increased from 10 to 15 per retailer
                    try:
                        title_el = item.select_one('h2, h3, h4, [class*="title"], [class*="name"], .pdp-link, a[class*="link"]')
                        if not title_el: continue
                        title = title_el.get_text(strip=True)
                        if len(title) < 3: continue
                        
                        # Extract description from multiple sources
                        description = ""
                        desc_selectors = [
                            '[class*="description"]',
                            '[class*="desc"]',
                            '[class*="subtitle"]',
                            '[class*="detail"]',
                            '[class*="info"]',
                            'p',
                            '.product-description',
                            '.product-info',
                            '[class*="summary"]',
                        ]
                        for desc_sel in desc_selectors:
                            desc_el = item.select_one(desc_sel)
                            if desc_el:
                                desc_text = desc_el.get_text(strip=True)
                                # Only use if it's different from title and has meaningful content
                                if desc_text and len(desc_text) > 10 and desc_text.lower() != title.lower():
                                    description = desc_text[:200]  # Truncate to 200 chars
                                    break
                        
                        # Fallback: try to get alt text from image
                        if not description:
                            img_for_alt = item.select_one('img[alt]')
                            if img_for_alt:
                                alt_text = img_for_alt.get('alt', '')
                                if alt_text and len(alt_text) > 10 and alt_text.lower() != title.lower():
                                    description = alt_text[:200]
                        
                        # If still no description, use formatted title with source info
                        if not description:
                            description = f"{title} from {config['name']}"
                        
                        # Enhanced price extraction with multiple selectors
                        price_selectors = [
                            '[class*="price"]',
                            '[class*="Price"]',
                            '.price',
                            '.product-price',
                            '[data-price]',
                            'span[class*="amount"]',
                            '.sale-price',
                            '.current-price',
                            '.regular-price',
                            '[class*="cost"]',
                            '[class*="value"]',
                            '.money',
                            '[data-product-price]',
                        ]
                        price = 0.0
                        for selector in price_selectors:
                            price_el = item.select_one(selector)
                            if price_el:
                                # Try multiple attribute sources for price
                                price_text = (
                                    price_el.get('data-price') or 
                                    price_el.get('data-product-price') or 
                                    price_el.get('content') or 
                                    price_el.get_text()
                                )
                                price = self._parse_price(price_text)
                                if price > 0:
                                    break
                        
                        # STRICT: Skip products without valid price
                        if price <= 0:
                            continue
                        
                        # improved link extraction
                        link_el = item.select_one('a[href]')
                        # Try to find a link that looks like a product link if the first one isn't great
                        if not link_el or (link_el['href'].startswith('#') or 'javascript' in link_el['href']):
                             link_el = item.find('a', href=re.compile(r'/'))
                        
                        if not link_el: continue
                        
                        raw_link = link_el['href']
                        link = urljoin(f"https://{config['domain']}", raw_link)
                        
                        # STRICT: Skip products without valid link
                        if not link or not link.startswith('http'):
                            continue
                        
                        img_el = item.select_one('img')
                        img = ""
                        if img_el:
                            img = img_el.get('src') or img_el.get('data-src') or img_el.get('data-lazy-src') or ""
                            if img and not img.startswith('http'):
                                img = urljoin(f"https://{config['domain']}", img)
                        
                        found.append({
                            "id": link,
                            "title": title,
                            "description": description,
                            "price": price,
                            "image_url": img,
                            "affiliate_url": link,
                            "source": config["name"],
                            "last_updated": datetime.utcnow().isoformat()
                        })
                    except: continue
                return found
        except: return []

    async def _search_serpapi(self, query: str, limit: int) -> Tuple[List[Dict[str, Any]], List[str]]:
        if not self.serpapi_key: return [], []
        try:
            from serpapi import GoogleSearch
            params = {"engine": "google_shopping", "q": query, "api_key": self.serpapi_key, "num": limit}
            loop = asyncio.get_event_loop()
            search = await loop.run_in_executor(None, lambda: GoogleSearch(params))
            results = await loop.run_in_executor(None, search.get_dict)
            
            prods = []
            for item in results.get("shopping_results", []):
                price = self._parse_price(item.get("extracted_price") or item.get("price"))
                link = item.get("link", "")
                
                # STRICT: Only include products with valid price AND link
                if price <= 0 or not link or not link.startswith("http"):
                    continue
                
                # Extract description from SerpAPI response
                title = item.get("title", "")
                source = item.get("source", "Google Shopping")
                description = item.get("snippet") or item.get("description") or ""
                if not description or len(description) < 10:
                    # Build a basic description with available info
                    rating = item.get("rating")
                    reviews = item.get("reviews")
                    if rating:
                        description = f"{title}. Rated {rating}★"
                        if reviews:
                            description += f" ({reviews} reviews)"
                        description += f" on {source}."
                    else:
                        description = f"{title} from {source}."
                
                prods.append({
                    "id": item.get("product_id", link),
                    "title": title,
                    "description": description[:200],  # Truncate
                    "price": price,
                    "rating": item.get("rating"),
                    "review_count": item.get("reviews"),
                    "image_url": item.get("thumbnail"),
                    "affiliate_url": link,
                    "source": source,
                    "last_updated": datetime.utcnow().isoformat()
                })
            return prods, ["google_shopping"]
        except: return [], []

    async def _crawl_web(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Simple DuckDuckGo discovery + page scrape."""
        try:
            search_url = f"https://html.duckduckgo.com/html/?q={quote_plus(query + ' shop')}"
            async with AsyncSession(impersonate="chrome124", headers=self._get_headers()) as client:
                resp = await client.get(search_url)
                soup = BeautifulSoup(resp.text, 'lxml')
                links = [a['href'] for a in soup.select('.result__a') if 'http' in a['href']][:3]
                
                results = []
                for link in links:
                    r = await client.get(link, timeout=5.0)
                    s = BeautifulSoup(r.text, 'lxml')
                    title = s.title.string if s.title else ""
                    if len(title) > 5:
                        results.append({
                            "id": link, "title": title, "price": 0, "source": urlparse(link).netloc,
                            "affiliate_url": link, "last_updated": datetime.utcnow().isoformat()
                        })
                return results
        except: return []

    def _deduplicate(self, products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        seen = set()
        unique = []
        for p in products:
            clean = re.sub(r'[^\w]', '', p['title'].lower())
            if clean not in seen:
                seen.add(clean)
                unique.append(p)
        return unique

    def _parse_price(self, p: Any) -> float:
        try:
            s = str(p).replace('$', '').replace(',', '')
            m = re.search(r"[\d\.]+", s)
            return float(m.group(0)) if m else 0.0
        except: return 0.0
