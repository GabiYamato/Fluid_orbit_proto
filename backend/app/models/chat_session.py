"""
ChatSession Model for persisting chat history.
"""

from sqlalchemy import Column, String, JSON, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.database import Base


class ChatSession(Base):
    """Model for storing chat sessions per user."""
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    messages = Column(JSON, nullable=False, default=list)  # List of {role, content, timestamp}
    preview = Column(Text, nullable=True)  # First message preview for display
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<ChatSession {self.id} user={self.user_id}>"
