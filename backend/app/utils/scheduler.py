"""
APScheduler-based Scheduler for periodic tasks.

Runs scraping jobs periodically to keep the product database fresh.
Includes comprehensive logging for monitoring and debugging.
"""

import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.events import (
    EVENT_JOB_EXECUTED,
    EVENT_JOB_ERROR,
    EVENT_JOB_MISSED,
    EVENT_JOB_ADDED,
    EVENT_JOB_REMOVED,
)
from typing import Optional
import asyncio

# Configure scheduler logger
logger = logging.getLogger("scheduler")
logger.setLevel(logging.INFO)

# Create console handler with formatting
if not logger.handlers:
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

# Placeholder for the singleton scheduler instance
_scheduler: Optional[AsyncIOScheduler] = None

# Job execution stats
_job_stats = {
    "total_runs": 0,
    "successful_runs": 0,
    "failed_runs": 0,
    "last_run": None,
    "last_success": None,
    "last_error": None,
    "total_products_indexed": 0,
}


def get_job_stats() -> dict:
    """Get current job statistics."""
    return _job_stats.copy()


def _job_listener(event):
    """Listen to job events for logging."""
    global _job_stats
    
    if event.code == EVENT_JOB_EXECUTED:
        _job_stats["total_runs"] += 1
        _job_stats["successful_runs"] += 1
        _job_stats["last_run"] = datetime.now().isoformat()
        _job_stats["last_success"] = datetime.now().isoformat()
        logger.info(f"✅ Job '{event.job_id}' executed successfully")
        
    elif event.code == EVENT_JOB_ERROR:
        _job_stats["total_runs"] += 1
        _job_stats["failed_runs"] += 1
        _job_stats["last_run"] = datetime.now().isoformat()
        _job_stats["last_error"] = str(event.exception)
        logger.error(f"❌ Job '{event.job_id}' failed: {event.exception}")
        
    elif event.code == EVENT_JOB_MISSED:
        logger.warning(f"⚠️ Job '{event.job_id}' was missed")
        
    elif event.code == EVENT_JOB_ADDED:
        logger.info(f"📝 Job '{event.job_id}' added to scheduler")
        
    elif event.code == EVENT_JOB_REMOVED:
        logger.info(f"🗑️ Job '{event.job_id}' removed from scheduler")


