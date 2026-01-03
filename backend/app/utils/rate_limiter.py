from datetime import datetime, timedelta
from typing import Optional, Dict
from fastapi import HTTPException, status

from app.config import get_settings
from app.models.user import User

settings = get_settings()

# In-memory fallback storage (used when Redis is unavailable)
memory_rate_limits: Dict[str, Dict] = {}

# Skip Redis entirely for local development without Docker
USE_REDIS = False  # Set to True only if you have Redis running


async def get_redis():
    """Get Redis connection or None if unavailable."""
    if not USE_REDIS:
        return None
    
    try:
        import redis.asyncio as redis
        redis_pool = redis.from_url(settings.redis_url, decode_responses=True)
        await redis_pool.ping()
        return redis_pool
    except Exception:
        return None


class RateLimiter:
    """Rate limiter with Redis or in-memory fallback."""
    
    def __init__(
        self,
        requests_per_minute: int = 20,
        requests_per_day: int = 200,
    ):
        self.requests_per_minute = requests_per_minute
        self.requests_per_day = requests_per_day
    
    async def check(self, user_id: str) -> tuple[bool, dict]:
        """Check if user is within rate limits."""
        redis_client = await get_redis()
        
        if redis_client:
            return await self._check_redis(user_id, redis_client)
        else:
            return self._check_memory(user_id)
    
    async def _check_redis(self, user_id: str, redis_client) -> tuple[bool, dict]:
        """Check rate limits using Redis."""
        minute_key = f"rate:minute:{user_id}"
        day_key = f"rate:day:{user_id}"
        
        minute_count = await redis_client.get(minute_key)
        minute_count = int(minute_count) if minute_count else 0
        
        day_count = await redis_client.get(day_key)
        day_count = int(day_count) if day_count else 0
        
        limit_info = {
            "minute_remaining": max(0, self.requests_per_minute - minute_count),
            "day_remaining": max(0, self.requests_per_day - day_count),
            "minute_limit": self.requests_per_minute,
            "day_limit": self.requests_per_day,
        }
        
        if minute_count >= self.requests_per_minute:
            limit_info["retry_after"] = await redis_client.ttl(minute_key)
            return False, limit_info
        
        if day_count >= self.requests_per_day:
            limit_info["retry_after"] = await redis_client.ttl(day_key)
            return False, limit_info
        
        return True, limit_info
    
    def _check_memory(self, user_id: str) -> tuple[bool, dict]:
        """Check rate limits using in-memory storage."""
        now = datetime.utcnow()
        
        if user_id not in memory_rate_limits:
            memory_rate_limits[user_id] = {
                "minute_count": 0,
                "minute_reset": now + timedelta(minutes=1),
                "day_count": 0,
                "day_reset": now + timedelta(days=1),
            }
        
        user_data = memory_rate_limits[user_id]
        
        # Reset counters if expired
        if now >= user_data["minute_reset"]:
            user_data["minute_count"] = 0
            user_data["minute_reset"] = now + timedelta(minutes=1)
        
        if now >= user_data["day_reset"]:
            user_data["day_count"] = 0
            user_data["day_reset"] = now + timedelta(days=1)
        
        limit_info = {
            "minute_remaining": max(0, self.requests_per_minute - user_data["minute_count"]),
            "day_remaining": max(0, self.requests_per_day - user_data["day_count"]),
            "minute_limit": self.requests_per_minute,
            "day_limit": self.requests_per_day,
        }
        
        if user_data["minute_count"] >= self.requests_per_minute:
            limit_info["retry_after"] = int((user_data["minute_reset"] - now).total_seconds())
            return False, limit_info
        
        if user_data["day_count"] >= self.requests_per_day:
            limit_info["retry_after"] = int((user_data["day_reset"] - now).total_seconds())
            return False, limit_info
        
        return True, limit_info
    
    async def increment(self, user_id: str):
        """Increment rate limit counters."""
        redis_client = await get_redis()
        
        if redis_client:
            await self._increment_redis(user_id, redis_client)
        else:
            self._increment_memory(user_id)
    
    async def _increment_redis(self, user_id: str, redis_client):
        """Increment using Redis."""
        minute_key = f"rate:minute:{user_id}"
        day_key = f"rate:day:{user_id}"
        
        pipe = redis_client.pipeline()
        pipe.incr(minute_key)
        pipe.expire(minute_key, 60)
        pipe.incr(day_key)
        
        now = datetime.utcnow()
        midnight = datetime(now.year, now.month, now.day) + timedelta(days=1)
        seconds_until_midnight = int((midnight - now).total_seconds())
        pipe.expire(day_key, seconds_until_midnight)
        
        await pipe.execute()
    
    def _increment_memory(self, user_id: str):
        """Increment using in-memory storage."""
        if user_id in memory_rate_limits:
            memory_rate_limits[user_id]["minute_count"] += 1
            memory_rate_limits[user_id]["day_count"] += 1


# Default rate limiter instance
rate_limiter = RateLimiter(
    requests_per_minute=settings.rate_limit_per_minute,
    requests_per_day=settings.rate_limit_per_day,
)


async def check_rate_limit(user: User) -> dict:
    """Dependency to check and enforce rate limits."""
    is_allowed, limit_info = await rate_limiter.check(str(user.id))
    
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Rate limit exceeded",
                "retry_after": limit_info.get("retry_after", 60),
                "limits": limit_info,
            }
        )
    
    await rate_limiter.increment(str(user.id))
    return limit_info
