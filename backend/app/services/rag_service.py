from typing import List, Dict, Any, Optional
from datetime import datetime
from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
import openai
import json

from app.config import get_settings
from app.schemas.query import ParsedIntent
from app.services.scoring_service import ScoringService
from app.services.external_api_service import ExternalAPIService

settings = get_settings()


class RAGService:
    """RAG (Retrieval-Augmented Generation) Service for product recommendations."""
    
    CONFIDENCE_THRESHOLD = 0.7
    
    def __init__(self):
        self.qdrant_client = None
        self.openai_client = None
        self.scoring_service = ScoringService()
        self.external_api_service = ExternalAPIService()
        
        if settings.qdrant_url:
            try:
                self.qdrant_client = QdrantClient(url=settings.qdrant_url)
            except Exception:
                pass
        
        if settings.openai_api_key:
            self.openai_client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
    
    async def get_recommendations(
        self,
        query: str,
        parsed_intent: ParsedIntent,
        max_results: int = 5,
    ) -> Dict[str, Any]:
        """
        Get product recommendations using RAG pipeline.
        
        Flow:
        1. Try vector DB retrieval first
        2. If low confidence, fallback to external APIs
        3. Score products
        4. Generate LLM response
        """
        # Try vector DB retrieval
        vector_results = await self._search_vector_db(query, parsed_intent)
        
        data_source = "indexed"
        confidence_level = "high"
        disclaimer = None
        
        # Check confidence and fallback if needed
        if not vector_results or len(vector_results) < 2:
            # Fallback to external APIs
            external_results = await self.external_api_service.search_products(
                query=query,
                category=parsed_intent.category,
                budget_max=parsed_intent.budget_max,
            )
            
            if external_results:
                vector_results = external_results
                data_source = "external_api"
                confidence_level = "medium"
                disclaimer = "Results from external sources. Prices may vary."
            else:
                # Use demo data if nothing else works
                vector_results = self._get_demo_products(parsed_intent)
                data_source = "demo"
                confidence_level = "low"
                disclaimer = "Showing demo results. Configure API keys for real data."
        
        # Score products
        scored_products = self.scoring_service.score_products(
            products=vector_results,
            intent=parsed_intent,
        )
        
        # Sort by final score
        scored_products.sort(key=lambda x: x.get("scores", {}).get("final_score", 0), reverse=True)
        
        # Limit results
        top_products = scored_products[:max_results]
        
        # Generate LLM response
        summary, recommendations = await self._generate_response(
            query=query,
            products=top_products,
            intent=parsed_intent,
        )
        
        return {
            "recommendations": recommendations,
            "summary": summary,
            "data_source": data_source,
            "confidence_level": confidence_level,
            "confidence_score": 0.9 if data_source == "indexed" else 0.6,
            "disclaimer": disclaimer,
        }
    
    async def _search_vector_db(
        self,
        query: str,
        intent: ParsedIntent,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Search vector database for similar products."""
        if not self.qdrant_client or not self.openai_client:
            return []
        
        try:
            # Generate embedding for query
            embedding_response = await self.openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=query,
            )
            query_embedding = embedding_response.data[0].embedding
            
            # Build filter conditions
            filter_conditions = []
            
            if intent.category:
                filter_conditions.append(
                    qdrant_models.FieldCondition(
                        key="category",
                        match=qdrant_models.MatchValue(value=intent.category),
                    )
                )
            
            if intent.budget_max:
                filter_conditions.append(
                    qdrant_models.FieldCondition(
                        key="price",
                        range=qdrant_models.Range(lte=intent.budget_max),
                    )
                )
            
            # Search Qdrant
            search_filter = None
            if filter_conditions:
                search_filter = qdrant_models.Filter(must=filter_conditions)
            
            results = self.qdrant_client.search(
                collection_name="products",
                query_vector=query_embedding,
                query_filter=search_filter,
                limit=limit,
            )
            
            # Convert to product dicts
            products = []
            for result in results:
                if result.score >= self.CONFIDENCE_THRESHOLD:
                    product = result.payload
                    product["vector_score"] = result.score
                    products.append(product)
            
            return products
            
        except Exception as e:
            print(f"Vector search error: {e}")
            return []
    
    async def _generate_response(
        self,
        query: str,
        products: List[Dict[str, Any]],
        intent: ParsedIntent,
    ) -> tuple[str, List[Dict[str, Any]]]:
        """Generate LLM response with recommendations."""
        if not self.openai_client:
            # Fallback: generate response without LLM
            return self._generate_fallback_response(products)
        
        try:
            # Prepare product context
            products_context = json.dumps([
                {
                    "title": p.get("title"),
                    "price": p.get("price"),
                    "rating": p.get("rating"),
                    "review_count": p.get("review_count"),
                    "scores": p.get("scores"),
                }
                for p in products
            ], indent=2)
            
            prompt = f"""You are a helpful product recommendation assistant. Based on the user's query and the scored products, provide:
1. A brief 2-3 sentence summary explaining your recommendations
2. For each product, list 2-3 pros and 2-3 cons

User Query: {query}
Parsed Intent: Category={intent.category}, Budget Max=${intent.budget_max or 'not specified'}, Features={intent.features}

Products (already scored and ranked):
{products_context}

Respond in JSON format:
{{
    "summary": "Your summary here",
    "product_analysis": [
        {{"title": "Product Name", "pros": ["pro1", "pro2"], "cons": ["con1", "con2"], "pick_type": "best|value|budget|null"}}
    ]
}}"""
            
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.7,
            )
            
            result = json.loads(response.choices[0].message.content)
            
            # Merge LLM analysis with product data
            recommendations = []
            for i, product in enumerate(products):
                analysis = next(
                    (a for a in result.get("product_analysis", []) if a.get("title") == product.get("title")),
                    {"pros": [], "cons": [], "pick_type": None}
                )
                
                recommendations.append({
                    "product": product,
                    "rank": i + 1,
                    "pros": analysis.get("pros", []),
                    "cons": analysis.get("cons", []),
                    "pick_type": analysis.get("pick_type"),
                })
            
            return result.get("summary", ""), recommendations
            
        except Exception as e:
            print(f"LLM generation error: {e}")
            return self._generate_fallback_response(products)
    
    def _generate_fallback_response(
        self,
        products: List[Dict[str, Any]],
    ) -> tuple[str, List[Dict[str, Any]]]:
        """Generate response without LLM."""
        if not products:
            return "No products found matching your criteria.", []
        
        summary = f"Found {len(products)} products matching your criteria. Products are ranked by our scoring algorithm considering price, rating, and reviews."
        
        recommendations = []
        for i, product in enumerate(products):
            pick_type = None
            if i == 0:
                pick_type = "best"
            elif product.get("price", 0) == min(p.get("price", float("inf")) for p in products):
                pick_type = "budget"
            
            recommendations.append({
                "product": product,
                "rank": i + 1,
                "pros": [
                    f"Rating: {product.get('rating', 'N/A')}/5",
                    f"{product.get('review_count', 0)} reviews",
                ],
                "cons": [],
                "pick_type": pick_type,
            })
        
        return summary, recommendations
    
    def _get_demo_products(self, intent: ParsedIntent) -> List[Dict[str, Any]]:
        """Get demo products for testing without API keys."""
        demo_products = {
            "earbuds": [
                {
                    "id": "demo-1",
                    "title": "Sony WF-1000XM5 Wireless Earbuds",
                    "description": "Industry-leading noise cancellation with exceptional sound quality",
                    "price": 279.99,
                    "rating": 4.7,
                    "review_count": 2500,
                    "brand": "Sony",
                    "category": "earbuds",
                    "source": "demo",
                    "image_url": "https://placehold.co/400x400?text=Sony+XM5",
                    "affiliate_url": "https://example.com/sony-xm5",
                },
                {
                    "id": "demo-2",
                    "title": "Apple AirPods Pro 2nd Generation",
                    "description": "Adaptive transparency, personalized spatial audio",
                    "price": 249.00,
                    "rating": 4.8,
                    "review_count": 15000,
                    "brand": "Apple",
                    "category": "earbuds",
                    "source": "demo",
                    "image_url": "https://placehold.co/400x400?text=AirPods+Pro",
                    "affiliate_url": "https://example.com/airpods-pro",
                },
                {
                    "id": "demo-3",
                    "title": "Samsung Galaxy Buds2 Pro",
                    "description": "24-bit Hi-Fi audio, intelligent ANC",
                    "price": 189.99,
                    "rating": 4.5,
                    "review_count": 3200,
                    "brand": "Samsung",
                    "category": "earbuds",
                    "source": "demo",
                    "image_url": "https://placehold.co/400x400?text=Galaxy+Buds",
                    "affiliate_url": "https://example.com/galaxy-buds",
                },
                {
                    "id": "demo-4",
                    "title": "Jabra Elite 85t True Wireless",
                    "description": "Advanced ANC, customizable sound",
                    "price": 149.99,
                    "rating": 4.4,
                    "review_count": 1800,
                    "brand": "Jabra",
                    "category": "earbuds",
                    "source": "demo",
                    "image_url": "https://placehold.co/400x400?text=Jabra+Elite",
                    "affiliate_url": "https://example.com/jabra-elite",
                },
                {
                    "id": "demo-5",
                    "title": "Anker Soundcore Liberty 4",
                    "description": "ACAA 3.0 drivers, heart rate sensor",
                    "price": 99.99,
                    "rating": 4.3,
                    "review_count": 5600,
                    "brand": "Anker",
                    "category": "earbuds",
                    "source": "demo",
                    "image_url": "https://placehold.co/400x400?text=Soundcore",
                    "affiliate_url": "https://example.com/soundcore",
                },
            ],
            "default": [
                {
                    "id": "demo-default-1",
                    "title": "Popular Product 1",
                    "description": "A highly rated product in this category",
                    "price": 149.99,
                    "rating": 4.5,
                    "review_count": 1000,
                    "category": intent.category or "general",
                    "source": "demo",
                    "image_url": "https://placehold.co/400x400?text=Product+1",
                    "affiliate_url": "https://example.com/product-1",
                },
                {
                    "id": "demo-default-2",
                    "title": "Popular Product 2",
                    "description": "Another excellent option",
                    "price": 99.99,
                    "rating": 4.3,
                    "review_count": 800,
                    "category": intent.category or "general",
                    "source": "demo",
                    "image_url": "https://placehold.co/400x400?text=Product+2",
                    "affiliate_url": "https://example.com/product-2",
                },
            ],
        }
        
        category = intent.category or "default"
        products = demo_products.get(category, demo_products["default"])
        
        # Filter by budget if specified
        if intent.budget_max:
            products = [p for p in products if p.get("price", 0) <= intent.budget_max]
        
        return products
