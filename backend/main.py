from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import init_db
from app.routers import auth_router, query_router, history_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    # Startup
    print("🚀 Starting ShopGPT Backend...")
    await init_db()
    print("✅ Database initialized")
    
    # Start scheduler for periodic scraping
    from app.utils.scheduler import setup_scheduler, shutdown_scheduler
    setup_scheduler(run_on_start=True)  # Scrapes on startup
    
    yield
    
    # Shutdown
    shutdown_scheduler()
    print("👋 Shutting down ShopGPT Backend...")


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
