from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings
import os

settings = get_settings()

# Use SQLite for local development if PostgreSQL is not available
database_url = settings.database_url

if database_url.startswith("postgresql://"):
    # Convert to async PostgreSQL driver
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
elif database_url.startswith("sqlite://"):
    # Convert to async SQLite driver
    database_url = database_url.replace("sqlite://", "sqlite+aiosqlite://")
else:
    # Default to SQLite for local development
    db_path = os.path.join(os.path.dirname(__file__), "..", "shopgpt.db")
    database_url = f"sqlite+aiosqlite:///{db_path}"

engine = create_async_engine(
    database_url,
    echo=settings.debug,
    pool_pre_ping=True if "postgresql" in database_url else False,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
