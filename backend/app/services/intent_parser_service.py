"""
Intent Parser Service.

Analyzes user queries to detect missing information and returns
structured UI widget definitions for intuitive data collection.
Fashion-focused clarification system with DYNAMIC, product-specific questions.
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


# ============================================================================
# DYNAMIC PRODUCT-SPECIFIC QUESTIONS
# ============================================================================

PRODUCT_QUESTIONS = {
    # JEANS / DENIM
    "jeans": {
        "message": "Let's find your perfect jeans! A few quick questions:",
        "questions": [
            {
                "type": "poll",
                "field": "gender",
                "label": "Who's it for?",
                "options": [
                    {"value": "mens", "label": "👨 Men's"},
                    {"value": "womens", "label": "👩 Women's"},
                    {"value": "unisex", "label": "🧑 Unisex"},
                ],
            },
            {
                "type": "poll",
                "field": "fit",
                "label": "What fit do you prefer?",
                "options": [
                    {"value": "slim", "label": "Slim Fit"},
                    {"value": "straight", "label": "Straight"},
                    {"value": "relaxed", "label": "Relaxed"},
                    {"value": "skinny", "label": "Skinny"},
                    {"value": "bootcut", "label": "Bootcut"},
                    {"value": "wide_leg", "label": "Wide Leg"},
                ],
            },
            {
                "type": "poll",
                "field": "wash",
                "label": "Preferred wash/color?",
                "options": [
                    {"value": "dark_blue", "label": "Dark Blue"},
                    {"value": "light_blue", "label": "Light Blue"},
                    {"value": "black", "label": "Black"},
                    {"value": "grey", "label": "Grey"},
                    {"value": "distressed", "label": "Distressed"},
                ],
            },
            {
                "type": "slider",
                "field": "budget",
                "label": "Max Budget ($)",
                "min_value": 20,
                "max_value": 250,
                "step": 10,
                "default_value": 80,
            },
        ],
    },
    
    # DRESS
    "dress": {
        "message": "Let's find your perfect dress! A few quick questions:",
        "questions": [
            {
                "type": "poll",
                "field": "occasion",
                "label": "What's the occasion?",
                "options": [
                    {"value": "casual", "label": "Casual / Everyday"},
                    {"value": "party", "label": "Party / Night Out"},
                    {"value": "formal", "label": "Formal / Wedding"},
                    {"value": "work", "label": "Work / Office"},
                    {"value": "date", "label": "Date Night"},
                ],
            },
            {
                "type": "poll",
                "field": "length",
                "label": "Preferred length?",
                "options": [
                    {"value": "mini", "label": "Mini"},
                    {"value": "midi", "label": "Midi"},
                    {"value": "maxi", "label": "Maxi"},
                    {"value": "knee", "label": "Knee Length"},
                ],
            },
            {
                "type": "poll",
                "field": "style",
                "label": "Preferred style?",
                "options": [
                    {"value": "bodycon", "label": "Bodycon"},
                    {"value": "a_line", "label": "A-Line"},
                    {"value": "wrap", "label": "Wrap"},
                    {"value": "slip", "label": "Slip"},
                    {"value": "shirt", "label": "Shirt Dress"},
                ],
            },
            {
                "type": "slider",
                "field": "budget",
                "label": "Max Budget ($)",
                "min_value": 30,
                "max_value": 300,
                "step": 10,
                "default_value": 100,
            },
        ],
    },
    
    # SHOES / SNEAKERS
    "shoes": {
        "message": "Let's find your perfect shoes! A few quick questions:",
        "questions": [
            {
                "type": "poll",
                "field": "gender",
                "label": "Who's it for?",
                "options": [
                    {"value": "mens", "label": "👨 Men's"},
                    {"value": "womens", "label": "👩 Women's"},
                    {"value": "unisex", "label": "🧑 Unisex"},
                ],
            },
            {
                "type": "poll",
                "field": "type",
                "label": "What type of shoes?",
                "options": [
                    {"value": "sneakers", "label": "Sneakers"},
                    {"value": "running", "label": "Running"},
                    {"value": "casual", "label": "Casual"},
                    {"value": "formal", "label": "Formal / Dress"},
                    {"value": "boots", "label": "Boots"},
                    {"value": "sandals", "label": "Sandals"},
                ],
            },
            {
                "type": "poll",
                "field": "color",
                "label": "Preferred color?",
                "options": [
                    {"value": "black", "label": "Black"},
                    {"value": "white", "label": "White"},
                    {"value": "brown", "label": "Brown"},
                    {"value": "grey", "label": "Grey"},
                    {"value": "colorful", "label": "Colorful"},
                ],
            },
            {
                "type": "slider",
                "field": "budget",
                "label": "Max Budget ($)",
                "min_value": 30,
                "max_value": 300,
                "step": 10,
                "default_value": 100,
            },
        ],
    },
    
    # T-SHIRT / TEE
    "t-shirt": {
        "message": "Let's find your perfect t-shirt! A few quick questions:",
        "questions": [
            {
                "type": "poll",
                "field": "gender",
                "label": "Who's it for?",
                "options": [
                    {"value": "mens", "label": "👨 Men's"},
                    {"value": "womens", "label": "👩 Women's"},
                    {"value": "unisex", "label": "🧑 Unisex"},
                ],
            },
            {
                "type": "poll",
                "field": "style",
                "label": "What style?",
                "options": [
                    {"value": "graphic", "label": "Graphic Tee"},
                    {"value": "plain", "label": "Plain / Solid"},
                    {"value": "vintage", "label": "Vintage / Retro"},
                    {"value": "oversized", "label": "Oversized"},
                    {"value": "fitted", "label": "Fitted"},
                ],
            },
            {
                "type": "poll",
                "field": "neckline",
                "label": "Preferred neckline?",
                "options": [
                    {"value": "crew", "label": "Crew Neck"},
                    {"value": "v_neck", "label": "V-Neck"},
                    {"value": "scoop", "label": "Scoop"},
                ],
            },
            {
                "type": "slider",
                "field": "budget",
                "label": "Max Budget ($)",
                "min_value": 10,
                "max_value": 100,
                "step": 5,
                "default_value": 35,
            },
        ],
    },
    
    # HOODIE
    "hoodie": {
        "message": "Let's find your perfect hoodie! A few quick questions:",
        "questions": [
            {
                "type": "poll",
                "field": "gender",
                "label": "Who's it for?",
                "options": [
                    {"value": "mens", "label": "👨 Men's"},
                    {"value": "womens", "label": "👩 Women's"},
                    {"value": "unisex", "label": "🧑 Unisex"},
                ],
            },
            {
                "type": "poll",
                "field": "style",
                "label": "What style?",
                "options": [
                    {"value": "pullover", "label": "Pullover"},
                    {"value": "zip_up", "label": "Zip-Up"},
                    {"value": "oversized", "label": "Oversized"},
                    {"value": "cropped", "label": "Cropped"},
                ],
            },
            {
                "type": "poll",
                "field": "weight",
                "label": "How heavy?",
                "options": [
                    {"value": "lightweight", "label": "Lightweight"},
                    {"value": "midweight", "label": "Midweight"},
                    {"value": "heavyweight", "label": "Heavyweight / Fleece"},
                ],
            },
            {
                "type": "slider",
                "field": "budget",
                "label": "Max Budget ($)",
                "min_value": 20,
                "max_value": 150,
                "step": 10,
                "default_value": 60,
            },
        ],
    },
    
    # JACKET / COAT
    "jacket": {
        "message": "Let's find your perfect jacket! A few quick questions:",
        "questions": [
            {
                "type": "poll",
                "field": "gender",
                "label": "Who's it for?",
                "options": [
                    {"value": "mens", "label": "👨 Men's"},
                    {"value": "womens", "label": "👩 Women's"},
                ],
            },
            {
                "type": "poll",
                "field": "type",
                "label": "What type?",
                "options": [
                    {"value": "denim", "label": "Denim Jacket"},
                    {"value": "leather", "label": "Leather"},
                    {"value": "bomber", "label": "Bomber"},
                    {"value": "puffer", "label": "Puffer"},
                    {"value": "blazer", "label": "Blazer"},
                    {"value": "rain", "label": "Rain Jacket"},
                ],
            },
            {
                "type": "poll",
                "field": "use",
                "label": "Main use?",
                "options": [
                    {"value": "casual", "label": "Casual / Everyday"},
                    {"value": "work", "label": "Work / Office"},
                    {"value": "outdoor", "label": "Outdoor / Active"},
                    {"value": "winter", "label": "Winter / Cold Weather"},
                ],
            },
            {
                "type": "slider",
                "field": "budget",
                "label": "Max Budget ($)",
                "min_value": 40,
                "max_value": 400,
                "step": 20,
                "default_value": 120,
            },
        ],
    },
    
    # SWEATER
    "sweater": {
        "message": "Let's find your perfect sweater! A few quick questions:",
        "questions": [
            {
                "type": "poll",
                "field": "gender",
                "label": "Who's it for?",
                "options": [
                    {"value": "mens", "label": "👨 Men's"},
                    {"value": "womens", "label": "👩 Women's"},
                ],
            },
            {
                "type": "poll",
                "field": "style",
                "label": "What style?",
                "options": [
                    {"value": "crewneck", "label": "Crewneck"},
                    {"value": "v_neck", "label": "V-Neck"},
                    {"value": "cardigan", "label": "Cardigan"},
                    {"value": "turtleneck", "label": "Turtleneck"},
                    {"value": "cable_knit", "label": "Cable Knit"},
                ],
            },
            {
                "type": "poll",
                "field": "material",
                "label": "Preferred material?",
                "options": [
                    {"value": "cotton", "label": "Cotton"},
                    {"value": "wool", "label": "Wool"},
                    {"value": "cashmere", "label": "Cashmere"},
                    {"value": "blend", "label": "Blend / Any"},
                ],
            },
            {
                "type": "slider",
                "field": "budget",
                "label": "Max Budget ($)",
                "min_value": 25,
                "max_value": 200,
                "step": 10,
                "default_value": 70,
            },
        ],
    },
    
    # SHIRT (Button-up)
    "shirt": {
        "message": "Let's find your perfect shirt! A few quick questions:",
        "questions": [
            {
                "type": "poll",
                "field": "gender",
                "label": "Who's it for?",
                "options": [
                    {"value": "mens", "label": "👨 Men's"},
                    {"value": "womens", "label": "👩 Women's"},
                ],
            },
            {
                "type": "poll",
                "field": "occasion",
                "label": "What's it for?",
                "options": [
                    {"value": "casual", "label": "Casual"},
                    {"value": "work", "label": "Work / Office"},
                    {"value": "formal", "label": "Formal / Dress"},
                ],
            },
            {
                "type": "poll",
                "field": "pattern",
                "label": "Pattern preference?",
                "options": [
                    {"value": "solid", "label": "Solid Color"},
                    {"value": "striped", "label": "Striped"},
                    {"value": "plaid", "label": "Plaid / Flannel"},
                    {"value": "printed", "label": "Printed"},
                ],
            },
            {
                "type": "slider",
                "field": "budget",
                "label": "Max Budget ($)",
                "min_value": 20,
                "max_value": 150,
                "step": 10,
                "default_value": 50,
            },
        ],
    },
    
    # ACTIVEWEAR / SPORTSWEAR
    "activewear": {
        "message": "Let's find your perfect activewear! A few quick questions:",
        "questions": [
            {
                "type": "poll",
                "field": "gender",
                "label": "Who's it for?",
                "options": [
                    {"value": "mens", "label": "👨 Men's"},
                    {"value": "womens", "label": "👩 Women's"},
                ],
            },
            {
                "type": "poll",
                "field": "activity",
                "label": "What activity?",
                "options": [
                    {"value": "gym", "label": "Gym / Training"},
                    {"value": "running", "label": "Running"},
                    {"value": "yoga", "label": "Yoga / Pilates"},
                    {"value": "outdoor", "label": "Outdoor / Hiking"},
                    {"value": "athleisure", "label": "Athleisure / Casual"},
                ],
            },
            {
                "type": "poll",
                "field": "item",
                "label": "What item?",
                "options": [
                    {"value": "top", "label": "Top / T-Shirt"},
                    {"value": "leggings", "label": "Leggings"},
                    {"value": "shorts", "label": "Shorts"},
                    {"value": "set", "label": "Full Set"},
                    {"value": "sports_bra", "label": "Sports Bra"},
                ],
            },
            {
                "type": "slider",
                "field": "budget",
                "label": "Max Budget ($)",
                "min_value": 20,
                "max_value": 150,
                "step": 10,
                "default_value": 60,
            },
        ],
    },
    
    # PANTS (non-jeans)
    "pants": {
        "message": "Let's find your perfect pants! A few quick questions:",
        "questions": [
            {
                "type": "poll",
                "field": "gender",
                "label": "Who's it for?",
                "options": [
                    {"value": "mens", "label": "👨 Men's"},
                    {"value": "womens", "label": "👩 Women's"},
                ],
            },
            {
                "type": "poll",
                "field": "type",
                "label": "What type?",
                "options": [
                    {"value": "chinos", "label": "Chinos"},
                    {"value": "dress", "label": "Dress Pants"},
                    {"value": "cargo", "label": "Cargo"},
                    {"value": "joggers", "label": "Joggers"},
                    {"value": "linen", "label": "Linen"},
                ],
            },
            {
                "type": "poll",
                "field": "fit",
                "label": "Preferred fit?",
                "options": [
                    {"value": "slim", "label": "Slim"},
                    {"value": "regular", "label": "Regular"},
                    {"value": "relaxed", "label": "Relaxed"},
                ],
            },
            {
                "type": "slider",
                "field": "budget",
                "label": "Max Budget ($)",
                "min_value": 25,
                "max_value": 200,
                "step": 10,
                "default_value": 70,
            },
        ],
    },
}

# Default questions for unknown products
DEFAULT_QUESTIONS = {
    "message": "Let's find exactly what you need! A few quick questions:",
    "questions": [
        {
            "type": "poll",
            "field": "gender",
            "label": "Who's it for?",
            "options": [
                {"value": "mens", "label": "👨 Men's"},
                {"value": "womens", "label": "👩 Women's"},
                {"value": "unisex", "label": "🧑 Unisex"},
                {"value": "kids", "label": "👶 Kids"},
            ],
        },
        {
            "type": "poll",
            "field": "style",
            "label": "What style?",
            "options": [
                {"value": "casual", "label": "Casual"},
                {"value": "formal", "label": "Formal"},
                {"value": "athletic", "label": "Athletic"},
                {"value": "trendy", "label": "Trendy"},
            ],
        },
        {
            "type": "slider",
            "field": "budget",
            "label": "Max Budget ($)",
            "min_value": 20,
            "max_value": 200,
            "step": 10,
            "default_value": 75,
        },
    ],
}


class IntentParserService:
    """
    Service to analyze queries and detect when more information is needed.
    Returns DYNAMIC, product-specific UI widget definitions.
    """

    # Fashion keywords for detection
    FASHION_KEYWORDS = [
        "shirt", "t-shirt", "tshirt", "tee", "jeans", "dress", "jacket", "shoes", 
        "sneakers", "hoodie", "sweater", "pants", "shorts", "skirt", "coat",
        "blouse", "cardigan", "blazer", "suit", "polo", "tank top", "leggings",
        "activewear", "sportswear", "clothing", "clothes", "wear", "outfit",
        "fashion", "apparel", "garment", "top", "bottom", "kurta", "saree", "denim"
    ]
    
    # Keywords that indicate clarification has already been provided
    CLARIFICATION_INDICATORS = [
        "gender:", "size:", "type:", "budget:", "style:", "fit:", "wash:",
        "occasion:", "length:", "material:", "pattern:", "activity:",
        "mens", "men's", "womens", "women's", "unisex", "kids",
        "slim", "straight", "relaxed", "skinny", "bootcut",
        "casual", "formal", "athletic", "sports", "outdoor",
        "xs", "small", "medium", "large", "xl", "xxl",
        "$", "under", "below", "max", "up to"
    ]

    # Map product names to their question sets
    PRODUCT_MAPPING = {
        "jeans": "jeans", "denim": "jeans", "denims": "jeans",
        "dress": "dress", "gown": "dress", "saree": "dress",
        "shoes": "shoes", "footwear": "shoes", "sneakers": "shoes", "boots": "shoes",
        "t-shirt": "t-shirt", "tshirt": "t-shirt", "tee": "t-shirt",
        "hoodie": "hoodie", "hoody": "hoodie", "sweatshirt": "hoodie",
        "jacket": "jacket", "coat": "jacket", "blazer": "jacket", "parka": "jacket",
        "sweater": "sweater", "cardigan": "sweater", "pullover": "sweater",
        "shirt": "shirt", "blouse": "shirt", "polo": "shirt", "kurta": "shirt",
        "activewear": "activewear", "sportswear": "activewear", "gym": "activewear", "workout": "activewear",
        "pants": "pants", "trousers": "pants", "chinos": "pants",
        "shorts": "pants", "skirt": "dress", "leggings": "activewear",
    }

    def _is_fashion_query(self, query: str) -> bool:
        """Check if this is a fashion-related query."""
        query_lower = query.lower()
        for keyword in self.FASHION_KEYWORDS:
            if keyword in query_lower:
                return True
        return False

    def _detect_product_type(self, query: str) -> Optional[str]:
        """Detect the specific product type and return its question key."""
        query_lower = query.lower()
        
        for keyword, product_key in self.PRODUCT_MAPPING.items():
            if keyword in query_lower:
                return product_key
        
        return None

    def _has_clarification_data(self, query: str) -> bool:
        """Check if the query already contains clarification data."""
        query_lower = query.lower()
        
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
            
        # Style detection
        if any(t in query_lower for t in ["sport", "athletic", "gym", "workout", "fitness"]):
            extracted["style"] = "athletic"
        elif any(t in query_lower for t in ["formal", "office", "business", "professional"]):
            extracted["style"] = "formal"
        elif any(t in query_lower for t in ["casual", "everyday", "daily"]):
            extracted["style"] = "casual"
            
        # Fit detection (for jeans/pants)
        if any(f in query_lower for f in ["slim", "slim-fit", "slim fit"]):
            extracted["fit"] = "slim"
        elif any(f in query_lower for f in ["straight", "regular"]):
            extracted["fit"] = "straight"
        elif any(f in query_lower for f in ["relaxed", "loose"]):
            extracted["fit"] = "relaxed"
        elif "skinny" in query_lower:
            extracted["fit"] = "skinny"
            
        # Budget detection
        import re
        budget_match = re.search(r'\$?(\d+)', query_lower)
        if budget_match:
            extracted["budget"] = int(budget_match.group(1))
            
        return extracted

    def _get_product_questions(self, product_type: str) -> Dict[str, Any]:
        """Get the dynamic questions for a specific product type."""
        return PRODUCT_QUESTIONS.get(product_type, DEFAULT_QUESTIONS)

    def _build_widgets(self, product_type: str, provided: Dict[str, Any]) -> List[UIWidget]:
        """Build dynamic widgets based on product type, excluding already-provided info."""
        config = self._get_product_questions(product_type)
        widgets = []
        
        for q in config["questions"]:
            # Skip if this field was already provided
            if q["field"] in provided:
                continue
            
            widget = UIWidget(
                type=q["type"],
                field=q["field"],
                label=q["label"],
                required=False,
                options=q.get("options"),
                min_value=q.get("min_value"),
                max_value=q.get("max_value"),
                step=q.get("step"),
                default_value=q.get("default_value"),
            )
            widgets.append(widget)
        
        return widgets

    def analyze_query(
        self, query: str, parsed_intent: Dict[str, Any]
    ) -> MissingInfoResponse:
        """
        Analyze a query and determine if clarification is needed.
        Returns DYNAMIC, product-specific questions.
        """
        # Check if this is a fashion query
        is_fashion = self._is_fashion_query(query)
        product_type = self._detect_product_type(query) if is_fashion else None
        
        # If not fashion, skip clarification
        if not is_fashion:
            return MissingInfoResponse(
                needs_clarification=False,
                message="",
                widgets=[],
                parsed_so_far=parsed_intent,
            )
        
        # Check if user has already provided clarification answers
        if self._has_clarification_data(query):
            return MissingInfoResponse(
                needs_clarification=False,
                message="",
                widgets=[],
                parsed_so_far={
                    "category": product_type or "clothing",
                    **self._extract_provided_info(query),
                },
            )
        
        # Extract any info already in the original query
        provided = self._extract_provided_info(query)
        
        # Build dynamic widgets based on product type
        widgets = self._build_widgets(product_type or "default", provided)
        
        # Only ask for clarification if query is short/vague
        query_words = query.lower().split()
        is_short_query = len(query_words) <= 3
        
        needs_clarification = is_short_query and len(widgets) > 0
        
        if needs_clarification:
            config = self._get_product_questions(product_type or "default")
            message = config["message"]
        else:
            message = ""
        
        return MissingInfoResponse(
            needs_clarification=needs_clarification,
            message=message,
            widgets=widgets,
            parsed_so_far={
                "category": product_type or "clothing",
                "item": product_type,
                **provided,
            },
        )


# Global service instance
intent_parser_service = IntentParserService()
