"""
Inventory Scrape Service.

Performs asynchronous inventory scraping of ALL 35+ fashion retailer websites
simultaneously, embeds the products, and stores them in both:
- SQLite/PostgreSQL (Product model)
- Qdrant Vector Database (for semantic search)

This is designed to be run as a background job to keep the inventory fresh.
"""

import asyncio
import uuid
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

from app.config import get_settings
from app.services.scraping_service import ScrapingService, FASHION_RETAILERS
from app.services.local_embedding_service import LocalEmbeddingService
from app.services.chunking_service import ChunkingService
from app.database import async_session_maker
from app.models.product import Product

from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

settings = get_settings()

# Configure logger
logger = logging.getLogger("inventory_scrape")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        "%(asctime)s | %(levelname)-8s | INVENTORY | %(message)s",
        datefmt="%H:%M:%S"
    ))
    logger.addHandler(handler)


@dataclass
class ScrapeResult:
    """Result from scraping a single retailer."""
    retailer_key: str
    retailer_name: str
    products: List[Dict[str, Any]] = field(default_factory=list)
    success: bool = False
    error: Optional[str] = None
    duration_seconds: float = 0.0


@dataclass
class InventoryScrapeStats:
    """Statistics from a full inventory scrape run."""
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    total_retailers: int = 0
    successful_retailers: int = 0
    failed_retailers: int = 0
    total_products_scraped: int = 0
    total_products_indexed: int = 0
    total_embeddings_created: int = 0
    errors: List[str] = field(default_factory=list)
    retailer_results: Dict[str, ScrapeResult] = field(default_factory=dict)
    
    @property
    def duration_seconds(self) -> float:
        if self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return (datetime.utcnow() - self.started_at).total_seconds()
    
    def to_dict(self) -> dict:
        return {
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_seconds": self.duration_seconds,
            "total_retailers": self.total_retailers,
            "successful_retailers": self.successful_retailers,
            "failed_retailers": self.failed_retailers,
            "total_products_scraped": self.total_products_scraped,
            "total_products_indexed": self.total_products_indexed,
            "total_embeddings_created": self.total_embeddings_created,
            "errors": self.errors[:10],  # Limit to first 10 errors
            "success_rate": f"{(self.successful_retailers / max(1, self.total_retailers)) * 100:.1f}%"
        }


# Global state for tracking current scrape
_current_scrape: Optional[InventoryScrapeStats] = None
_last_scrape: Optional[InventoryScrapeStats] = None
_is_scraping: bool = False


def get_scrape_status() -> dict:
    """Get the current scraping status."""
    return {
        "is_scraping": _is_scraping,
        "current_scrape": _current_scrape.to_dict() if _current_scrape else None,
        "last_scrape": _last_scrape.to_dict() if _last_scrape else None,
    }


