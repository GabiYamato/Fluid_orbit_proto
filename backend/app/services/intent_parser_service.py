"""
Intent Parser Service.

Analyzes user queries to detect missing information and returns
structured UI widget definitions for intuitive data collection.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel


class UIWidget(BaseModel):
    """Definition of a UI widget for collecting missing information."""
    type: str  # 'slider', 'checkbox_group', 'color_picker', 'text_input', 'select'
    field: str  # The field this widget collects (e.g., 'budget_max', 'color')
    label: str  # Display label
    required: bool = False
    options: Optional[List[Dict[str, Any]]] = None  # For select/checkbox
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
    """

    # Categories that benefit from specific questions
    CATEGORY_QUESTIONS = {
        "laptops": ["budget", "use_case", "screen_size"],
        "phones": ["budget", "brand", "storage"],
        "earbuds": ["budget", "features"],
        "headphones": ["budget", "use_case", "features"],
        "monitors": ["budget", "screen_size", "resolution"],
        "keyboards": ["budget", "switch_type"],
        "mice": ["budget", "use_case"],
    }

    # Field importance for determining if query is complete enough
    REQUIRED_FIELDS = ["category"]
    HELPFUL_FIELDS = ["budget_max", "use_case"]

    def analyze_query(
        self, query: str, parsed_intent: Dict[str, Any]
    ) -> MissingInfoResponse:
        """
        Analyze a query and its parsed intent to determine if more info is needed.
        
        Args:
            query: Original user query
            parsed_intent: Already parsed intent dictionary
            
        Returns:
            MissingInfoResponse with widgets if clarification needed
        """
        missing_widgets = []
        category = parsed_intent.get("category")

        # Check for category
        if not category:
            missing_widgets.append(
                UIWidget(
                    type="select",
                    field="category",
                    label="What type of product are you looking for?",
                    required=True,
                    options=[
                        {"value": "laptops", "label": "💻 Laptops"},
                        {"value": "phones", "label": "📱 Phones"},
                        {"value": "earbuds", "label": "🎧 Earbuds"},
                        {"value": "headphones", "label": "🎧 Headphones"},
                        {"value": "monitors", "label": "🖥️ Monitors"},
                        {"value": "keyboards", "label": "⌨️ Keyboards"},
                        {"value": "mice", "label": "🖱️ Mice"},
                        {"value": "tablets", "label": "📲 Tablets"},
                        {"value": "cameras", "label": "📷 Cameras"},
                        {"value": "speakers", "label": "🔊 Speakers"},
                    ],
                )
            )

        # Check for budget
        if not parsed_intent.get("budget_max") and not parsed_intent.get("budget_min"):
            missing_widgets.append(
                UIWidget(
                    type="slider",
                    field="budget",
                    label="What's your budget range?",
                    required=False,
                    min_value=0,
                    max_value=3000,
                    step=50,
                    default_value=[100, 500],  # Range slider default
                )
            )

        # Category-specific questions
        if category and category in self.CATEGORY_QUESTIONS:
            needed = self.CATEGORY_QUESTIONS[category]

            # Use case
            if "use_case" in needed and not parsed_intent.get("use_case"):
                use_case_options = self._get_use_case_options(category)
                if use_case_options:
                    missing_widgets.append(
                        UIWidget(
                            type="select",
                            field="use_case",
                            label="What will you primarily use this for?",
                            required=False,
                            options=use_case_options,
                        )
                    )

            # Features (checkbox group)
            if "features" in needed and not parsed_intent.get("features"):
                feature_options = self._get_feature_options(category)
                if feature_options:
                    missing_widgets.append(
                        UIWidget(
                            type="checkbox_group",
                            field="features",
                            label="Any must-have features?",
                            required=False,
                            options=feature_options,
                        )
                    )

        # Determine if we need clarification (only if category is missing OR 
        # if query is very short and vague)
        needs_clarification = (
            not category or 
            (len(query.split()) < 4 and not parsed_intent.get("budget_max"))
        )

        # Build message
        if needs_clarification and missing_widgets:
            message = self._build_clarification_message(missing_widgets, parsed_intent)
        else:
            message = ""

        return MissingInfoResponse(
            needs_clarification=needs_clarification and len(missing_widgets) > 0,
            message=message,
            widgets=missing_widgets[:3],  # Limit to 3 widgets at a time
            parsed_so_far={
                "category": parsed_intent.get("category"),
                "budget_min": parsed_intent.get("budget_min"),
                "budget_max": parsed_intent.get("budget_max"),
                "features": parsed_intent.get("features", []),
                "use_case": parsed_intent.get("use_case"),
                "brands": parsed_intent.get("brand_preferences", []),
            },
        )

    def _get_use_case_options(self, category: str) -> List[Dict[str, str]]:
        """Get use case options based on category."""
        use_cases = {
            "laptops": [
                {"value": "gaming", "label": "🎮 Gaming"},
                {"value": "work", "label": "💼 Work/Business"},
                {"value": "creative", "label": "🎨 Creative Work"},
                {"value": "student", "label": "📚 Student"},
                {"value": "general", "label": "🏠 General Use"},
            ],
            "headphones": [
                {"value": "music", "label": "🎵 Music Listening"},
                {"value": "gaming", "label": "🎮 Gaming"},
                {"value": "work", "label": "💼 Work/Calls"},
                {"value": "travel", "label": "✈️ Travel"},
                {"value": "fitness", "label": "🏃 Fitness"},
            ],
            "earbuds": [
                {"value": "music", "label": "🎵 Music"},
                {"value": "calls", "label": "📞 Calls"},
                {"value": "fitness", "label": "🏃 Fitness"},
                {"value": "commute", "label": "🚇 Commuting"},
            ],
            "monitors": [
                {"value": "gaming", "label": "🎮 Gaming"},
                {"value": "work", "label": "💼 Productivity"},
                {"value": "creative", "label": "🎨 Creative Work"},
                {"value": "general", "label": "🏠 General Use"},
            ],
            "mice": [
                {"value": "gaming", "label": "🎮 Gaming"},
                {"value": "work", "label": "💼 Office Work"},
                {"value": "creative", "label": "🎨 Creative/Design"},
            ],
        }
        return use_cases.get(category, [])

    def _get_feature_options(self, category: str) -> List[Dict[str, str]]:
        """Get feature options based on category."""
        features = {
            "earbuds": [
                {"value": "anc", "label": "🔇 Noise Cancelling"},
                {"value": "wireless", "label": "📶 Wireless"},
                {"value": "waterproof", "label": "💧 Waterproof"},
                {"value": "long_battery", "label": "🔋 Long Battery"},
            ],
            "headphones": [
                {"value": "anc", "label": "🔇 Noise Cancelling"},
                {"value": "wireless", "label": "📶 Wireless"},
                {"value": "foldable", "label": "📦 Foldable"},
                {"value": "mic", "label": "🎤 Built-in Mic"},
            ],
            "laptops": [
                {"value": "lightweight", "label": "🪶 Lightweight"},
                {"value": "long_battery", "label": "🔋 Long Battery"},
                {"value": "touchscreen", "label": "👆 Touchscreen"},
                {"value": "dedicated_gpu", "label": "🎮 Dedicated GPU"},
            ],
        }
        return features.get(category, [])

    def _build_clarification_message(
        self, widgets: List[UIWidget], parsed_intent: Dict[str, Any]
    ) -> str:
        """Build a friendly clarification message."""
        category = parsed_intent.get("category")

        if not category:
            return "I'd love to help you find the perfect product! Could you tell me a bit more about what you're looking for?"

        messages = {
            "laptops": "Great choice! To find the best laptop for you, I have a few quick questions:",
            "phones": "Awesome! Let me help you find the perfect phone. Just a couple of things:",
            "earbuds": "Nice! Finding the right earbuds is important. Quick questions:",
            "headphones": "Perfect! Let's find your ideal headphones:",
            "monitors": "Excellent! To recommend the best monitor:",
        }

        return messages.get(
            category,
            "To give you the best recommendations, could you help me with a few details?",
        )


# Global service instance
intent_parser_service = IntentParserService()
