from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import get_settings
from app.database import init_db
from app.routers import auth_router, query_router, history_router
from app.utils.logging_config import setup_logging

settings = get_settings()

# Initialize logging before anything else
setup_logging(log_level="INFO", log_dir="./logs")
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    # Startup
    logger.info("🚀 Starting ShopGPT Backend...")
    
    # Pre-download/load embedding model
    try:
        from app.services.jina_embedding_service import JinaEmbeddingService
        embedder = JinaEmbeddingService()
        await embedder.ensure_model_loaded()
    except Exception as e:
        logger.warning(f"⚠️ Could not pre-load Jina model: {e}")

    await init_db()
    logger.info("✅ Database initialized")
    
    # Start scheduler for periodic scraping
    from app.utils.scheduler import setup_scheduler, shutdown_scheduler
    setup_scheduler(run_on_start=True)  # Scrapes on startup
    
    yield
    
    # Shutdown
    shutdown_scheduler()
    logger.info("👋 Shutting down ShopGPT Backend...")


app = FastAPI(
    title="ShopGPT API",
    description="AI-Powered Product Research & Recommendation Engine",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware - Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(query_router)
app.include_router(history_router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "ShopGPT API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "shopgpt-backend",
    }
