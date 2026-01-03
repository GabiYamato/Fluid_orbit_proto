import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, Text, Numeric, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Product(Base):
    """Product model for indexed/scraped products."""
    
    __tablename__ = "products"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    
    # Product details
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    brand: Mapped[str | None] = mapped_column(String(100), nullable=True)
    
    # Pricing and ratings
    price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    rating: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)
    review_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    # Structured data (use JSON for SQLite compatibility)
    specs: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    affiliate_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Vector embedding ID (for Qdrant)
    embedding_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    # Timestamps
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    def __repr__(self) -> str:
        return f"<Product {self.title[:50]}>"
    
    def to_dict(self) -> dict:
        """Convert product to dictionary for API responses."""
        return {
            "id": self.id,
            "external_id": self.external_id,
            "source": self.source,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "brand": self.brand,
            "price": float(self.price) if self.price else None,
            "currency": self.currency,
            "rating": float(self.rating) if self.rating else None,
            "review_count": self.review_count,
            "specs": self.specs,
            "image_url": self.image_url,
            "affiliate_url": self.affiliate_url,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
        }