class InventoryScrapeService:
    """
    Service that asynchronously scrapes ALL fashion retailers at once,
    generates embeddings, and stores products in both SQLite and Qdrant.
    """
    
    # Scrape configuration
    CONCURRENT_RETAILERS = 35  # Scrape all retailers simultaneously
    PRODUCTS_PER_RETAILER = 20  # Max products to scrape per retailer
    EMBEDDING_BATCH_SIZE = 50  # Batch size for embedding generation
    
    # Default search queries per category
    DEFAULT_QUERIES = [
        "trending fashion",
        "popular clothing",
        "best sellers",
        "new arrivals",
    ]
    
    def __init__(self):
        self.scraping_service = ScrapingService()
        self.embedding_service = LocalEmbeddingService()
        self.chunking_service = ChunkingService()
        self.qdrant_client = self._init_qdrant()
    
    def _init_qdrant(self) -> Optional[QdrantClient]:
        """Initialize Qdrant client."""
        try:
            if settings.qdrant_path:
                return QdrantClient(path=settings.qdrant_path)
            elif settings.qdrant_url:
                return QdrantClient(url=settings.qdrant_url)
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant: {e}")
        return None
    
    async def _ensure_collection(self):
        """Ensure the Qdrant collection exists with correct dimensions."""
        if not self.qdrant_client:
            return
            
        collection_name = "inventory_products"
        embedding_dim = self.embedding_service.EMBEDDING_DIM  # 384
        
        try:
            try:
                coll_info = self.qdrant_client.get_collection(collection_name)
                if coll_info.config.params.vectors.size != embedding_dim:
                    logger.warning(f"Collection dim mismatch. Recreating...")
                    self.qdrant_client.delete_collection(collection_name)
                    raise Exception("Recreate needed")
            except Exception:
                logger.info(f"Creating '{collection_name}' collection (dim={embedding_dim})...")
                self.qdrant_client.create_collection(
                    collection_name=collection_name,
                    vectors_config=qdrant_models.VectorParams(
                        size=embedding_dim,
                        distance=qdrant_models.Distance.COSINE,
                    ),
                )
        except Exception as e:
            logger.error(f"Collection setup error: {e}")
    
    async def scrape_single_retailer(
        self,
        retailer_key: str,
        queries: Optional[List[str]] = None
    ) -> ScrapeResult:
        """
        Scrape a single retailer with multiple search queries.
        """
        start_time = datetime.utcnow()
        config = FASHION_RETAILERS.get(retailer_key)
        
        if not config:
            return ScrapeResult(
                retailer_key=retailer_key,
                retailer_name="Unknown",
                success=False,
                error="Retailer not found"
            )
        
        retailer_name = config["name"]
        all_products = []
        
        # Use default queries if none provided
        search_queries = queries or self.DEFAULT_QUERIES
        
        try:
            # Run multiple queries for this retailer
            for query in search_queries:
                try:
                    products = await self.scraping_service._scrape_single_store(
                        retailer_key, query
                    )
                    if products:
                        all_products.extend(products)
                        
                    # Limit products per retailer
                    if len(all_products) >= self.PRODUCTS_PER_RETAILER:
                        all_products = all_products[:self.PRODUCTS_PER_RETAILER]
                        break
                        
                except Exception as e:
                    logger.debug(f"Query '{query}' failed for {retailer_name}: {e}")
                    continue
            
            duration = (datetime.utcnow() - start_time).total_seconds()
            
            if all_products:
                logger.info(f"✅ {retailer_name}: {len(all_products)} products ({duration:.1f}s)")
                return ScrapeResult(
                    retailer_key=retailer_key,
                    retailer_name=retailer_name,
                    products=all_products,
                    success=True,
                    duration_seconds=duration
                )
            else:
                return ScrapeResult(
                    retailer_key=retailer_key,
                    retailer_name=retailer_name,
                    success=False,
                    error="No products found",
                    duration_seconds=duration
                )
                
        except Exception as e:
            duration = (datetime.utcnow() - start_time).total_seconds()
            logger.warning(f"❌ {retailer_name}: {str(e)[:50]}")
            return ScrapeResult(
                retailer_key=retailer_key,
                retailer_name=retailer_name,
                success=False,
                error=str(e),
                duration_seconds=duration
            )
    
    async def scrape_all_retailers(
        self,
        queries: Optional[List[str]] = None
    ) -> Tuple[List[Dict[str, Any]], InventoryScrapeStats]:
        """
        Scrape ALL retailers asynchronously at the same time.
        
        Returns:
            Tuple of (all_products, stats)
        """
        global _current_scrape, _is_scraping
        
        _is_scraping = True
        stats = InventoryScrapeStats()
        _current_scrape = stats
        
        retailer_keys = list(FASHION_RETAILERS.keys())
        stats.total_retailers = len(retailer_keys)
        
        logger.info("=" * 60)
        logger.info("🚀 STARTING FULL INVENTORY SCRAPE")
        logger.info(f"   Retailers: {stats.total_retailers}")
        logger.info(f"   Mode: FULLY ASYNC (all at once)")
        logger.info("=" * 60)
        
        # Create tasks for ALL retailers at once
        tasks = [
            self.scrape_single_retailer(key, queries)
            for key in retailer_keys
        ]
        
        # Run all scrapes concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Collect all products
        all_products = []
        
        for result in results:
            if isinstance(result, Exception):
                stats.failed_retailers += 1
                stats.errors.append(str(result))
            elif isinstance(result, ScrapeResult):
                stats.retailer_results[result.retailer_key] = result
                
                if result.success:
                    stats.successful_retailers += 1
                    all_products.extend(result.products)
                else:
                    stats.failed_retailers += 1
                    if result.error:
                        stats.errors.append(f"{result.retailer_name}: {result.error}")
        
        stats.total_products_scraped = len(all_products)
        
        logger.info(f"\n📊 Scrape Summary:")
        logger.info(f"   Successful: {stats.successful_retailers}/{stats.total_retailers}")
        logger.info(f"   Products: {stats.total_products_scraped}")
        
        return all_products, stats
    
    async def embed_products(
        self,
        products: List[Dict[str, Any]]
    ) -> List[Tuple[Dict[str, Any], List[float]]]:
        """
        Generate embeddings for all products.
        
        Returns list of (product, embedding) tuples.
        """
        if not products:
            return []
        
        logger.info(f"🧠 Generating embeddings for {len(products)} products...")
        
        # Prepare texts for embedding
        texts = []
        for p in products:
            text = f"{p.get('title', '')} {p.get('description', '')} {p.get('source', '')}"
            if p.get('price'):
                text += f" Price: ${p.get('price')}"
            texts.append(text)
        
        # Batch embed
        all_embeddings = []
        for i in range(0, len(texts), self.EMBEDDING_BATCH_SIZE):
            batch = texts[i:i + self.EMBEDDING_BATCH_SIZE]
            embeddings = await self.embedding_service.embed_texts(batch)
            all_embeddings.extend(embeddings)
            logger.info(f"   Embedded batch {i//self.EMBEDDING_BATCH_SIZE + 1}/{(len(texts)-1)//self.EMBEDDING_BATCH_SIZE + 1}")
        
        # Pair products with embeddings
        results = []
        for product, embedding in zip(products, all_embeddings):
            if embedding is not None:
                results.append((product, embedding))
        
        logger.info(f"   ✅ Generated {len(results)} embeddings")
        return results
    
    async def store_in_database(
        self,
        products: List[Dict[str, Any]]
    ) -> int:
        """
        Store products in SQLite/PostgreSQL database.
        Uses upsert to avoid duplicates.
        
        Returns number of products stored.
        """
        if not products:
            return 0
        
        logger.info(f"💾 Storing {len(products)} products in database...")
        stored = 0
        
        async with async_session_maker() as session:
            for product in products:
                try:
                    # Generate a unique ID based on the product URL
                    product_url = product.get('affiliate_url') or product.get('id', '')
                    product_id = str(uuid.uuid5(uuid.NAMESPACE_URL, product_url))
                    
                    # Check if exists
                    existing = await session.execute(
                        select(Product).where(Product.id == product_id)
                    )
                    existing_product = existing.scalar_one_or_none()
                    
                    if existing_product:
                        # Update existing
                        existing_product.title = product.get('title', existing_product.title)
                        existing_product.price = product.get('price')
                        existing_product.image_url = product.get('image_url')
                        existing_product.last_updated = datetime.utcnow()
                    else:
                        # Create new
                        new_product = Product(
                            id=product_id,
                            external_id=product.get('id'),
                            source=product.get('source', 'unknown'),
                            title=product.get('title', 'Unknown Product'),
                            description=product.get('description'),
                            category=product.get('category', 'fashion'),
                            brand=product.get('brand'),
                            price=product.get('price'),
                            rating=product.get('rating'),
                            review_count=product.get('review_count'),
                            image_url=product.get('image_url'),
                            affiliate_url=product.get('affiliate_url'),
                        )
                        session.add(new_product)
                    
                    stored += 1
                    
                except Exception as e:
                    logger.debug(f"Error storing product: {e}")
                    continue
            
            await session.commit()
        
        logger.info(f"   ✅ Stored {stored} products in database")
        return stored
    
    async def store_in_vector_db(
        self,
        product_embeddings: List[Tuple[Dict[str, Any], List[float]]]
    ) -> int:
        """
        Store products with embeddings in Qdrant vector database.
        
        Returns number of products indexed.
        """
        if not self.qdrant_client or not product_embeddings:
            return 0
        
        await self._ensure_collection()
        
        logger.info(f"📦 Indexing {len(product_embeddings)} products in Qdrant...")
        
        points = []
        for product, embedding in product_embeddings:
            try:
                product_url = product.get('affiliate_url') or product.get('id', '')
                point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, product_url))
                
                payload = {
                    "title": product.get("title"),
                    "description": product.get("description"),
                    "price": product.get("price"),
                    "rating": product.get("rating"),
                    "image_url": product.get("image_url"),
                    "affiliate_url": product.get("affiliate_url"),
                    "source": product.get("source"),
                    "category": product.get("category", "fashion"),
                    "indexed_at": datetime.utcnow().isoformat(),
                }
                
                points.append(
                    qdrant_models.PointStruct(
                        id=point_id,
                        vector=embedding,
                        payload=payload,
                    )
                )
            except Exception as e:
                logger.debug(f"Error preparing point: {e}")
                continue
        
        if points:
            try:
                # Batch upsert
                batch_size = 100
                for i in range(0, len(points), batch_size):
                    batch = points[i:i + batch_size]
                    self.qdrant_client.upsert(
                        collection_name="inventory_products",
                        points=batch,
                    )
                logger.info(f"   ✅ Indexed {len(points)} products in Qdrant")
            except Exception as e:
                logger.error(f"Qdrant upsert error: {e}")
                return 0
        
        return len(points)
    
    async def run_full_inventory_scrape(
        self,
        queries: Optional[List[str]] = None
    ) -> InventoryScrapeStats:
        """
        Run a complete inventory scrape:
        1. Scrape ALL retailers asynchronously
        2. Generate embeddings for all products
        3. Store in SQLite database
        4. Store in Qdrant vector database
        
        Returns:
            InventoryScrapeStats with complete statistics
        """
        global _current_scrape, _last_scrape, _is_scraping
        
        try:
            # Step 1: Scrape all retailers
            products, stats = await self.scrape_all_retailers(queries)
            
            if not products:
                logger.warning("No products scraped. Aborting.")
                stats.completed_at = datetime.utcnow()
                _is_scraping = False
                _last_scrape = stats
                return stats
            
            # Step 2: Deduplicate products
            seen_urls = set()
            unique_products = []
            for p in products:
                url = p.get('affiliate_url') or p.get('id', '')
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    unique_products.append(p)
            
            logger.info(f"📋 Unique products after dedup: {len(unique_products)}")
            
            # Step 3: Generate embeddings
            product_embeddings = await self.embed_products(unique_products)
            stats.total_embeddings_created = len(product_embeddings)
            
            # Step 4: Store in SQLite (async)
            # Step 5: Store in Qdrant (async)
            db_task = self.store_in_database(unique_products)
            vector_task = self.store_in_vector_db(product_embeddings)
            
            db_stored, vector_indexed = await asyncio.gather(db_task, vector_task)
            stats.total_products_indexed = vector_indexed
            
            # Complete
            stats.completed_at = datetime.utcnow()
            
            logger.info("\n" + "=" * 60)
            logger.info("🎉 INVENTORY SCRAPE COMPLETE")
            logger.info("=" * 60)
            logger.info(f"   Duration: {stats.duration_seconds:.1f}s")
            logger.info(f"   Retailers: {stats.successful_retailers}/{stats.total_retailers}")
            logger.info(f"   Products Scraped: {stats.total_products_scraped}")
            logger.info(f"   Unique Products: {len(unique_products)}")
            logger.info(f"   Embeddings: {stats.total_embeddings_created}")
            logger.info(f"   DB Stored: {db_stored}")
            logger.info(f"   Vector Indexed: {stats.total_products_indexed}")
            logger.info("=" * 60)
            
            return stats
            
        except Exception as e:
            logger.error(f"Full scrape error: {e}")
            if _current_scrape:
                _current_scrape.errors.append(str(e))
                _current_scrape.completed_at = datetime.utcnow()
            raise
        finally:
            _is_scraping = False
            _last_scrape = _current_scrape
            _current_scrape = None


# Singleton instance
_inventory_service: Optional[InventoryScrapeService] = None


def get_inventory_service() -> InventoryScrapeService:
    """Get or create the inventory scrape service singleton."""
    global _inventory_service
    if _inventory_service is None:
        _inventory_service = InventoryScrapeService()
    return _inventory_service


async def run_inventory_scrape_job(queries: Optional[List[str]] = None):
    """
    Job function to run the full inventory scrape.
    Can be called from the scheduler or manually.
    """
    service = get_inventory_service()
    return await service.run_full_inventory_scrape(queries)
