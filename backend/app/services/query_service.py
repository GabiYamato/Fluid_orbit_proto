import re
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert

from app.models.demand_counter import DemandCounter
from app.schemas.query import ParsedIntent
from app.config import get_settings

settings = get_settings()


class QueryService:
    """Service for query processing and intent parsing."""
    
    # Common category mappings
    CATEGORY_KEYWORDS = {
        "earbuds": ["earbuds", "earphones", "in-ear", "wireless earbuds", "tws"],
        "headphones": ["headphones", "over-ear", "on-ear", "noise cancelling"],
        "laptops": ["laptop", "notebook", "macbook", "chromebook"],
        "phones": ["phone", "smartphone", "iphone", "android", "mobile"],
        "tablets": ["tablet", "ipad", "android tablet"],
        "monitors": ["monitor", "display", "screen"],
        "keyboards": ["keyboard", "mechanical keyboard", "gaming keyboard"],
        "mice": ["mouse", "gaming mouse", "wireless mouse"],
        "cameras": ["camera", "dslr", "mirrorless", "webcam"],
        "speakers": ["speaker", "bluetooth speaker", "soundbar"],
    }
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def parse_intent(self, query: str) -> ParsedIntent:
        """Parse a natural language query into structured intent."""
        query_lower = query.lower()
        
        # Extract category
        category = self._extract_category(query_lower)
        
        # Extract budget
        budget_min, budget_max = self._extract_budget(query_lower)
        
        # Extract features
        features = self._extract_features(query_lower)
        
        # Extract brand preferences
        brands = self._extract_brands(query_lower)
        
        # Extract use case
        use_case = self._extract_use_case(query_lower)
        
        # Classify query type
        query_type = self._classify_query_type(query_lower)
        
        return ParsedIntent(
            category=category,
            budget_min=budget_min,
            budget_max=budget_max,
            features=features,
            brand_preferences=brands,
            use_case=use_case,
            query_type=query_type,
        )
    
    def _extract_category(self, query: str) -> Optional[str]:
        """Extract product category from query."""
        for category, keywords in self.CATEGORY_KEYWORDS.items():
            for keyword in keywords:
                if keyword in query:
                    return category
        return None
    
    def _extract_budget(self, query: str) -> tuple[Optional[float], Optional[float]]:
        """Extract budget constraints from query."""
        budget_min = None
        budget_max = None
        
        # Pattern: "under $X" or "below $X"
        under_pattern = r"(?:under|below|less than|up to)\s*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)"
        under_match = re.search(under_pattern, query)
        if under_match:
            budget_max = float(under_match.group(1).replace(",", ""))
        
        # Pattern: "over $X" or "above $X"
        over_pattern = r"(?:over|above|more than|at least)\s*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)"
        over_match = re.search(over_pattern, query)
        if over_match:
            budget_min = float(over_match.group(1).replace(",", ""))
        
        # Pattern: "$X to $Y" or "$X - $Y"
        range_pattern = r"\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:to|-)\s*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)"
        range_match = re.search(range_pattern, query)
        if range_match:
            budget_min = float(range_match.group(1).replace(",", ""))
            budget_max = float(range_match.group(2).replace(",", ""))
        
        return budget_min, budget_max
    
    def _extract_features(self, query: str) -> List[str]:
        """Extract desired features from query."""
        features = []
        
        feature_keywords = [
            "wireless", "bluetooth", "noise cancelling", "anc",
            "waterproof", "water resistant", "long battery",
            "fast charging", "usb-c", "lightweight", "portable",
            "gaming", "professional", "studio", "premium",
            "budget", "affordable", "high-end", "compact",
        ]
        
        for feature in feature_keywords:
            if feature in query:
                features.append(feature)
        
        return features
    
    def _extract_brands(self, query: str) -> List[str]:
        """Extract brand preferences from query."""
        brands = []
        
        known_brands = [
            "apple", "sony", "samsung", "bose", "sennheiser",
            "jabra", "anker", "jbl", "beats", "audio-technica",
            "logitech", "razer", "corsair", "dell", "hp", "lenovo",
            "asus", "acer", "microsoft", "google", "oneplus",
        ]
        
        for brand in known_brands:
            if brand in query:
                brands.append(brand.capitalize())
        
        return brands
    
    def _extract_use_case(self, query: str) -> Optional[str]:
        """Extract use case from query."""
        use_cases = {
            "gaming": ["gaming", "games", "esports"],
            "work": ["work", "office", "business", "professional"],
            "travel": ["travel", "airplane", "commute", "commuting"],
            "fitness": ["fitness", "workout", "gym", "running", "sports"],
            "music": ["music", "audiophile", "hi-fi", "studio"],
            "calls": ["calls", "meetings", "video calls", "conference"],
        }
        
        for use_case, keywords in use_cases.items():
            for keyword in keywords:
                if keyword in query:
                    return use_case
        
        return None
    
    def _classify_query_type(self, query: str) -> str:
        """
        Classify the query type for retrieval strategy selection.
        
        Types:
        - best_product: User wants the best/top recommendation
        - deep_dive: User wants detailed info about a specific product
        - multiple_listing: User wants to see multiple options
        - spec_lookup: User wants specific specs/features
        - review_based: User wants review/opinion information
        - general: Default for unclassified queries
        """
        # Best product patterns
        best_patterns = ["best", "top", "recommend", "should i buy", "which one", "what's the best", "most popular"]
        for pattern in best_patterns:
            if pattern in query:
                return "best_product"
        
        # Deep dive patterns (specific product mentions)
        deep_dive_patterns = ["tell me about", "details on", "more about", "info on", "information about", "how is the"]
        for pattern in deep_dive_patterns:
            if pattern in query:
                return "deep_dive"
        
        # Multiple listing patterns
        listing_patterns = ["show me", "list", "all", "options", "alternatives", "compare", "vs", "versus"]
        for pattern in listing_patterns:
            if pattern in query:
                return "multiple_listing"
        
        # Spec lookup patterns
        spec_patterns = ["battery life", "specs", "specifications", "how long", "how much ram", "screen size", "weight", "dimensions"]
        for pattern in spec_patterns:
            if pattern in query:
                return "spec_lookup"
        
        # Review-based patterns
        review_patterns = ["reviews", "what do people say", "opinions", "feedback", "worth it", "pros and cons", "complaints"]
        for pattern in review_patterns:
            if pattern in query:
                return "review_based"
        
        return "general"
    
    async def increment_demand(self, category: str):
        """Increment demand counter for a category."""
        stmt = insert(DemandCounter).values(
            category=category,
            query_count=1,
        ).on_conflict_do_update(
            index_elements=["category"],
            set_={"query_count": DemandCounter.query_count + 1},
        )
        
        await self.db.execute(stmt)
        await self.db.commit()
