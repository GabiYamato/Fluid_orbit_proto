from typing import List, Dict, Any
import math

from app.schemas.query import ParsedIntent


class ScoringService:
    """
    Structured scoring engine for products.
    
    Each product gets transparent scores:
    - Price score (30%): Normalized vs budget & category median
    - Rating score (25%): 0-5 normalized to 0-100
    - Review volume score (15%): Log-scaled review count
    - Spec match score (30%): Keyword/requirement matching
    
    Final rank = weighted aggregate
    LLM explains scores, doesn't decide them.
    """
    
    WEIGHTS = {
        "price": 0.30,
        "rating": 0.25,
        "review_volume": 0.15,
        "spec_match": 0.30,
    }
    
    # Gender keywords for strict filtering
    GENDER_KEYWORDS = {
        "men": ["men's", "mens", "male", "man", " men ", "for men", "guys", "him"],
        "women": ["women's", "womens", "female", "woman", " women ", "for women", "ladies", "her", "girls"],
        "kids": ["kids", "children", "boys", "girls", "youth", "toddler", "baby", "infant"],
        "unisex": ["unisex", "gender neutral", "all genders"],
    }
    
    def score_products(
        self,
        products: List[Dict[str, Any]],
        intent: ParsedIntent,
    ) -> List[Dict[str, Any]]:
        """Score all products and add scores to each product dict."""
        if not products:
            return []
        
        # STEP 1: Apply strict filters (remove products that contradict user's intent)
        filtered_products = self._filter_products(products, intent)
        
        if not filtered_products:
            # Fallback: if filtering removed everything, use original list
            filtered_products = products
        
        # Calculate category stats for normalization
        prices = [p.get("price", 0) for p in filtered_products if p.get("price")]
        median_price = self._median(prices) if prices else 100
        max_reviews = max((p.get("review_count") or 0 for p in filtered_products), default=1)
        
        scored_products = []
        for product in filtered_products:
            scores = self._calculate_scores(
                product=product,
                intent=intent,
                median_price=median_price,
                max_reviews=max_reviews,
            )
            product["scores"] = scores
            scored_products.append(product)
        
        return scored_products
    
    def _filter_products(
        self,
        products: List[Dict[str, Any]],
        intent: ParsedIntent,
    ) -> List[Dict[str, Any]]:
        """Apply strict filters to exclude products that contradict user intent."""
        if not products:
            return []
        
        # STEP 0: Filter out products without a valid link
        # Products without links are not shoppable and should be excluded
        products_with_links = []
        for product in products:
            link = product.get("affiliate_url") or product.get("link") or product.get("url")
            if link and isinstance(link, str) and link.strip() and link.startswith("http"):
                products_with_links.append(product)
        
        if not products_with_links:
            # If all products were filtered out, fall back to original (shouldn't happen normally)
            products_with_links = products
        
        products = products_with_links
        
        # Extract gender from features if present
        user_gender = None
        for feature in intent.features:
            feature_lower = feature.lower()
            if any(kw in feature_lower for kw in ["men's", "mens", "male", " men"]):
                user_gender = "men"
                break
            elif any(kw in feature_lower for kw in ["women's", "womens", "female", " women", "ladies"]):
                user_gender = "women"
                break
            elif any(kw in feature_lower for kw in ["kids", "children", "boys", "girls", "youth"]):
                user_gender = "kids"
                break
            elif any(kw in feature_lower for kw in ["unisex"]):
                user_gender = "unisex"
                break
        
        if not user_gender:
            return products  # No gender filter to apply
        
        # Determine which gender keywords to EXCLUDE
        exclude_keywords = []
        if user_gender == "men":
            exclude_keywords = self.GENDER_KEYWORDS["women"] + self.GENDER_KEYWORDS["kids"]
        elif user_gender == "women":
            exclude_keywords = self.GENDER_KEYWORDS["men"] + self.GENDER_KEYWORDS["kids"]
        elif user_gender == "kids":
            # Don't exclude adult items for kids (parents often buy adult-looking stuff)
            exclude_keywords = []
        # Unisex: don't exclude anything
        
        filtered = []
        for product in products:
            product_text = f"{product.get('title', '')} {product.get('description', '')}".lower()
            
            # Check if product contains any excluded gender keywords
            is_excluded = False
            for kw in exclude_keywords:
                if kw.lower() in product_text:
                    is_excluded = True
                    break
            
            if not is_excluded:
                filtered.append(product)
        
        return filtered
    
    def _calculate_scores(
        self,
        product: Dict[str, Any],
        intent: ParsedIntent,
        median_price: float,
        max_reviews: int,
    ) -> Dict[str, float]:
        """Calculate individual scores for a product."""
        # Price score
        price_score = self._calculate_price_score(
            price=product.get("price", 0),
            budget_max=intent.budget_max,
            median_price=median_price,
        )
        
        # Rating score
        rating_score = self._calculate_rating_score(
            rating=product.get("rating", 0),
        )
        
        # Review volume score
        review_score = self._calculate_review_score(
            review_count=product.get("review_count", 0),
            max_reviews=max_reviews,
        )
        
        # Spec match score
        spec_score = self._calculate_spec_match_score(
            product=product,
            intent=intent,
        )
        
        # Calculate weighted final score
        final_score = (
            price_score * self.WEIGHTS["price"] +
            rating_score * self.WEIGHTS["rating"] +
            review_score * self.WEIGHTS["review_volume"] +
            spec_score * self.WEIGHTS["spec_match"]
        )
        
        return {
            "price_score": round(price_score, 1),
            "rating_score": round(rating_score, 1),
            "review_volume_score": round(review_score, 1),
            "spec_match_score": round(spec_score, 1),
            "final_score": round(final_score, 1),
        }
    
    def _calculate_price_score(
        self,
        price: float,
        budget_max: float | None,
        median_price: float,
    ) -> float:
        """
        Calculate price score (0-100).
        Lower price = higher score, with budget consideration.
        """
        if not price or price <= 0:
            return 50  # Neutral if no price
        
        # If budget specified, score relative to budget
        if budget_max and budget_max > 0:
            if price > budget_max:
                # Over budget penalty
                return max(0, 100 - ((price - budget_max) / budget_max * 100))
            else:
                # Under budget bonus
                savings_pct = (budget_max - price) / budget_max
                return min(100, 60 + savings_pct * 40)
        
        # Otherwise, score relative to median
        if price <= median_price:
            return min(100, 70 + (median_price - price) / median_price * 30)
        else:
            return max(30, 70 - (price - median_price) / median_price * 40)
    
    def _calculate_rating_score(self, rating: float) -> float:
        """
        Calculate rating score (0-100).
        Rating is on 0-5 scale, normalize to 0-100.
        """
        if not rating or rating <= 0:
            return 50  # Neutral if no rating
        
        # 3.0 = 50, 4.0 = 70, 4.5 = 85, 5.0 = 100
        if rating >= 4.0:
            return 70 + (rating - 4.0) * 30  # 4.0-5.0 -> 70-100
        elif rating >= 3.0:
            return 50 + (rating - 3.0) * 20  # 3.0-4.0 -> 50-70
        else:
            return max(0, rating * 50 / 3.0)  # 0-3.0 -> 0-50
    
    def _calculate_review_score(
        self,
        review_count: int,
        max_reviews: int,
    ) -> float:
        """
        Calculate review volume score (0-100).
        Uses log scale to prevent extreme products from dominating.
        """
        if not review_count or review_count <= 0:
            return 30  # Low score for no reviews
        
        # Log scale normalization
        log_count = math.log10(review_count + 1)
        log_max = math.log10(max_reviews + 1) if max_reviews > 0 else 1
        
        return min(100, (log_count / log_max) * 100)
    
    def _calculate_spec_match_score(
        self,
        product: Dict[str, Any],
        intent: ParsedIntent,
    ) -> float:
        """
        Calculate spec match score (0-100).
        Checks how well product matches requested features.
        """
        if not intent.features and not intent.brand_preferences:
            return 70  # Default if no specific requirements
        
        score = 50  # Base score
        total_requirements = len(intent.features) + len(intent.brand_preferences)
        
        if total_requirements == 0:
            return 70
        
        matches = 0
        
        # Check feature matches
        product_text = (
            f"{product.get('title', '')} {product.get('description', '')} "
            f"{str(product.get('specs', {}))}"
        ).lower()
        
        for feature in intent.features:
            if feature.lower() in product_text:
                matches += 1
        
        # Check brand match
        product_brand = product.get("brand", "").lower()
        for brand in intent.brand_preferences:
            if brand.lower() in product_brand or brand.lower() in product_text:
                matches += 1
        
        # Calculate percentage match
        match_percentage = matches / total_requirements
        return 50 + match_percentage * 50  # 50-100 based on matches
    
    @staticmethod
    def _median(values: List[float]) -> float:
        """Calculate median of a list of values."""
        if not values:
            return 0
        sorted_values = sorted(values)
        n = len(sorted_values)
        mid = n // 2
        if n % 2 == 0:
            return (sorted_values[mid - 1] + sorted_values[mid]) / 2
        return sorted_values[mid]
