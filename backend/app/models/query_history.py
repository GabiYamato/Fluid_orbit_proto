import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class QueryHistory(Base):
    """Query history model for tracking user searches."""
    
    __tablename__ = "query_history"
    
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
    
    # Query details
    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_intent: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Response details
    response_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Store product IDs as comma-separated string for SQLite
    product_ids_str: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Metadata
    source_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    def __repr__(self) -> str:
        return f"<QueryHistory {self.query_text[:30]}>"
