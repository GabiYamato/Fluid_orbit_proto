import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Float, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SavedProduct(Base):
    """Model for user's saved/wishlisted products."""
    
    __tablename__ = "saved_products"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Product details (stored locally so user can access even if scraped data changes)
    product_id: Mapped[str] = mapped_column(String(255), nullable=True)  # Original product ID if available
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    review_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    affiliate_url: Mapped[str] = mapped_column(Text, nullable=False)  # Required - product link
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    brand: Mapped[str | None] = mapped_column(String(100), nullable=True)
    
    # User notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Timestamps
    saved_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    
    def __repr__(self) -> str:
        return f"<SavedProduct {self.title[:30]}...>"
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "product_id": self.product_id,
            "title": self.title,
            "description": self.description,
            "price": self.price,
            "currency": self.currency,
            "rating": self.rating,
            "review_count": self.review_count,
            "image_url": self.image_url,
            "affiliate_url": self.affiliate_url,
            "source": self.source,
            "category": self.category,
            "brand": self.brand,
            "notes": self.notes,
            "saved_at": self.saved_at.isoformat() if self.saved_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
