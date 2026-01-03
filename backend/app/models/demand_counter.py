from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class DemandCounter(Base):
    """Demand counter for tracking category popularity and scraping priority."""
    
    __tablename__ = "demand_counters"
    
    category: Mapped[str] = mapped_column(String(100), primary_key=True)
    query_count: Mapped[int] = mapped_column(Integer, default=0)
    last_scraped: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    priority_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow
    )
    
    def __repr__(self) -> str:
        return f"<DemandCounter {self.category}: {self.query_count}>"
