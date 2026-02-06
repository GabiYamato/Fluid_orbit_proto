"""
Scraping Service - Parallel Multi-Level Scraping.

All scraping levels run SIMULTANEOUSLY:
- Level 1: Jina Reader API (clean markdown extraction + regex parsing)
- Level 2: Raw HTML scraping with curl_cffi
- Level 3: SerpAPI + Web Crawler

NO Gemini calls for extraction - only used for final response generation.
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

# Comprehensive Fashion Retailers List (35+ retailers - NO Amazon)
FASHION_RETAILERS = {
    # Fashion retailers only
    "express": {"name": "Express", "domain": "express.com", "search_url": "https://www.express.com/s/{query}"},
    "urban_outfitters": {"name": "Urban Outfitters", "domain": "urbanoutfitters.com", "search_url": "https://www.urbanoutfitters.com/search?q={query}"},
    "old_navy": {"name": "Old Navy", "domain": "oldnavy.gap.com", "search_url": "https://oldnavy.gap.com/browse/search.do?searchText={query}"},
    "asos": {"name": "ASOS", "domain": "asos.com", "search_url": "https://www.asos.com/us/search/?q={query}"},
    "us_polo": {"name": "U.S. Polo Assn.", "domain": "uspoloassn.com", "search_url": "https://uspoloassn.com/search?q={query}"},
    "garage": {"name": "Garage", "domain": "garageclothing.com", "search_url": "https://www.garageclothing.com/us/search?q={query}"},
    "banana_factory": {"name": "Banana Republic Factory", "domain": "bananarepublicfactory.gapfactory.com", "search_url": "https://bananarepublicfactory.gapfactory.com/browse/search.do?searchText={query}"},
    "hm": {"name": "H&M", "domain": "hm.com", "search_url": "https://www2.hm.com/en_us/search-results.html?q={query}"},
    "abercrombie": {"name": "Abercrombie & Fitch", "domain": "abercrombie.com", "search_url": "https://www.abercrombie.com/shop/us/search?searchTerm={query}"},
    "edikted": {"name": "Edikted", "domain": "edikted.com", "search_url": "https://edikted.com/search?q={query}"},
    "hollister": {"name": "Hollister", "domain": "hollisterco.com", "search_url": "https://www.hollisterco.com/shop/us/search?searchTerm={query}"},
    "altard_state": {"name": "Altar'd State", "domain": "altardstate.com", "search_url": "https://www.altardstate.com/search?q={query}"},
    "american_eagle": {"name": "American Eagle", "domain": "ae.com", "search_url": "https://www.ae.com/us/en/search/{query}"},
    "macys": {"name": "Macy's", "domain": "macys.com", "search_url": "https://www.macys.com/shop/featured/{query}"},
    "nordstrom": {"name": "Nordstrom", "domain": "nordstrom.com", "search_url": "https://www.nordstrom.com/sr?keyword={query}"},
    "saks": {"name": "Saks Fifth Avenue", "domain": "saksfifthavenue.com", "search_url": "https://www.saksfifthavenue.com/search?q={query}"},
    "uniqlo": {"name": "UNIQLO", "domain": "uniqlo.com", "search_url": "https://www.uniqlo.com/us/en/search?q={query}"},
    "saks_off": {"name": "Saks OFF 5TH", "domain": "saksoff5th.com", "search_url": "https://www.saksoff5th.com/search?q={query}"},
    "reformation": {"name": "Reformation", "domain": "thereformation.com", "search_url": "https://www.thereformation.com/search?q={query}"},
    "everlane": {"name": "Everlane", "domain": "everlane.com", "search_url": "https://www.everlane.com/search?q={query}"},
    "jcrew": {"name": "J.Crew", "domain": "jcrew.com", "search_url": "https://www.jcrew.com/search?q={query}"},
    "madewell": {"name": "Madewell", "domain": "madewell.com", "search_url": "https://www.madewell.com/search?q={query}"},
    "anthropologie": {"name": "Anthropologie", "domain": "anthropologie.com", "search_url": "https://www.anthropologie.com/search?q={query}"},
    "eloquii": {"name": "ELOQUII", "domain": "eloquii.com", "search_url": "https://www.eloquii.com/search?q={query}"},
    "girlfriend": {"name": "Girlfriend Collective", "domain": "girlfriend.com", "search_url": "https://girlfriend.com/search?q={query}"},
    "lululemon": {"name": "Lululemon", "domain": "shop.lululemon.com", "search_url": "https://shop.lululemon.com/search?Ntt={query}"},
    "aloyoga": {"name": "Alo Yoga", "domain": "aloyoga.com", "search_url": "https://www.aloyoga.com/search?q={query}"},
    "bandit": {"name": "Bandit Running", "domain": "banditrunning.com", "search_url": "https://banditrunning.com/search?q={query}"},
    "carbon38": {"name": "Carbon38", "domain": "carbon38.com", "search_url": "https://carbon38.com/search?q={query}"},
    "pistola": {"name": "Pistola Denim", "domain": "pistoladenim.com", "search_url": "https://pistoladenim.com/search?q={query}"},
    "frankie": {"name": "The Frankie Shop", "domain": "thefrankieshop.com", "search_url": "https://thefrankieshop.com/search?q={query}"},
    "aritzia": {"name": "Aritzia", "domain": "aritzia.com", "search_url": "https://www.aritzia.com/us/en/search?q={query}"},
    "shopbop": {"name": "Shopbop", "domain": "shopbop.com", "search_url": "https://www.shopbop.com/s?keywords={query}"},
    "wolf_badger": {"name": "Wolf & Badger", "domain": "wolfandbadger.com", "search_url": "https://www.wolfandbadger.com/us/search/?q={query}"},
    "revolve": {"name": "Revolve", "domain": "revolve.com", "search_url": "https://www.revolve.com/r/search?q={query}"},
    "farfetch": {"name": "Farfetch", "domain": "farfetch.com", "search_url": "https://www.farfetch.com/shopping/women/search/items.aspx?q={query}"},
    "zara": {"name": "Zara", "domain": "zara.com", "search_url": "https://www.zara.com/us/en/search?searchTerm={query}"},
    "gap": {"name": "Gap", "domain": "gap.com", "search_url": "https://www.gap.com/browse/search.do?searchText={query}"},
}



class ScrapingService:
    """
    Parallel Multi-Level Scraping Service.
    
    All levels run SIMULTANEOUSLY:
    - Level 1: Jina Reader API (r.jina.ai) + regex parsing
    - Level 2: Raw HTML with curl_cffi + BeautifulSoup
    - Level 3: SerpAPI + Web Crawler
    
    NO Gemini calls here - keeps LLM usage minimal.
    """
    
    JINA_READER_URL = "https://r.jina.ai"
    
    def __init__(self):
        self.serpapi_key = getattr(settings, 'serpapi_key', None)
        self.jina_api_key = getattr(settings, 'jina_api_key', None)

    def _get_headers(self) -> Dict[str, str]:
        return {"User-Agent": random.choice(USER_AGENTS)}
    
    def _get_jina_headers(self) -> Dict[str, str]:
        headers = {"Accept": "text/plain", "X-Return-Format": "markdown"}
        if self.jina_api_key:
            headers["Authorization"] = f"Bearer {self.jina_api_key}"
        return headers

    async def search_and_scrape(self, query: str, limit: int = 10) -> Dict[str, Any]:
        """
        Scraping pipeline using 35+ fashion retailers:
        1. Run Jina Reader (for product data) + HTML scraping (for images) CONCURRENTLY
        2. Merge products, prioritize products with images
        
        NO Amazon, NO SerpAPI - only fashion-specific retailers.
        """
        logger.info(f"🚀 SCRAPE: '{query}'")
        
        all_products = []
        sources = []
        
        # Run BOTH Jina and HTML scraping concurrently for best coverage
        logger.info("📖 Running Jina + HTML scraping in parallel...")
        
        tasks = [
            self._level1_jina_scrape(query),
            self._level2_html_scrape(query),
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process Jina results
        if isinstance(results[0], tuple):
            jina_products, jina_sources = results[0]
            if jina_products:
                all_products.extend(jina_products)
                sources.extend(jina_sources)
                logger.info(f"   ✅ Jina: {len(jina_products)} products")
        elif isinstance(results[0], Exception):
            logger.debug(f"   Jina error: {results[0]}")
        
        # Process HTML results (these have real images!)
        if isinstance(results[1], tuple):
            html_products, html_sources = results[1]
            if html_products:
                all_products.extend(html_products)
                sources.extend(html_sources)
                logger.info(f"   ✅ HTML: {len(html_products)} products")
        elif isinstance(results[1], Exception):
            logger.debug(f"   HTML error: {results[1]}")
        
        # Deduplicate by title
        unique_products = self._deduplicate(all_products)
        
        # Sort to prioritize products with real images and ratings
        unique_products = self._sort_products(unique_products)
        
        logger.info(f"📊 Total: {len(unique_products)} unique products from {len(set(sources))} sources")
        
        return {
            "products": unique_products,
            "total_found": len(unique_products),
            "source": ", ".join(set(sources)) if sources else "scraped"
        }

    # =========================================================================
    # LEVEL 1: Jina Reader API + Regex Parsing (NO Gemini)
    # =========================================================================
    
    async def _level1_jina_scrape(self, query: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """Level 1: Jina Reader API with regex-based product extraction."""
        products = []
        sources = []
        
        # Scrape subset of retailers for speed (10 retailers)
        retailer_keys = list(FASHION_RETAILERS.keys())[:10]
        
        tasks = [
            self._jina_scrape_retailer(key, query)
            for key in retailer_keys
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for idx, result in enumerate(results):
            if isinstance(result, list) and result:
                products.extend(result)
                sources.append(f"jina_{retailer_keys[idx]}")
        
        return products, sources
    
    async def _jina_scrape_retailer(self, key: str, query: str) -> List[Dict[str, Any]]:
        """Scrape a single retailer using Jina Reader + regex parsing."""
        config = FASHION_RETAILERS.get(key)
        if not config:
            return []
        
        search_url = config["search_url"].format(query=quote_plus(query))
        jina_url = f"{self.JINA_READER_URL}/{search_url}"
        
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(jina_url, headers=self._get_jina_headers())
                
                if response.status_code != 200:
                    return []
                
                content = response.text
                
                # Extract products using regex patterns (NO Gemini/LLM)
                return self._extract_products_regex(
                    content=content,
                    retailer_name=config["name"],
                    domain=config["domain"],
                )
        except Exception as e:
            logger.debug(f"Jina error for {key}: {e}")
            return []
    
    async def _fetch_amazon_images(self, products: List[Dict[str, Any]], query: str) -> None:
        """Fetch Amazon product images via HTML scraping and merge with products."""
        try:
            url = f"https://www.amazon.com/s?k={quote_plus(query)}"
            async with AsyncSession(impersonate="chrome124", headers=self._get_headers()) as client:
                resp = await client.get(url, timeout=15)
                soup = BeautifulSoup(resp.text, 'lxml')
                
                # Get product images
                images = []
                for img in soup.select('img.s-image'):
                    src = img.get('src', '')
                    if src and 'AC_UL' in src:  # Product images
                        images.append(src)
                
                # Match images to products by index (approximate)
                for i, product in enumerate(products):
                    if i < len(images):
                        product['image_url'] = images[i]
                
                logger.debug(f"Fetched {len(images)} Amazon images")
        except Exception as e:
            logger.debug(f"Amazon image fetch failed: {e}")
    
    def _extract_amazon_products(self, content: str, search_query: str = "") -> List[Dict[str, Any]]:
        """
        Extract products from Amazon's Jina markdown format.
        
        Amazon format from Jina looks like:
        ```
        Rustler
        Men's Classic Relaxed Fit
        4.5
        4.5 out of 5 stars
         (36.4K)
        800+ bought in past month
        Price, product page
        $14.98
        $14
        .
        98
        ```
        """
        if not content:
            return []
        
        products = []
        seen_titles = set()
        
        # Split content into lines for easier parsing
        lines = content.split('\n')
        
        i = 0
        while i < len(lines) - 5:
            line = lines[i].strip()
            
            # Look for rating pattern: "4.5" followed by "4.5 out of 5 stars"
            if re.match(r'^\d\.\d$', line) and i + 1 < len(lines) and 'out of 5 stars' in lines[i + 1]:
                # Found a product block! Go backward to find brand and title
                rating = float(line)
                
                # Brand is typically 2-3 lines before rating
                brand = ""
                title = ""
                
                # Look backwards for brand and title
                for j in range(i - 1, max(0, i - 5), -1):
                    prev_line = lines[j].strip()
                    if not prev_line or prev_line.startswith('+') or prev_line in ['Add to cart', 'See options']:
                        continue
                    if len(prev_line) > 10 and not title:
                        title = prev_line
                    elif len(prev_line) > 2 and prev_line[0].isupper() and not brand:
                        brand = prev_line
                        break
                
                if not title:
                    i += 1
                    continue
                
                # Look forward for review count and price
                reviews_str = ""
                price = 0.0
                
                for j in range(i + 1, min(len(lines), i + 10)):
                    next_line = lines[j].strip()
                    
                    # Review count pattern: "(36.4K)" or "(1,234)"
                    if next_line.startswith('(') and next_line.endswith(')'):
                        reviews_str = next_line[1:-1]
                    
                    # Price pattern: "$14.98" or "$59.99"
                    price_match = re.match(r'^\$(\d+(?:\.\d{2})?)$', next_line)
                    if price_match:
                        price = float(price_match.group(1))
                        break
                
                # Parse review count
                review_count = 0
                if reviews_str:
                    if 'K' in reviews_str.upper():
                        try:
                            review_count = int(float(reviews_str.upper().replace('K', '').replace(',', '')) * 1000)
                        except:
                            pass
                    else:
                        try:
                            review_count = int(re.sub(r'[^\d]', '', reviews_str))
                        except:
                            pass
                
                # Only add if we have valid price
                if price >= 10 and price <= 1000:
                    full_title = f"{brand} {title}".strip() if brand else title
                    title_key = re.sub(r'[^\w]', '', full_title.lower())
                    
                    if title_key not in seen_titles and len(title_key) >= 10:
                        seen_titles.add(title_key)
                        
                        # Create Amazon search URL with the product title for redirect
                        # This is the best we can do without ASIN
                        search_term = quote_plus(full_title[:80])
                        amazon_url = f"https://www.amazon.com/s?k={search_term}"
                        
                        # Use a placeholder image URL (Amazon product images require ASIN)
                        # Use a reliable placeholder image with Amazon branding
                        image_url = "https://placehold.co/300x300/232F3E/FF9900?text=Amazon"
                        
                        products.append({
                            "id": f"amazon-{title_key[:30]}",
                            "title": full_title,
                            "description": f"{full_title} - {review_count:,} reviews, {rating}★ rating" if review_count else full_title,
                            "price": price,
                            "rating": rating,
                            "review_count": review_count,
                            "image_url": image_url,
                            "affiliate_url": amazon_url,
                            "source": "Amazon",
                            "last_updated": datetime.utcnow().isoformat(),
                        })
                        
                        if len(products) >= 15:
                            break
            
            i += 1
        
        logger.debug(f"Amazon extraction: found {len(products)} products")
        return products
    
    def _extract_products_regex(
        self,
        content: str,
        retailer_name: str,
        domain: str,
    ) -> List[Dict[str, Any]]:
        """
        Extract products from Jina markdown content using regex patterns.
        NO Gemini/LLM calls - pure pattern matching.
        """
        if not content:
            return []
        
        products = []
        seen_titles = set()
        
        # Skip patterns - things that are NOT products
        skip_patterns = [
            'sign in', 'cart', 'menu', 'home', 'account', 'search', 'filter',
            'login', 'register', 'wishlist', 'help', 'contact', 'about',
            'shipping', 'returns', 'privacy', 'terms', 'newsletter', 'subscribe',
            'shop all', 'view all', 'see more', 'load more', 'next', 'previous',
            'image', 'logo', 'icon', 'banner', 'header', 'footer', 'nav',
            'nlid=', 'details', 'disclaimer', 'modal', 'popup', "women's",
            'buy more', 'save more', 'collection', 'new arrivals', "what's hot",
            'wedding shop', 'body contour', 'editor collection', 'everyday performance',
            'shop by', 'best sellers', 'trending', 'sale shop',
            # New filters for generic titles
            'you searched for', 'search results', 'no results', 'top rated',
            'best seller', 'most popular', 'recently viewed', 'recommended',
            'quick view', 'add to cart', 'add to bag', 'size guide',
            'free shipping', 'free returns', 'customer reviews',
        ]
        
        # Category patterns that indicate a page, not a product
        category_patterns = [
            r'^(men|women|kids|sale|new|clearance|featured|shop)$',
            r'^\w+\s+(clothing|shoes|accessories|collection)$',
            r'^(all|view all|see all|shop now|browse)',
        ]
        
        # Pattern: Look for markdown links followed by prices
        link_pattern = r'\[([^\]]{15,100})\]\((https?://[^\s\)]+)\)'
        price_pattern = r'\$(\d{2,4}(?:\.\d{2})?)'  # Min $10, max $9999
        
        # Find all links
        for match in re.finditer(link_pattern, content):
            title = match.group(1).strip()
            url = match.group(2)
            
            title_lower = title.lower()
            
            # Skip navigation/non-product links
            if any(skip in title_lower for skip in skip_patterns):
                continue
            
            # Skip category-like titles
            is_category = False
            for cat_pattern in category_patterns:
                if re.match(cat_pattern, title_lower, re.IGNORECASE):
                    is_category = True
                    break
            if is_category:
                continue
            
            # Skip if title looks like a URL or code
            if 'http' in title_lower or '%' in title or '=' in title or 'nlid' in title_lower:
                continue
            
            # Skip if title is too generic or too short
            word_count = len(title.split())
            if word_count < 2 or word_count > 15:
                continue
            
            # Normalize title for dedup
            title_key = re.sub(r'[^\w]', '', title_lower)
            if title_key in seen_titles or len(title_key) < 10:
                continue
            
            # Look for price after this link (within 300 chars)
            start_pos = match.end()
            nearby_text = content[start_pos:start_pos+300]
            price_match = re.search(price_pattern, nearby_text)
            
            # Also check before the link
            if not price_match:
                before_text = content[max(0, match.start()-100):match.start()]
                price_match = re.search(price_pattern, before_text)
            
            if price_match:
                try:
                    price = float(price_match.group(1))
                    
                    # Skip unrealistic prices (shipping costs, etc)
                    if price < 10 or price > 3000:
                        continue
                    
                    # Ensure URL is absolute and valid
                    if not url.startswith('http'):
                        url = f"https://{domain}{url}"
                    
                    # Skip if URL doesn't contain product indicators
                    url_lower = url.lower()
                    if domain not in url_lower:
                        url = f"https://{domain}"
                    
                    seen_titles.add(title_key)
                    
                    # Generate a placeholder image with retailer initial
                    initial = retailer_name[0].upper() if retailer_name else "S"
                    placeholder_image = f"https://placehold.co/300x300/1a1a2e/eaeaea?text={initial}"
                    
                    products.append({
                        "id": url,
                        "title": title,
                        "description": f"{title} from {retailer_name}",
                        "price": price,
                        "image_url": placeholder_image,
                        "affiliate_url": url,
                        "source": retailer_name,
                        "last_updated": datetime.utcnow().isoformat(),
                    })
                    
                    if len(products) >= 12:
                        break
                except:
                    continue
        
        return products

    # =========================================================================
    # LEVEL 2: Raw HTML Scraping with curl_cffi
    # =========================================================================
    
    async def _level2_html_scrape(self, query: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """Level 2: Raw HTML scraping with curl_cffi + BeautifulSoup."""
        products = []
        sources = []
        
        # Scrape next set of retailers (different from Jina set)
        retailer_keys = list(FASHION_RETAILERS.keys())[10:25]
        
        tasks = [self._scrape_single_store(k, query) for k in retailer_keys]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for idx, res in enumerate(results):
            if isinstance(res, list) and res:
                products.extend(res)
                sources.append(retailer_keys[idx])
        
        return products, sources

    async def _scrape_single_store(self, key: str, query: str) -> List[Dict[str, Any]]:
        """Scrapes a single fashion store using generic e-commerce patterns."""
        config = FASHION_RETAILERS[key]
        url = config["search_url"].format(query=quote_plus(query))
        
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
                
                for item in items[:15]:  # 15 per retailer
                    try:
                        title_el = item.select_one('h2, h3, h4, [class*="title"], [class*="name"], .pdp-link, a[class*="link"]')
                        if not title_el: continue
                        title = title_el.get_text(strip=True)
                        
                        # Skip invalid/generic titles
                        if len(title) < 8: continue
                        title_lower = title.lower()
                        skip_words = [
                            'you searched', 'search results', 'no results', 
                            'top rated', 'best seller', 'most popular',
                            'quick view', 'add to cart', 'add to bag',
                            'shop now', 'view all', 'see more', 'load more',
                            'sign in', 'login', 'account', 'wishlist',
                        ]
                        if any(skip in title_lower for skip in skip_words):
                            continue
                        
                        # Skip if title is just the category name (e.g., "Mens Jeans")
                        if len(title.split()) < 3:
                            continue
                        
                        # Extract description
                        description = ""
                        desc_selectors = [
                            '[class*="description"]', '[class*="desc"]', '[class*="subtitle"]',
                            '[class*="detail"]', '[class*="info"]', 'p', '.product-description',
                        ]
                        for desc_sel in desc_selectors:
                            desc_el = item.select_one(desc_sel)
                            if desc_el:
                                desc_text = desc_el.get_text(strip=True)
                                if desc_text and len(desc_text) > 10 and desc_text.lower() != title.lower():
                                    description = desc_text[:200]
                                    break
                        
                        if not description:
                            description = f"{title} from {config['name']}"
                        
                        # Enhanced price extraction
                        price_selectors = [
                            '[class*="price"]', '.price', '.product-price', '[data-price]',
                            'span[class*="amount"]', '.sale-price', '.current-price', '.money',
                        ]
                        price = 0.0
                        for selector in price_selectors:
                            price_el = item.select_one(selector)
                            if price_el:
                                price_text = (
                                    price_el.get('data-price') or 
                                    price_el.get('content') or 
                                    price_el.get_text()
                                )
                                price = self._parse_price(price_text)
                                if price > 0:
                                    break
                        
                        # Skip products without valid price
                        if price <= 0:
                            continue
                        
                        # Link extraction
                        link_el = item.select_one('a[href]')
                        if not link_el or (link_el['href'].startswith('#') or 'javascript' in link_el['href']):
                             link_el = item.find('a', href=re.compile(r'/'))
                        
                        if not link_el: continue
                        
                        raw_link = link_el['href']
                        link = urljoin(f"https://{config['domain']}", raw_link)
                        
                        if not link or not link.startswith('http'):
                            continue
                        
                        img_el = item.select_one('img')
                        img = ""
                        if img_el:
                            img = img_el.get('src') or img_el.get('data-src') or img_el.get('data-lazy-src') or ""
                            if img and not img.startswith('http'):
                                img = urljoin(f"https://{config['domain']}", img)
                        
                        # Fallback to placeholder if no image found
                        if not img:
                            initial = config["name"][0].upper()
                            img = f"https://placehold.co/300x300/1a1a2e/eaeaea?text={initial}"
                        
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

    # =========================================================================
    # LEVEL 3: SerpAPI + Web Crawler
    # =========================================================================
    
    async def _level3_serpapi_crawl(self, query: str, limit: int) -> Tuple[List[Dict[str, Any]], List[str]]:
        """Level 3: SerpAPI Google Shopping + DuckDuckGo web crawler."""
        products = []
        sources = []
        
        # Run SerpAPI and web crawler in parallel
        tasks = [
            self._search_serpapi(query, limit),
            self._crawl_web(query, limit=5)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in results:
            if isinstance(result, tuple) and len(result) == 2:
                prods, srcs = result
                products.extend(prods)
                sources.extend(srcs)
            elif isinstance(result, list):
                products.extend(result)
                sources.append("web_crawler")
        
        return products, sources

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
                
                if price <= 0 or not link or not link.startswith("http"):
                    continue
                
                title = item.get("title", "")
                source = item.get("source", "Google Shopping")
                description = item.get("snippet") or item.get("description") or f"{title} from {source}"
                
                # Get thumbnail or use placeholder
                thumbnail = item.get("thumbnail")
                if not thumbnail:
                    initial = source[0].upper() if source else "S"
                    thumbnail = f"https://placehold.co/300x300/4285F4/ffffff?text={initial}"
                
                prods.append({
                    "id": item.get("product_id", link),
                    "title": title,
                    "description": description[:200],
                    "price": price,
                    "rating": item.get("rating"),
                    "review_count": item.get("reviews"),
                    "image_url": thumbnail,
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
                        domain = urlparse(link).netloc
                        initial = domain[0].upper() if domain else "W"
                        results.append({
                            "id": link, 
                            "title": title, 
                            "price": 0, 
                            "source": domain,
                            "image_url": f"https://placehold.co/300x300/1a1a2e/eaeaea?text={initial}",
                            "affiliate_url": link, 
                            "last_updated": datetime.utcnow().isoformat()
                        })
                return results
        except: return []

    # =========================================================================
    # Utility Methods
    # =========================================================================
    
    def _deduplicate(self, products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        seen = set()
        unique = []
        for p in products:
            clean = re.sub(r'[^\w]', '', p.get('title', '').lower())
            if clean and clean not in seen:
                seen.add(clean)
                unique.append(p)
        return unique
    
    def _sort_products(self, products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Sort products to prioritize:
        1. Products with REAL images (not placeholders)
        2. Reasonable prices ($10-$500)
        3. Products with ratings
        4. Premium fashion retailers
        """
        # Premium retailer bonus
        PREMIUM_RETAILERS = [
            'nordstrom', 'saks', 'farfetch', 'revolve', 'reformation',
            'madewell', 'anthropologie', 'aritzia', 'shopbop', 'lululemon'
        ]
        
        # First, filter out products with unrealistic prices
        valid_products = []
        for p in products:
            price = p.get('price', 0)
            title = p.get('title', '').lower()
            
            # Skip products with unrealistic prices (likely parsing errors)
            if price > 1000 or price < 5:
                continue
            
            # Skip products with garbage titles
            if 'activating this element' in title or 'javascript' in title:
                continue
                
            valid_products.append(p)
        
        def sort_key(p):
            score = 0
            source = p.get('source', '').lower()
            image_url = p.get('image_url', '')
            price = p.get('price', 0)
            
            # Real images get highest priority (not placeholders)
            if image_url and 'placehold' not in image_url:
                score += 500
            
            # Reasonable price range bonus
            if 15 <= price <= 300:
                score += 100
            elif 10 <= price <= 500:
                score += 50
            
            # Products with ratings get bonus
            if p.get('rating'):
                score += 80 + (float(p.get('rating', 0)) * 15)
            
            # Products with review counts get bonus
            if p.get('review_count'):
                score += min(40, p.get('review_count', 0) / 100)
            
            # Premium retailers get bonus
            for premium in PREMIUM_RETAILERS:
                if premium in source:
                    score += 150
                    break
            
            return -score  # Negative for descending order
        
        return sorted(valid_products, key=sort_key)

    def _parse_price(self, p: Any) -> float:
        """Parse price from various formats, handling common e-commerce patterns."""
        try:
            s = str(p).replace('$', '').replace(',', '').strip()
            
            # Try to find a proper decimal price first (e.g., "64.91")
            decimal_match = re.search(r"(\d+\.\d{2})", s)
            if decimal_match:
                return float(decimal_match.group(1))
            
            # If we have a 4+ digit number without decimal, it might be cents
            just_digits = re.search(r"(\d+)", s)
            if just_digits:
                num = int(just_digits.group(1))
                # If number has 4+ digits and last 2 could be cents
                if num >= 1000 and num < 100000:
                    return num / 100.0  # e.g., 6491 -> 64.91
                return float(num)
            
            return 0.0
        except:
            return 0.0
