"""
Product Enrichment Service.

Crawls individual product pages to get high-quality images and detailed descriptions.
This is called asynchronously after initial search results are displayed.
"""

import asyncio
import re
import logging
from typing import Dict, Any, Optional, List
from urllib.parse import urljoin, urlparse
from datetime import datetime

import httpx
from curl_cffi.requests import AsyncSession
from bs4 import BeautifulSoup

from app.config import get_settings

settings = get_settings()

# Configure logger
logger = logging.getLogger("enrichment")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        "%(asctime)s | %(levelname)-8s | ENRICH | %(message)s",
        datefmt="%H:%M:%S"
    ))
    logger.addHandler(handler)


USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
]


class ProductEnrichmentService:
    """
    Service to enrich product data by crawling individual product pages.
    
    This extracts:
    - High-quality product images
    - Detailed descriptions
    - Price confirmation
    - Additional metadata (brand, color, material, etc.)
    """
    
    JINA_READER_URL = "https://r.jina.ai"
    
    def __init__(self):
        self.jina_api_key = getattr(settings, 'jina_api_key', None)
        # Cache to avoid re-fetching same URLs
        self._cache: Dict[str, Dict[str, Any]] = {}
    
    def _get_headers(self) -> Dict[str, str]:
        import random
        return {"User-Agent": random.choice(USER_AGENTS)}
    
    def _get_jina_headers(self) -> Dict[str, str]:
        headers = {"Accept": "text/plain", "X-Return-Format": "markdown"}
        if self.jina_api_key:
            headers["Authorization"] = f"Bearer {self.jina_api_key}"
        return headers
    
    def _is_valid_image_url(self, url: str) -> bool:
        """Check if image URL is a valid product image."""
        if not url:
            return False
        
        url_lower = url.lower()
        
        # Skip placeholder images
        if 'placehold' in url_lower or 'placeholder' in url_lower:
            return False
        
        # Skip icons, logos, and tiny images
        invalid_patterns = [
            'icon', 'logo', 'sprite', 'pixel', 'spacer', 'blank',
            'loader', 'loading', 'spinner', 'clear.gif', '1x1',
            'svg+xml', 'data:image', 'base64', 'payment', 'card',
            'badge', 'flag', 'star', 'rating', 'check', 'arrow',
        ]
        if any(pattern in url_lower for pattern in invalid_patterns):
            return False
        
        # Should have image extension or be from CDN
        valid_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif']
        has_valid_ext = any(ext in url_lower for ext in valid_extensions)
        
        # Or should be from known image CDNs
        cdn_patterns = [
            'cloudinary', 'imgix', 'shopify', 'squarespace', 'akamai',
            'cloudfront', 'fastly', 'cdn', 'images', 'img', 'media',
            'assets', 'static', 'content'
        ]
        is_cdn = any(cdn in url_lower for cdn in cdn_patterns)
        
        return has_valid_ext or is_cdn
    
    def _extract_images_from_html(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """Extract all valid product images from the page."""
        images = []
        domain = urlparse(base_url).netloc
        
        # Priority selectors for product images
        image_selectors = [
            # Product-specific selectors
            'img[class*="product"]',
            'img[class*="main"]',
            'img[class*="primary"]',
            'img[class*="hero"]',
            'img[class*="gallery"]',
            'img[class*="zoom"]',
            '[class*="product-image"] img',
            '[class*="product-gallery"] img',
            '[class*="main-image"] img',
            '[class*="pdp"] img',
            'picture source',
            'picture img',
            # Open Graph / Meta images (often high quality)
            'meta[property="og:image"]',
            'meta[name="twitter:image"]',
        ]
        
        # First try specific selectors
        for selector in image_selectors:
            elements = soup.select(selector)
            for el in elements:
                # Handle different element types
                if el.name == 'meta':
                    img_url = el.get('content', '')
                elif el.name == 'source':
                    img_url = el.get('srcset', '').split(',')[0].split()[0] if el.get('srcset') else ''
                else:
                    # Try various image attributes
                    img_url = (
                        el.get('src') or
                        el.get('data-src') or
                        el.get('data-lazy-src') or
                        el.get('data-original') or
                        el.get('data-zoom-image') or
                        el.get('data-large') or
                        el.get('data-full') or
                        ''
                    )
                
                if img_url:
                    # Make absolute URL
                    if not img_url.startswith('http'):
                        img_url = urljoin(base_url, img_url)
                    
                    # Validate and add
                    if self._is_valid_image_url(img_url) and img_url not in images:
                        images.append(img_url)
                        if len(images) >= 5:  # Max 5 images
                            return images
        
        # Fallback: Look for any large images
        if not images:
            for img in soup.find_all('img'):
                # Check if it might be a product image based on attributes
                classes = ' '.join(img.get('class', []))
                if any(skip in classes.lower() for skip in ['thumb', 'icon', 'logo', 'badge']):
                    continue
                
                img_url = (
                    img.get('src') or
                    img.get('data-src') or
                    ''
                )
                
                if img_url and not img_url.startswith('http'):
                    img_url = urljoin(base_url, img_url)
                
                if self._is_valid_image_url(img_url) and img_url not in images:
                    images.append(img_url)
                    if len(images) >= 3:
                        break
        
        return images
    
    def _extract_description_from_html(self, soup: BeautifulSoup) -> str:
        """Extract product description from HTML."""
        description = ""
        
        # Priority selectors for product description
        desc_selectors = [
            '[class*="product-description"]',
            '[class*="product-detail"]',
            '[class*="pdp-description"]',
            '[id*="description"]',
            '[class*="description"]',
            '[class*="details"]',
            '[itemprop="description"]',
            '.product-info p',
            '.product-details p',
            '[class*="overview"]',
        ]
        
        for selector in desc_selectors:
            el = soup.select_one(selector)
            if el:
                text = el.get_text(strip=True)
                # Clean up and validate
                if text and len(text) > 20:
                    # Remove size patterns
                    text = re.sub(r'\b[XSML0-9]{6,}\b', '', text, flags=re.IGNORECASE)
                    text = re.sub(r'\s+', ' ', text).strip()
                    if len(text) > 20:
                        description = text[:500]  # Limit length
                        break
        
        # Fallback to meta description
        if not description:
            meta = soup.select_one('meta[name="description"]')
            if meta:
                description = meta.get('content', '')[:500]
        
        return description
    
    def _extract_price_from_html(self, soup: BeautifulSoup) -> Optional[float]:
        """Extract price from HTML."""
        price_selectors = [
            '[class*="product-price"]',
            '[class*="current-price"]',
            '[class*="sale-price"]',
            '[itemprop="price"]',
            '[data-price]',
            '[class*="price"]',
            '.price',
        ]
        
        for selector in price_selectors:
            el = soup.select_one(selector)
            if el:
                # Try data attributes first
                price_val = el.get('content') or el.get('data-price')
                if price_val:
                    try:
                        return float(price_val)
                    except:
                        pass
                
                # Try text content
                text = el.get_text(strip=True)
                match = re.search(r'\$?([\d,]+\.?\d*)', text)
                if match:
                    try:
                        price = float(match.group(1).replace(',', ''))
                        if 5 <= price <= 10000:  # Reasonable range
                            return price
                    except:
                        pass
        
        return None
    
    async def enrich_product(self, product_url: str) -> Dict[str, Any]:
        """
        Enrich a single product by crawling its product page.
        
        Returns a dict with:
        - images: List of image URLs (first is primary)
        - description: Extracted description
        - price: Confirmed price (if found)
        - enriched: True if successfully enriched
        """
        # Check cache
        if product_url in self._cache:
            logger.debug(f"Cache hit for {product_url[:50]}...")
            return self._cache[product_url]
        
        result = {
            "images": [],
            "description": "",
            "price": None,
            "enriched": False,
            "error": None,
        }
        
        logger.info(f"🔍 Enriching: {product_url[:60]}...")
        
        try:
            # Try with curl_cffi first (better anti-bot bypass)
            html_content = None
            
            try:
                async with AsyncSession(impersonate="chrome124", timeout=15) as client:
                    resp = await client.get(product_url, headers=self._get_headers())
                    if resp.status_code == 200:
                        html_content = resp.text
            except Exception as e:
                logger.debug(f"curl_cffi failed: {e}")
            
            # Fallback to httpx
            if not html_content:
                try:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        resp = await client.get(product_url, headers=self._get_headers(), follow_redirects=True)
                        if resp.status_code == 200:
                            html_content = resp.text
                except Exception as e:
                    logger.debug(f"httpx failed: {e}")
            
            # Fallback to Jina Reader
            if not html_content:
                try:
                    jina_url = f"{self.JINA_READER_URL}/{product_url}"
                    async with httpx.AsyncClient(timeout=20.0) as client:
                        resp = await client.get(jina_url, headers=self._get_jina_headers())
                        if resp.status_code == 200:
                            # Jina returns markdown, but we need to extract image URLs
                            markdown = resp.text
                            # Extract image URLs from markdown: ![alt](url)
                            img_matches = re.findall(r'!\[[^\]]*\]\((https?://[^\s\)]+)\)', markdown)
                            result["images"] = [
                                url for url in img_matches[:5]
                                if self._is_valid_image_url(url)
                            ]
                            result["enriched"] = len(result["images"]) > 0
                            self._cache[product_url] = result
                            return result
                except Exception as e:
                    logger.debug(f"Jina failed: {e}")
            
            if not html_content:
                result["error"] = "Could not fetch page"
                return result
            
            # Parse HTML
            soup = BeautifulSoup(html_content, 'lxml')
            
            # Extract data
            result["images"] = self._extract_images_from_html(soup, product_url)
            result["description"] = self._extract_description_from_html(soup)
            result["price"] = self._extract_price_from_html(soup)
            result["enriched"] = len(result["images"]) > 0 or bool(result["description"])
            
            if result["enriched"]:
                logger.info(f"   ✅ Found {len(result['images'])} images")
            else:
                logger.info(f"   ⚠️ No enrichment data found")
            
            # Cache result
            self._cache[product_url] = result
            
        except Exception as e:
            logger.error(f"   ❌ Enrichment error: {e}")
            result["error"] = str(e)
        
        return result
    
    async def enrich_products_batch(
        self, 
        products: List[Dict[str, Any]], 
        max_concurrent: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Enrich multiple products concurrently.
        
        Returns enriched product list with updated images/descriptions.
        """
        if not products:
            return products
        
        logger.info(f"🚀 Batch enriching {len(products)} products...")
        
        # Create semaphore to limit concurrency
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def enrich_with_limit(product: Dict[str, Any]) -> Dict[str, Any]:
            async with semaphore:
                url = product.get('affiliate_url') or product.get('link') or product.get('url')
                if not url or not url.startswith('http'):
                    return product
                
                enrichment = await self.enrich_product(url)
                
                # Update product with enriched data
                if enrichment["enriched"]:
                    if enrichment["images"]:
                        product["image_url"] = enrichment["images"][0]
                        product["images"] = enrichment["images"]
                    if enrichment["description"] and len(enrichment["description"]) > len(product.get("description", "")):
                        product["description"] = enrichment["description"]
                    if enrichment["price"] and not product.get("price"):
                        product["price"] = enrichment["price"]
                    product["enriched"] = True
                
                return product
        
        # Run enrichment tasks
        tasks = [enrich_with_limit(p) for p in products]
        enriched_products = await asyncio.gather(*tasks)
        
        enriched_count = sum(1 for p in enriched_products if p.get("enriched"))
        logger.info(f"✅ Enriched {enriched_count}/{len(products)} products")
        
        return list(enriched_products)


# Singleton instance
_enrichment_service: Optional[ProductEnrichmentService] = None


def get_enrichment_service() -> ProductEnrichmentService:
    """Get or create the enrichment service singleton."""
    global _enrichment_service
    if _enrichment_service is None:
        _enrichment_service = ProductEnrichmentService()
    return _enrichment_service
