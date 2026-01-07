from typing import List, Dict, Any, Optional
from datetime import datetime
from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
import openai
import json

from app.config import get_settings
from app.schemas.query import ParsedIntent
from app.services.scoring_service import ScoringService
from app.services.scraping_service import ScrapingService
from app.services.external_api_service import ExternalAPIService

settings = get_settings()

class RAGService:
    """RAG (Retrieval-Augmented Generation) Service for product recommendations."""
    
    CONFIDENCE_THRESHOLD = 0.7
    
    def __init__(self):
        self.qdrant_client = None
        self.gemini_client = None
        self.openai_client = None
        self.scoring_service = ScoringService()
        self.using_scraper = True
        self.scraping_service = ScrapingService()
        self.external_api_service = ExternalAPIService() # Re-enabled for fallback
        
        if settings.qdrant_path:
            try:
                # Use local file-based storage (safest for local dev)
                self.qdrant_client = QdrantClient(path=settings.qdrant_path)
            except Exception as e:
                print(f"Local Qdrant init error: {e}")
        elif settings.qdrant_url:
            try:
                self.qdrant_client = QdrantClient(url=settings.qdrant_url)
            except Exception:
                pass
        
        # LLM Initialization
        self.model_name = "gpt-4o-mini" # Default fallback
        
        if settings.use_local_llm:
            try:
                print(f"🦙 Initializing Local LLM (Ollama) at {settings.ollama_base_url}")
                self.openai_client = openai.AsyncOpenAI(
                    base_url=settings.ollama_base_url,
                    api_key="ollama"
                )
                self.model_name = "llama3.2:3b"
                self.embedding_model_name = "nomic-embed-text"
                self.gemini_client = None # Ensure we don't use Gemini
            except Exception as e:
                print(f"Ollama initialization warning: {e}")

        # If not using local, try Gemini then OpenAI cloud
        if not self.openai_client and settings.gemini_api_key:
            try:
                from google import genai
                self.gemini_client = genai.Client(api_key=settings.gemini_api_key)
                self.gemini_client = genai.Client(api_key=settings.gemini_api_key)
                self.model_name = "gemini-2.5-flash"
                self.embedding_model_name = "models/text-embedding-004" # Gemini specific
            except Exception as e:
                print(f"Gemini initialization error: {e}")
        
        if not self.openai_client and not self.gemini_client and settings.openai_api_key:
            self.openai_client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
    
    async def refine_query(self, query: str, history: List[Dict[str, str]]) -> str:
        """
        Rewrites valid conversational query to standalone product search query using history.
        """
        if not history:
            return query
            
        context_lines = []
        for h in history[-3:]:
            role = "Asst" if h.get('role') == 'assistant' else "User"
            txt = h.get('content', '')
            # Aggressive truncation for small model attention
            if len(txt) > 150: txt = txt[:150] + "..."
            context_lines.append(f"{role}: {txt}")
        
        history_text = "\n".join(context_lines)
        
        # Compact prompt for Llama 3.2
        prompt = f"""Context:
{history_text}
Input: {query}
Task: Output a concise Amazon search query. Resolve "it" to product names. Keywords only.
Query:"""

        print(f"🔄 Refining query: '{query}' with history...")
        try:
            cleaned = query
            if self.gemini_client:
                resp = self.gemini_client.models.generate_content(
                    model=self.model_name,
                    contents=prompt
                )
                cleaned = resp.text.strip()
            elif self.openai_client:
                resp = await self.openai_client.chat.completions.create(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=60
                )
                cleaned = resp.choices[0].message.content.strip()
            
            # Post-process
            cleaned = cleaned.replace('"', '').replace("Rewritten Query:", "").strip()
            print(f"✅ Refined: '{cleaned}'")
            return cleaned
        except Exception as e:
            print(f"Refine query error: {e}")
            return query

    async def search_products(
        self,
        query: str,
        parsed_intent: ParsedIntent,
        max_results: int = 5,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Search for products (Vector DB + External API Fallback + Scoring).
        Returns raw product list and metadata.
        """
        total_found = 0
        # Try vector DB retrieval
        try:
            vector_results = await self._search_vector_db(query, parsed_intent, limit=max_results, offset=offset)
        except Exception as e:
            print(f"Vector search warning (first run?): {e}")
            vector_results = []
        
        data_source = "indexed"
        confidence_level = "high"
        disclaimer = None
        
        # Check confidence and fallback if needed
        # We fallback if:
        # 1. First page (offset=0) has few results
        # 2. Deeper page (offset>0) has fewer results than requested (meaning we ran out of indexed items)
        should_fetch_external = False
        if offset == 0:
            if not vector_results or len(vector_results) < 2:
                should_fetch_external = True
        elif len(vector_results) < max_results:
             should_fetch_external = True
             data_source = "external_api"

        if should_fetch_external:
            # Fallback to external APIs
            
            # Use LLM (Gemini or Local/OpenAI) to generate an optimized Google Shopping query
            search_query = query
            
            refinement_prompt = f"""Input: {query}
Task: Amazon search keywords. No price/filler.
Query:"""

            try:
                if self.gemini_client:
                    resp = self.gemini_client.models.generate_content(
                        model=self.model_name, # 'gemini-2.5-flash'
                        contents=refinement_prompt,
                    )
                    cleaned = resp.text.strip().replace('"', '').replace('\n', '')
                    if cleaned:
                        search_query = cleaned
                elif self.openai_client:
                    system_msg = "You are a search query optimizer. Output ONLY the refined search query string. Do not provide explanations. Do not include price. If the user demand is general (e.g. 'best headset'), do NOT invent a brand. Keep it general."
                    resp = await self.openai_client.chat.completions.create(
                        model=self.model_name, # 'llama3.2:3b' or 'gpt-4o-mini'
                        messages=[
                            {"role": "system", "content": system_msg},
                            {"role": "user", "content": refinement_prompt}
                        ],
                        max_tokens=30,
                    )
                    cleaned = resp.choices[0].message.content.strip().replace('"', '')
                    # Llama fixes
                    if cleaned.lower().startswith("search query:"):
                        cleaned = cleaned[13:].strip()
                    cleaned = cleaned.split('\n')[0].strip() # Take first line
                    
                    if cleaned:
                        search_query = cleaned
            except Exception as e:
                print(f"Query refinement failed: {e}")

            if search_query == query and parsed_intent.category:
                # Fallback to manual construction if LLM failed
                parts = []
                if parsed_intent.brand_preferences:
                    parts.extend(parsed_intent.brand_preferences)
                parts.append(parsed_intent.category)
                if parsed_intent.features:
                    parts.extend(parsed_intent.features[:2])
                
                if len(parts) > 1:
                     search_query = " ".join(parts)
            
            print(f"Refined Scraping Query (Offset {offset}): {search_query}")

            scrape_data = await self.scraping_service.search_and_scrape(
                query=search_query,
                limit=50
            )
            external_results = scrape_data.get("products", [])
            # Store total_found somewhere if needed, but RAGService returns dict.
            # I'll attach it to the results wrapper later
            self.last_scraped_count = scrape_data.get("total_found", 0) # Hacky? No instance var usage is risky if concurrent.
            # Better to pass it through.
            total_found = scrape_data.get("total_found", 0)
            
            # Fallback to SerpAPI if scraping failed
            if not external_results:
                print("⚠️ Scraping returned no results. Falling back to SerpAPI (Google Shopping)...")
                external_results = await self.external_api_service.search_products(
                    query=search_query,
                    category=parsed_intent.category,
                    budget_max=parsed_intent.budget_max,
                    offset=offset,
                )
                if external_results:
                    data_source = "external_api"
            
            # Filter by budget (if scraping worked, we still need to filter)
            if parsed_intent.budget_max and data_source == "web_scraped":
                 external_results = [p for p in external_results if p.get("price", 0) <= parsed_intent.budget_max]
            
            if external_results:
                if data_source != "external_api": # If strictly scraped
                    data_source = "web_scraped"
                    confidence_level = "medium"
                    disclaimer = "Results scraped from the web."
                
                # Index new products
                try:
                    await self._index_products(external_results)
                    print(f"Indexed {len(external_results)} new products")
                except Exception as e:
                    print(f"Indexing error: {e}")
                
                vector_results = external_results
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
        
        # Limit results (if not already limited by vector search/api limit)
        # Note: vector db has limit, but we re-sort, so we slice again to be safe
        top_products = scored_products[:max_results]

        return {
            "products": top_products,
            "total_found": total_found,
            "data_source": data_source,
            "confidence_level": confidence_level,
            "disclaimer": disclaimer,
        }

    async def get_recommendations(
        self,
        query: str,
        parsed_intent: ParsedIntent,
        max_results: int = 5,
    ) -> Dict[str, Any]:
        """
        Get product recommendations using RAG pipeline (Legacy non-streaming).
        """
        search_result = await self.search_products(query, parsed_intent, max_results)
        products = search_result["products"]
        
        # Generate LLM response
        summary, recommendations = await self._generate_response(
            query=query,
            products=products,
            intent=parsed_intent,
        )
        
        return {
            "recommendations": recommendations,
            "summary": summary,
            "data_source": search_result["data_source"],
            "confidence_level": search_result["confidence_level"],
            "confidence_score": 0.9 if search_result["data_source"] == "indexed" else 0.6,
            "disclaimer": search_result["disclaimer"],
        }
    
    async def stream_chat_response(
        self,
        query: str,
        products: List[Dict[str, Any]],
        intent: ParsedIntent,
    ):
        """Generator that streams the LLM chat response."""
        if not self.gemini_client and not self.openai_client:
            yield "I found some products for you, but I cannot generate a summary right now."
            return

        # Simplified prompt for chat-like experience
        products_context = json.dumps([
            {
                "title": p.get("title"),
                "price": p.get("price"),
                "rating": p.get("rating")
            }
            for p in products
        ], indent=2)

        prompt = f"""You are a helpful shopping assistant.
User Query: {query}
Found Products:
{products_context}

Provide a helpful, conversational response summarizing these options. 
Do NOT list every product in detail (the user sees the list).
Highlight the best value or highest rated option if clear.
Keep it concise (2-3 paragraphs max).
"""

        try:
            if self.gemini_client:
                # Stream with Gemini
                response = self.gemini_client.models.generate_content_stream(
                    model=self.model_name,
                    contents=prompt,
                )
                for chunk in response:
                    if chunk.text:
                        yield chunk.text
            else:
                # Stream with OpenAI (or Local LLM)
                stream = await self.openai_client.chat.completions.create(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}],
                    stream=True,
                )
                async for chunk in stream:
                    if chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content

        except Exception as e:
            print(f"Streaming error: {e}")
            yield "I encountered an error generating the summary, but please check out the products above!"
    
    async def _search_vector_db(
        self,
        query: str,
        intent: ParsedIntent,
        limit: int = 10,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Search vector database for similar products."""
        # Need either Gemini or OpenAI for embeddings
        ai_client = self.gemini_client or self.openai_client
        if not self.qdrant_client or not ai_client:
            return []
        
        try:
            # Generate embedding for query
            if self.gemini_client:
                # Use Gemini for embeddings - using text-embedding-004
                result = self.gemini_client.models.embed_content(
                    model='models/text-embedding-004',
                    contents=query,  # Note: 'contents' not 'content'
                )
                query_embedding = result.embeddings[0].values
            else:
                # Fallback to OpenAI
                embedding_response = await self.openai_client.embeddings.create(
                    model=getattr(self, "embedding_model_name", "text-embedding-3-small"),
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
            
            # Using query_points instead of search (for newer qdrant-client versions)
            results = self.qdrant_client.query_points(
                collection_name="products",
                query=query_embedding,
                query_filter=search_filter,
                limit=limit,
                offset=offset,
            )
            
            # Convert to product dicts
            products = []
            for result in results.points:
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
        """Generate LLM response with recommendations using Gemini or OpenAI."""
        if not self.gemini_client and not self.openai_client:
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
            
            # Try Gemini first
            if self.gemini_client:
                response = self.gemini_client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config={
                        'temperature': 0.7,
                        'response_mime_type': 'application/json',
                    }
                )
                result = json.loads(response.text)
            else:
                # Fallback to OpenAI (or Local LLM)
                response = await self.openai_client.chat.completions.create(
                    model=self.model_name,
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

    async def _index_products(self, products: List[Dict[str, Any]]):
        """Index products into Qdrant vector DB."""
        if not self.qdrant_client or not products:
            return

        points = []
        for product in products:
            # Create a rich text representation for embedding
            text_to_embed = f"{product.get('title')} {product.get('description')} {product.get('category')} Price: ${product.get('price')}"
            
            try:
                # Generate embedding
                if self.gemini_client:
                    # Use Gemini for embeddings - using text-embedding-004
                    result = self.gemini_client.models.embed_content(
                        model='models/text-embedding-004',
                        contents=text_to_embed,
                    )
                    embedding = result.embeddings[0].values
                elif self.openai_client:
                    response = await self.openai_client.embeddings.create(
                        model=getattr(self, "embedding_model_name", "text-embedding-3-small"),
                        input=text_to_embed,
                    )
                    embedding = response.data[0].embedding
                else:
                    continue

                # Prepare payload
                payload = {
                    "id": product.get("id"),
                    "title": product.get("title"),
                    "description": product.get("description"),
                    "price": product.get("price"),
                    "rating": product.get("rating"),
                    "review_count": product.get("review_count"),
                    "image_url": product.get("image_url"),
                    "affiliate_url": product.get("affiliate_url"),
                    "source": product.get("source"), # amazon_serp, etc
                    "category": product.get("category"),
                    "last_updated": datetime.utcnow().isoformat(),
                }

                # Add to points list
                import uuid
                
                # Generate a UUID from the product ID to ensure it's a valid Qdrant ID
                point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, str(product.get("id"))))

                points.append(
                    qdrant_models.PointStruct(
                        id=point_id,
                        vector=embedding,
                        payload=payload,
                    )
                )

            except Exception as e:
                print(f"Error embedding product {product.get('id')}: {e}")
                continue
        
        if points:
            try:
                # Ensure collection exists
                try:
                    self.qdrant_client.get_collection("products")
                except Exception:
                    self.qdrant_client.create_collection(
                        collection_name="products",
                        vectors_config=qdrant_models.VectorParams(
                            size=len(points[0].vector),
                            distance=qdrant_models.Distance.COSINE,
                        ),
                    )
                
                # Upsert points
                self.qdrant_client.upsert(
                    collection_name="products",
                    points=points,
                )
                print(f"Indexed {len(points)} new products")
            except Exception as e:
                print(f"Qdrant upsert error: {e}")
