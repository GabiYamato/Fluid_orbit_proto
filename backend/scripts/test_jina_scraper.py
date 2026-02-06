#!/usr/bin/env python3
"""
Test script for the parallel multi-level scraping pipeline.

This tests:
1. Level 1: Jina Reader API + regex extraction
2. Level 2: Raw HTML with curl_cffi
3. Level 3: SerpAPI + Web Crawler
All running in PARALLEL.
"""

import sys
import os
import asyncio
import logging
import time

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.scraping_service import ScrapingService
from app.config import get_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_parallel_scraping():
    """Test the parallel multi-level scraping pipeline."""
    settings = get_settings()
    
    print("=" * 60)
    print("🧪 PARALLEL SCRAPING TEST")
    print("=" * 60)
    
    # Check prerequisites
    print("\n📋 Configuration:")
    print(f"   Jina API Key: {'✅ Set' if settings.jina_api_key else '⚠️ Using free tier'}")
    print(f"   SerpAPI Key: {'✅ Set' if settings.serpapi_key else '❌ Not set (Level 3 limited)'}")
    print(f"   Gemini Key: {'✅ Set (for generation only)' if settings.gemini_api_key else '❌ Not set'}")
    
    # Initialize scraper
    scraper = ScrapingService()
    
    # Test query
    test_query = "mens casual jeans"
    print(f"\n🔍 Test Query: '{test_query}'")
    print("-" * 60)
    
    # Time the scrape
    start_time = time.time()
    
    # Run the parallel scrape
    result = await scraper.search_and_scrape(test_query, limit=15)
    
    elapsed = time.time() - start_time
    
    products = result.get("products", [])
    total = result.get("total_found", 0)
    source = result.get("source", "unknown")
    
    print(f"\n⏱️  Time Elapsed: {elapsed:.2f} seconds")
    print(f"\n📊 Results:")
    print(f"   Total Found: {total}")
    print(f"   Products Returned: {len(products)}")
    print(f"   Sources: {source}")
    
    if products:
        # Group by source
        by_source = {}
        for p in products:
            src = p.get('source', 'Unknown')
            if src not in by_source:
                by_source[src] = []
            by_source[src].append(p)
        
        print(f"\n📦 Products by Source:")
        for src, prods in sorted(by_source.items(), key=lambda x: -len(x[1])):
            print(f"   • {src}: {len(prods)} products")
        
        print(f"\n🔝 Top 5 Products:")
        for i, p in enumerate(products[:5]):
            title = p.get('title', 'NO TITLE')[:50]
            price = p.get('price', 0)
            src = p.get('source', 'Unknown')
            url = p.get('affiliate_url', 'NO URL')[:60]
            print(f"\n   {i+1}. {title}...")
            print(f"      💰 ${price:.2f} | 🏪 {src}")
            print(f"      🔗 {url}...")
    else:
        print("\n⚠️ No products found. Check:")
        print("   - Network connectivity")
        print("   - Jina API rate limits (1000/day free)")
        print("   - Retailer websites may be blocking requests")
    
    print("\n" + "=" * 60)
    print("✅ TEST COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    try:
        asyncio.run(test_parallel_scraping())
    except KeyboardInterrupt:
        print("\n❌ Test cancelled by user")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
