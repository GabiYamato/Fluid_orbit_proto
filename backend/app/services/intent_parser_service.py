"""
Intent Parser Service.

Analyzes user queries to detect missing information and returns
structured UI widget definitions for intuitive data collection.
Fashion-focused clarification system.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel


class UIWidget(BaseModel):
    """Definition of a UI widget for collecting missing information."""
    type: str  # 'slider', 'checkbox_group', 'color_picker', 'text_input', 'select', 'poll', 'radio'
    field: str  # The field this widget collects (e.g., 'budget_max', 'color')
    label: str  # Display label
    required: bool = False
    options: Optional[List[Dict[str, Any]]] = None  # For select/checkbox/poll
    min_value: Optional[float] = None  # For slider
    max_value: Optional[float] = None  # For slider
    step: Optional[float] = None  # For slider
    default_value: Optional[Any] = None
    placeholder: Optional[str] = None


class MissingInfoResponse(BaseModel):
    """Response when query needs more information."""
    needs_clarification: bool
    message: str
    widgets: List[UIWidget]
    parsed_so_far: Dict[str, Any]


class IntentParserService:
    """
    Service to analyze queries and detect when more information is needed.
    Returns UI widget definitions for intuitive data collection.
    Fashion-focused for now.
    """

    # Fashion keywords for detection
    FASHION_KEYWORDS = [
        "shirt", "t-shirt", "tshirt", "tee", "jeans", "dress", "jacket", "shoes", 
        "sneakers", "hoodie", "sweater", "pants", "shorts", "skirt", "coat",
        "blouse", "cardigan", "blazer", "suit", "polo", "tank top", "leggings",
        "activewear", "sportswear", "clothing", "clothes", "wear", "outfit",
        "fashion", "apparel", "garment", "top", "bottom", "kurta", "saree"
    ]
    
    # Keywords that indicate clarification has already been provided
    CLARIFICATION_INDICATORS = [
        "gender:", "size:", "type:", "budget:", "style:",
        "mens", "men's", "womens", "women's", "unisex", "kids",
        "sports", "outdoor", "formal", "casual", "fashion", "athletic",
        "xs", "small", "medium", "large", "xl", "xxl",
        "$", "under", "below", "max", "up to"
    ]

    def _is_fashion_query(self, query: str) -> bool:
        """Check if this is a fashion-related query."""
        query_lower = query.lower()
        for keyword in self.FASHION_KEYWORDS:
            if keyword in query_lower:
                return True
        return False

    def _detect_fashion_item(self, query: str) -> Optional[str]:
        """Detect the specific fashion item from query."""
        query_lower = query.lower()
        
        # Priority mapping
        items = [
            ("t-shirt", ["t-shirt", "tshirt", "t shirt", "tee"]),
            ("shirt", ["shirt", "blouse", "polo", "kurta"]),
            ("jeans", ["jeans", "denim"]),
            ("dress", ["dress", "gown", "saree"]),
            ("jacket", ["jacket", "blazer"]),
            ("hoodie", ["hoodie", "hoody"]),
            ("sweater", ["sweater", "cardigan", "pullover"]),
            ("shoes", ["shoes", "footwear"]),
            ("sneakers", ["sneakers", "trainers"]),
            ("pants", ["pants", "trousers", "chinos"]),
            ("shorts", ["shorts"]),
            ("skirt", ["skirt"]),
            ("coat", ["coat", "overcoat", "parka"]),
            ("activewear", ["activewear", "sportswear", "athletic wear", "gym wear"]),
        ]
        
        for item, keywords in items:
            for keyword in keywords:
                if keyword in query_lower:
                    return item
        
        return None

    def _has_clarification_data(self, query: str) -> bool:
        """Check if the query already contains clarification data (from previous answers)."""
        query_lower = query.lower()
        
        # If query contains clarification field indicators, user has already answered
        for indicator in self.CLARIFICATION_INDICATORS:
            if indicator in query_lower:
                return True
        
        return False

    def _extract_provided_info(self, query: str) -> Dict[str, Any]:
        """Extract any information already provided in the query."""
        query_lower = query.lower()
        extracted = {}
        
        # Gender detection
        if any(g in query_lower for g in ["men's", "mens", "male", "man", "men"]):
            extracted["gender"] = "mens"
        elif any(g in query_lower for g in ["women's", "womens", "female", "woman", "women", "ladies"]):
            extracted["gender"] = "womens"
        elif "unisex" in query_lower:
            extracted["gender"] = "unisex"
        elif any(g in query_lower for g in ["kid", "kids", "children", "child", "boy", "girl"]):
            extracted["gender"] = "kids"
            
        # Type/Style detection
        if any(t in query_lower for t in ["sport", "athletic", "gym", "workout", "fitness"]):
            extracted["style"] = "sports"
        elif any(t in query_lower for t in ["outdoor", "hiking", "camping", "adventure"]):
            extracted["style"] = "outdoor"
        elif any(t in query_lower for t in ["formal", "office", "business", "professional"]):
            extracted["style"] = "formal"
        elif any(t in query_lower for t in ["casual", "everyday", "daily"]):
            extracted["style"] = "casual"
        elif any(t in query_lower for t in ["fashion", "trendy", "stylish"]):
            extracted["style"] = "fashion"
            
        # Size detection
        sizes = {"xxs": "XXS", "xs": "XS", "small": "S", "medium": "M", "large": "L", "xl": "XL", "xxl": "XXL"}
        for size_key, size_val in sizes.items():
            if size_key in query_lower:
                extracted["size"] = size_val
                break
                
        # Budget detection (simple pattern matching)
        import re
        budget_match = re.search(r'\$?(\d+)', query_lower)
        if budget_match:
            extracted["budget"] = int(budget_match.group(1))
            
        return extracted

    def analyze_query(
        self, query: str, parsed_intent: Dict[str, Any]
    ) -> MissingInfoResponse:
        """
        Analyze a query and determine if clarification is needed.
        For fashion queries, ask all questions ONCE.
        """
        # Check if this is a fashion query
        is_fashion = self._is_fashion_query(query)
        fashion_item = self._detect_fashion_item(query) if is_fashion else None
        
        # If not fashion, skip clarification for now (focus on fashion only)
        if not is_fashion:
            return MissingInfoResponse(
                needs_clarification=False,
                message="",
                widgets=[],
                parsed_so_far=parsed_intent,
            )
        
        # Check if user has already provided clarification answers
        # This prevents re-asking after they submit the form
        if self._has_clarification_data(query):
            return MissingInfoResponse(
                needs_clarification=False,
                message="",
                widgets=[],
                parsed_so_far={
                    "category": fashion_item or "clothing",
                    **self._extract_provided_info(query),
                },
            )
        
        # Extract any info already in the original query
        provided = self._extract_provided_info(query)
        
        # Build widgets for missing info - show all at once
        widgets = []
        
        # 1. Gender (if not provided)
        if not provided.get("gender"):
            widgets.append(
                UIWidget(
                    type="poll",
                    field="gender",
                    label="Gender?",
                    required=False,
                    options=[
                        {"value": "mens", "label": "Men's"},
                        {"value": "womens", "label": "Women's"},
                        {"value": "unisex", "label": "Unisex"},
                        {"value": "kids", "label": "Kids"},
                    ],
                )
            )
        
        # 2. Type/Style (if not provided)
        if not provided.get("style"):
            widgets.append(
                UIWidget(
                    type="poll",
                    field="style",
                    label="Type?",
                    required=False,
                    options=[
                        {"value": "casual", "label": "Casual"},
                        {"value": "sports", "label": "Sports / Athletic"},
                        {"value": "outdoor", "label": "Outdoor"},
                        {"value": "formal", "label": "Formal"},
                        {"value": "fashion", "label": "Fashion / Trendy"},
                    ],
                )
            )
        
        # 3. Size (if not provided)
        if not provided.get("size"):
            widgets.append(
                UIWidget(
                    type="poll",
                    field="size",
                    label="Size?",
                    required=False,
                    options=[
                        {"value": "XS", "label": "XS"},
                        {"value": "S", "label": "S"},
                        {"value": "M", "label": "M"},
                        {"value": "L", "label": "L"},
                        {"value": "XL", "label": "XL"},
                        {"value": "XXL", "label": "XXL"},
                    ],
                )
            )
        
        # 4. Budget slider (if not provided)
        if not provided.get("budget"):
            widgets.append(
                UIWidget(
                    type="slider",
                    field="budget",
                    label="Max Budget",
                    required=False,
                    min_value=10,
                    max_value=200,
                    step=10,
                    default_value=50,
                )
            )
        
        # Only ask for clarification if we have missing widgets
        # AND the query is short/vague (less than 3 substantive words after the item name)
        query_words = query.lower().split()
        is_short_query = len(query_words) <= 3
        
        needs_clarification = is_short_query and len(widgets) > 0
        
        if needs_clarification:
            item_name = fashion_item or "item"
            message = f"Let me help you find the perfect {item_name}! Quick questions:"
        else:
            message = ""
        
        return MissingInfoResponse(
            needs_clarification=needs_clarification,
            message=message,
            widgets=widgets,  # Show ALL widgets at once
            parsed_so_far={
                "category": fashion_item or "clothing",
                "item": fashion_item,
                **provided,
            },
        )


# Global service instance
intent_parser_service = IntentParserService()
