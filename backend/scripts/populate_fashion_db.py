#!/usr/bin/env python3
"""
Script to wipe the DB and populate it with high-quality fashion data.
This runs a manual scrape for specific fashion categories and indexes only high-quality results.
"""

import sys
import os
import asyncio
import logging
from datetime import datetime

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.rag_service import RAGService
from scripts.wipe_vector_db import wipe_vector_database

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# List of fashion queries to populate the database
FASHION_QUERIES = [
    "casual mens t-shirts",
    "formal mens jeans",
    "winter jackets for men",
    "summer dresses for women",
    "mens running sneakers",
    "womens leather handbags",
    "mens formal shirts",
    "womens denim jeans",
    "hoodies and sweatshirts",
    "casual sneakers for women"
]

async def populate_db():
    print("=" * 60)
    print("🚀 FASHION DATABASE POPULATION SCRIPT")
    print("=" * 60)
    
    # Step 1: Wipe the database
    print("\n🗑️  Step 1: Wiping existing vector database...")
    if wipe_vector_database(confirm=True):
        print("   ✅ Database wiped successfully.")
    else:
        print("   ❌ Failed to wipe database. Exiting.")
        return

    # Step 2: Initialize RAG Service
    print("\n🛠️  Step 2: Initializing services...")
    try:
        rag_service = RAGService()
        print("   ✅ RAG Service initialized.")
    except Exception as e:
        print(f"   ❌ Failed to initialize RAG Service: {e}")
        return

    # Step 3: Scrape and Index
    print(f"\n🕷️  Step 3: Scraping and Indexing {len(FASHION_QUERIES)} categories...")
    
    total_indexed = 0
    
    for i, query in enumerate(FASHION_QUERIES):
        print(f"\n   [{i+1}/{len(FASHION_QUERIES)}] Processing: '{query}'")
        
        try:
            # Scrape products (limit 50 per query)
            print(f"      → Scraping retailers for '{query}'...")
            scrape_result = await rag_service.scraping_service.search_and_scrape(query, limit=50)
            scraped_products = scrape_result.get("products", [])
            print(f"      → Found {len(scraped_products)} raw products.")
            
            # Strict Filtering
            valid_products = []
            for p in scraped_products:
                # Check 1: Must have a valid price > 0
                try:
                    price = float(p.get("price", 0))
                    if price <= 0: continue
                except: continue
                
                # Check 2: Must have a valid title
                title = p.get("title", "")
                if not title or len(title) < 5: continue
                
                # Check 3: Must have a valid URL
                url = p.get("affiliate_url") or p.get("id")
                if not url or not url.startswith("http"): continue
                
                # Check 4: Must have a description (we can use title as fallback logik in scraper, but ensure it's there)
                desc = p.get("description")
                if not desc: 
                    # create simple description if missing
                    p["description"] = f"{title} - {p.get('source', 'Online Store')}"
                
                # Check 5: Must have an image
                img = p.get("image_url")
                if not img or not img.startswith("http"): continue
                
                valid_products.append(p)
            
            print(f"      → {len(valid_products)} products passed quality checks (Price > 0, Valid URL/Image).")
            
            if valid_products:
                # Index products
                print(f"      → Indexing {len(valid_products)} products into Vector DB...")
                await rag_service._index_products(valid_products)
                total_indexed += len(valid_products)
                print(f"      ✅ Indexed successfully.")
            else:
                print("      ⚠️  No valid products to index for this query.")
                
        except Exception as e:
            print(f"      ❌ Error processing '{query}': {e}")
            import traceback
            traceback.print_exc()
        
        # Small delay between queries to be nice
        await asyncio.sleep(2)

    print("\n" + "=" * 60)
    print(f"🎉 DONE! Successfully populated DB with {total_indexed} high-quality products.")
    print("=" * 60)

if __name__ == "__main__":
    try:
        asyncio.run(populate_db())
    except KeyboardInterrupt:
        print("\n❌ Script aborted by user.")
    except Exception as e:
        print(f"\n❌ Script failed: {e}")
