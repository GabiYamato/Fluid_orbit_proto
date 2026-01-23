
import asyncio
import sys
import os

# Add parent dir to path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.scraping_service import ScrapingService, FASHION_RETAILERS

async def test_all_retailers():
    scraper = ScrapingService()
    print(f"🔍 Testing {len(FASHION_RETAILERS)} Fashion Retailers...")
    print("="*60)
    
    results = []
    
    # Test query that should exist everywhere
    query = "white t-shirt"
    
    for key, config in FASHION_RETAILERS.items():
        print(f"Testing {config['name']}...", end=" ", flush=True)
        try:
            products = await scraper._scrape_single_store(key, query)
            if products:
                print(f"✅ Success! ({len(products)} products)")
                results.append({"name": config['name'], "status": "✅", "count": len(products)})
            else:
                print(f"❌ No products found (or blocked)")
                results.append({"name": config['name'], "status": "❌", "count": 0})
        except Exception as e:
            print(f"⚠️ Error: {e}")
            results.append({"name": config['name'], "status": "⚠️", "count": 0})
            
    print("\n" + "="*60)
    print("SUMMARY REPORT")
    print("="*60)
    for res in results:
        print(f"{res['status']} {res['name']:<25} : {res['count']} products")
        
    success_count = sum(1 for r in results if r['count'] > 0)
    print("="*60)
    print(f"Total Success: {success_count}/{len(FASHION_RETAILERS)}")

if __name__ == "__main__":
    asyncio.run(test_all_retailers())
