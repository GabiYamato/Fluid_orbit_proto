import asyncio
import httpx
from bs4 import BeautifulSoup
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import quote_plus, urljoin
from datetime import datetime

class ScrapingService:
    """
    Service to scrape product information directly from Amazon and eBay.
    Inspired by independent scraper implementation.
    """
    
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }

    async def search_and_scrape(self, query: str, limit: int = 10) -> Dict[str, Any]:
        """
        Search for a product query on Amazon and scrape results.
        """
        print(f"🕵️‍♂️ Scraping Amazon for: {query}")
        
        products, total_found = await self.scrape_amazon(query, limit)
        
        print(f"✅ Scraped {len(products)} products (Total: {total_found})")
        return {"products": products[:limit], "total_found": total_found}

    async def scrape_amazon(self, query: str, limit: int = 10) -> Tuple[List[Dict[str, Any]], int]:
        url = f"https://www.amazon.com/s?k={quote_plus(query)}"
        products = []
        total_found = 0
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=self.headers) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    print(f"Amazon error: {resp.status_code}")
                    return [], 0
                
                soup = BeautifulSoup(resp.text, 'lxml')
                items = soup.select('[data-component-type="s-search-result"]')
                total_found = len(items)
                print(f"📦 Amazon found {len(items)} items")
                
                for item in items:
                    if len(products) >= limit: break
                    
                    try:
                        title_el = item.select_one("h2 a span")
                        if not title_el: continue
                        title = title_el.text.strip()
                        
                        price_whole = item.select_one(".a-price-whole")
                        price_frac = item.select_one(".a-price-fraction")
                        
                        if not price_whole: continue
                        
                        price_str = f"{price_whole.text.strip()}.{price_frac.text.strip() if price_frac else '00'}"
                        price = self._parse_price(price_str)
                        
                        img_el = item.select_one("img.s-image")
                        image_url = img_el['src'] if img_el else ""
                        
                        link_el = item.select_one("h2 a")
                        link = urljoin("https://www.amazon.com", link_el['href']) if link_el else ""
                        
                        rating_el = item.select_one(".a-icon-star-small .a-icon-alt")
                        rating = float(rating_el.text.split(' ')[0]) if rating_el else 0.0
                        
                        review_count_el = item.select_one('[aria-label*="stars"]') # Parent of review count usually
                        # Alternative selector for reviews
                        if not review_count_el:
                             # Try finding the span next to stars
                             pass
                        review_count = 0 # Simplified
                        
                        products.append({
                            "id": link,
                            "title": title,
                            "description": title, # Amazon search doesn't show desc
                            "price": price,
                            "rating": rating,
                            "review_count": review_count,
                            "image_url": image_url,
                            "affiliate_url": link,
                            "source": "amazon",
                            "last_updated": datetime.utcnow().isoformat()
                        })
                    except Exception as e:
                        # print(f"Amazon item parse error: {e}")
                        continue
                        
        except Exception as e:
            print(f"Amazon scrape error: {repr(e)}")
            
        return products, total_found

    async def scrape_ebay(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        url = f"https://www.ebay.com/sch/i.html?_nkw={quote_plus(query)}"
        products = []
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=self.headers) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    print(f"eBay error: {resp.status_code}")
                    return []
                
                soup = BeautifulSoup(resp.text, 'lxml')
                items = soup.select('.s-item')
                print(f"📦 eBay found {len(items)} items")
                
                for item in items:
                    if len(products) >= limit: break
                    
                    try:
                        title_el = item.select_one(".s-item__title")
                        if not title_el or "Shop on eBay" in title_el.text: continue
                        title = title_el.text.strip()
                        
                        price_el = item.select_one(".s-item__price")
                        if not price_el: continue
                        price = self._parse_price(price_el.text)
                        
                        img_el = item.select_one(".s-item__image-img")
                        image_url = img_el['src'] if img_el else ""
                        
                        link_el = item.select_one(".s-item__link")
                        link = link_el['href'] if link_el else ""
                        
                        products.append({
                            "id": link,
                            "title": title,
                            "description": title,
                            "price": price,
                            "rating": 0, # eBay listings rarely show rating on search
                            "review_count": 0,
                            "image_url": image_url,
                            "affiliate_url": link,
                            "source": "ebay",
                            "last_updated": datetime.utcnow().isoformat()
                        })
                    except Exception as e:
                        continue
                        
        except Exception as e:
            print(f"eBay scrape error: {repr(e)}")
            
        return products

    def _parse_price(self, price_raw: Any) -> float:
        if not price_raw: return 0.0
        try:
            # Remove currency symbols and handle ranges "20.00 to 30.00" (take lower?)
            s = str(price_raw).replace('$', '').replace(',', '')
            import re
            match = re.search(r"[\d\.]+", s)
            if match:
                return float(match.group(0))
            return 0.0
        except:
            return 0.0
