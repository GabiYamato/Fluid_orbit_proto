from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """Application configuration settings."""
    
    # Database - Use SQLite by default for local development
    database_url: str = "sqlite:///./shopgpt.db"
    redis_url: str = "redis://localhost:6379"
    qdrant_url: Optional[str] = None
    qdrant_path: Optional[str] = "./qdrant_data"
    
    # Authentication
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    
    # Google OAuth
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    
    # AI APIs
    openai_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    
    # External APIs
    rapidapi_key: Optional[str] = None
    serpapi_key: Optional[str] = None
    
    # Local LLM (Ollama)
    ollama_base_url: str = "http://localhost:11434/v1"
    use_local_llm: bool = True
    
    # Rate Limiting
    rate_limit_per_minute: int = 20
    rate_limit_per_day: int = 200
    
    # Application
    app_name: str = "ShopGPT"
    debug: bool = False
    
    class Config:
        # Look for .env in root directory (Shop_GPT/)
        import os
        # From backend/app/config.py -> backend/app -> backend -> Shop_GPT
        env_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            ".env"
        )
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