def get_scheduler() -> AsyncIOScheduler:
    """Get or create the singleton scheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()
        # Add event listeners
        _scheduler.add_listener(
            _job_listener,
            EVENT_JOB_EXECUTED | EVENT_JOB_ERROR | EVENT_JOB_MISSED | 
            EVENT_JOB_ADDED | EVENT_JOB_REMOVED
        )
    return _scheduler


async def run_electronics_scrape_job():
    """
    Job function to scrape Electronics products.
    This is called periodically by the scheduler.
    """
    global _job_stats
    
    from app.services.scraping_service import ScrapingService
    from app.services.chunking_service import ChunkingService
    from app.services.jina_embedding_service import JinaEmbeddingService
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qdrant_models
    from app.config import get_settings
    import uuid

    settings = get_settings()
    job_start_time = datetime.now()
    
    logger.info("=" * 60)
    logger.info("🔄 STARTING ELECTRONICS SCRAPING JOB")
    logger.info(f"   Start Time: {job_start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 60)

    scraper = ScrapingService()
    chunker = ChunkingService()
    embedder = JinaEmbeddingService()

    # Define electronics search queries
    queries = [
        "best laptops 2024",
        "wireless earbuds",
        "gaming headset",
        "mechanical keyboard",
        "4K monitor",
        "smartphone 2024",
        "tablet",
        "smart watch",
        "wireless mouse",
        "portable charger",
    ]
    
    logger.info(f"📋 Queries to process: {len(queries)}")

    # Initialize Qdrant
    qdrant_client = None
    if settings.qdrant_path:
        try:
            qdrant_client = QdrantClient(path=settings.qdrant_path)
            logger.info(f"📦 Connected to Qdrant (local): {settings.qdrant_path}")
        except Exception as e:
            logger.error(f"❌ Qdrant local init error: {e}")
    elif settings.qdrant_url:
        try:
            qdrant_client = QdrantClient(url=settings.qdrant_url)
            logger.info(f"📦 Connected to Qdrant (remote): {settings.qdrant_url}")
        except Exception as e:
            logger.error(f"❌ Qdrant remote init error: {e}")

    if not qdrant_client:
        logger.error("❌ No Qdrant connection available. Aborting job.")
        return

    # Ensure collection exists
    try:
        collection_info = qdrant_client.get_collection("product_chunks")
        logger.info(f"📊 Collection 'product_chunks' exists with {collection_info.points_count} points")
    except Exception:
        logger.info("📦 Creating 'product_chunks' collection...")
        qdrant_client.create_collection(
            collection_name="product_chunks",
            vectors_config=qdrant_models.VectorParams(
                size=embedder.dimension,
                distance=qdrant_models.Distance.COSINE,
            ),
        )
        logger.info("✅ Collection created successfully")

    total_indexed = 0
    total_products = 0
    total_chunks = 0
    errors = []

    for i, query in enumerate(queries, 1):
        logger.info(f"\n[{i}/{len(queries)}] 🔍 Processing: '{query}'")
        query_start = datetime.now()
        
        try:
            # Scrape
            result = await scraper.search_and_scrape(query, limit=10)
            products = result.get("products", [])
            scraped_count = result.get("total_found", 0)
            
            logger.info(f"   📥 Scraped: {len(products)} products (total found: {scraped_count})")

            if not products:
                logger.warning(f"   ⚠️ No products found for '{query}'")
                continue
            
            total_products += len(products)

            # Chunk products
            all_chunks = []
            for product in products:
                chunks = await chunker.chunk_product(product)
                all_chunks.extend(chunks)
            
            logger.info(f"   🔪 Created: {len(all_chunks)} chunks")
            total_chunks += len(all_chunks)

            if not all_chunks:
                logger.warning(f"   ⚠️ No chunks created for '{query}'")
                continue

            # Generate embeddings
            logger.info(f"   🧠 Generating embeddings...")
            texts = [c["content"] for c in all_chunks]
            embeddings = await embedder.embed_texts(texts)
            
            valid_embeddings = sum(1 for e in embeddings if e is not None)
            logger.info(f"   📊 Generated: {valid_embeddings}/{len(embeddings)} embeddings")

            # Prepare points for Qdrant
            points = []
            for chunk, embedding in zip(all_chunks, embeddings):
                if embedding is None:
                    continue

                point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{chunk['product_id']}_{chunk['chunk_type']}"))
                
                payload = {
                    "chunk_type": chunk["chunk_type"],
                    "content": chunk["content"],
                    "product_id": chunk["product_id"],
                    "product_title": chunk.get("product_title", ""),
                    "product_price": chunk.get("product_price", 0),
                    "category": "electronics",
                    "indexed_at": datetime.now().isoformat(),
                }

                points.append(
                    qdrant_models.PointStruct(
                        id=point_id,
                        vector=embedding,
                        payload=payload,
                    )
                )

            if points:
                qdrant_client.upsert(
                    collection_name="product_chunks",
                    points=points,
                )
                total_indexed += len(points)
                query_time = (datetime.now() - query_start).total_seconds()
                logger.info(f"   ✅ Indexed: {len(points)} chunks in {query_time:.2f}s")

        except Exception as e:
            error_msg = f"Error processing '{query}': {str(e)}"
            errors.append(error_msg)
            logger.error(f"   ❌ {error_msg}")
            continue

        # Small delay between queries
        await asyncio.sleep(2)

    # Update global stats
    _job_stats["total_products_indexed"] += total_indexed
    
    # Job summary
    job_duration = (datetime.now() - job_start_time).total_seconds()
    
    logger.info("\n" + "=" * 60)
    logger.info("🎉 JOB COMPLETED")
    logger.info("=" * 60)
    logger.info(f"   Duration: {job_duration:.2f} seconds")
    logger.info(f"   Products Scraped: {total_products}")
    logger.info(f"   Chunks Created: {total_chunks}")
    logger.info(f"   Chunks Indexed: {total_indexed}")
    logger.info(f"   Errors: {len(errors)}")
    if errors:
        logger.info(f"   Error Details:")
        for err in errors:
            logger.info(f"      - {err}")
    logger.info("=" * 60)


def setup_scheduler(run_on_start: bool = False):
    """
    Setup and start the scheduler with default jobs.
    
    Args:
        run_on_start: If True, run the scraping job immediately on startup
    """
    scheduler = get_scheduler()

    # Add electronics scraping job - runs every 6 hours
    scheduler.add_job(
        run_electronics_scrape_job,
        trigger=IntervalTrigger(hours=6),
        id="electronics_scrape",
        name="Electronics Product Scraping",
        replace_existing=True,
        max_instances=1,  # Prevent overlapping runs
    )

    logger.info("📅 Scheduler configured:")
    logger.info("   - Job: Electronics Product Scraping")
    logger.info("   - Interval: Every 6 hours")
    logger.info("   - Next run: In 6 hours (unless run_on_start=True)")

    if run_on_start:
        # Schedule immediate run
        scheduler.add_job(
            run_electronics_scrape_job,
            id="electronics_scrape_initial",
            name="Initial Electronics Scrape",
            replace_existing=True,
        )
        logger.info("   - Initial scrape: Queued for immediate execution")

    scheduler.start()
    logger.info("✅ Scheduler started successfully")


def shutdown_scheduler():
    """Shutdown the scheduler gracefully."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("⏹️ Scheduler stopped")
        
        # Log final stats
        stats = get_job_stats()
        logger.info(f"📊 Final Stats:")
        logger.info(f"   Total Runs: {stats['total_runs']}")
        logger.info(f"   Successful: {stats['successful_runs']}")
        logger.info(f"   Failed: {stats['failed_runs']}")
        logger.info(f"   Total Indexed: {stats['total_products_indexed']}")
