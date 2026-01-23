from typing import List, Dict, Any, Optional
from datetime import datetime
from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
import openai
import json
import logging
import asyncio
import re

from app.config import get_settings
from app.schemas.query import ParsedIntent
from app.services.scoring_service import ScoringService
from app.services.scraping_service import ScrapingService
from app.services.external_api_service import ExternalAPIService
from app.services.local_embedding_service import LocalEmbeddingService
from app.services.chunking_service import ChunkingService

settings = get_settings()

# Configure RAG logger
logger = logging.getLogger("rag_service")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        "%(asctime)s | %(levelname)-8s | RAG | %(message)s",
        datefmt="%H:%M:%S"
    ))
    logger.addHandler(handler)

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
        self.jina_embedder = LocalEmbeddingService()  # Local embeddings (SentenceTransformer)
        self.chunking_service = ChunkingService()  # Semantic chunking
        
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
        
        # LLM Initialization - PRIORITIZE GEMINI over local LLM
        self.model_name = "gpt-4o-mini" # Default fallback
        
        # Try Gemini FIRST (preferred for quality)
        if settings.gemini_api_key:
            try:
                from google import genai
                self.gemini_client = genai.Client(api_key=settings.gemini_api_key)
                self.model_name = "gemini-2.0-flash"
                self.embedding_model_name = "models/text-embedding-004"
                print(f"✨ Using Gemini ({self.model_name}) for all responses")
            except Exception as e:
                print(f"Gemini initialization error: {e}")
        
        # Only use local LLM if Gemini is not available
        if not self.gemini_client and settings.use_local_llm:
            try:
                print(f"🦙 Falling back to Local LLM (Ollama) at {settings.ollama_base_url}")
                self.openai_client = openai.AsyncOpenAI(
                    base_url=settings.ollama_base_url,
                    api_key="ollama"
                )
                self.model_name = "llama3.2:3b"
                self.embedding_model_name = "nomic-embed-text"
            except Exception as e:
                print(f"Ollama initialization warning: {e}")
        
        # Final fallback to OpenAI cloud
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
        Search for products with improved pipeline:
        1. Check Vector DB first (only use if >3 relevant results)
        2. Scrape retailers in parallel if needed
        3. Use Gemini to filter irrelevant products immediately
        4. Index to Vector DB in background
        """
        logger.info("=" * 50)
        logger.info(f"🔍 SEARCH REQUEST")
        logger.info(f"   Query: '{query}'")
        logger.info(f"   Category: {parsed_intent.category}")
        logger.info(f"   Budget: ${parsed_intent.budget_min or 0} - ${parsed_intent.budget_max or '∞'}")
        logger.info(f"   Features: {parsed_intent.features}")
        logger.info(f"   Offset: {offset}, Max: {max_results}")
        
        products = []
        data_source = "scraped"
        
        # STEP 1: Check Vector DB first (only use if we have >3 good results)
        vector_results = []
        try:
            vector_results = await self._search_vector_db(query, parsed_intent, limit=max_results + 5, offset=offset)
            logger.info(f"   → Vector DB found {len(vector_results)} results")
        except Exception as e:
            logger.warning(f"   → Vector search error: {e}")
        
        # Only use vector results if we have enough (>3 quality matches)
        if len(vector_results) > 3:
            logger.info("   ✅ Using cached vector results")
            products = vector_results
            data_source = "indexed"
        else:
            # STEP 2: Scrape ALL retailers in parallel - get 100+ products
            logger.info("📡 SCRAPING: Scraping ALL retailers simultaneously for 100+ products...")
            
            # Use a simplified/broad query for maximum results
            scrape_data = await self.scraping_service.search_and_scrape(query, limit=150)
            scraped_products = scrape_data.get("products", [])
            total_scraped = len(scraped_products)
            logger.info(f"   → Scraped {total_scraped} products from retailers")
            
            if scraped_products:
                # STEP 3: Use Gemini to filter irrelevant products IMMEDIATELY
                # This fixes the "jeans → sunglasses" problem
                logger.info("🤖 Using Gemini to filter relevant products...")
                filtered_products = await self._filter_with_llm(query, scraped_products, parsed_intent)
                logger.info(f"   → Gemini kept {len(filtered_products)}/{total_scraped} relevant products")
                
                products = filtered_products
                data_source = scrape_data.get("source", "retailers")
                
                # STEP 4: Index to Vector DB in BACKGROUND (don't wait)
                if filtered_products:
                    asyncio.create_task(self._background_index(filtered_products))
                    logger.info("   → Background indexing started")
            
            # Merge with any vector results we had
            if vector_results:
                products = products + vector_results

        # Final fallback to Demo data if literally nothing found
        if not products:
            logger.warning("⚠️ No products found anywhere. Showing demo data.")
            products = self._get_demo_products(parsed_intent)
            data_source = "demo"

        # Score and Sort (this also filters out products without links)
        scored_products = self.scoring_service.score_products(
            products=products,
            intent=parsed_intent,
        )
        scored_products.sort(key=lambda x: x.get("scores", {}).get("final_score", 0), reverse=True)
        top_products = scored_products[:max_results]

        return {
            "products": top_products,
            "total_found": len(products),
            "data_source": data_source,
            "confidence_level": "high" if data_source == "indexed" else "medium",
            "disclaimer": None if data_source == "indexed" else f"Results discovered from {data_source}."
        }
    
    async def _filter_with_llm(
        self,
        query: str,
        products: List[Dict[str, Any]],
        intent: ParsedIntent,
    ) -> List[Dict[str, Any]]:
        """
        Use Gemini/LLM to filter out products that don't match the query.
        This prevents showing sunglasses when user searched for jeans.
        """
        if not products:
            return []
        
        # Limit to first 30 products for LLM processing
        products_to_check = products[:30]
        
        # Build product list for LLM
        product_list = []
        for i, p in enumerate(products_to_check):
            product_list.append(f"{i+1}. {p.get('title', 'Unknown')}")
        
        prompt = f"""You are a product relevancy filter. The user searched for: "{query}"
Category hint: {intent.category or 'not specified'}
Features: {', '.join(intent.features) if intent.features else 'none'}

Here are the product titles found:
{chr(10).join(product_list)}

Return ONLY the numbers of products that are RELEVANT to the search query "{query}".
A product is relevant if it's the same type of item the user is looking for.
For example, if searching "jeans", keep jeans/denim pants, but NOT sunglasses, shirts, or accessories.

Return the numbers as a comma-separated list, e.g.: 1,3,5,7,12
If none are relevant, return: NONE"""

        try:
            relevant_indices = set()
            
            if self.gemini_client:
                resp = self.gemini_client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                )
                response_text = resp.text.strip()
            elif self.openai_client:
                resp = await self.openai_client.chat.completions.create(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=200,
                )
                response_text = resp.choices[0].message.content.strip()
            else:
                # No LLM available, return all products
                return products
            
            logger.info(f"   LLM filter response: {response_text[:100]}...")
            
            if "NONE" in response_text.upper():
                return []
            
            # Parse the response - extract numbers
            numbers = re.findall(r'\d+', response_text)
            for num_str in numbers:
                try:
                    idx = int(num_str) - 1  # Convert to 0-indexed
                    if 0 <= idx < len(products_to_check):
                        relevant_indices.add(idx)
                except ValueError:
                    continue
            
            # Return filtered products
            filtered = [products_to_check[i] for i in sorted(relevant_indices)]
            
            # Also include remaining products that weren't checked (if any)
            if len(products) > 30:
                # Add remaining products at lower priority (they weren't LLM-checked)
                filtered.extend(products[30:])
            
            return filtered if filtered else products[:10]  # Fallback to first 10 if filter failed
            
        except Exception as e:
            logger.error(f"LLM filtering error: {e}")
            return products  # On error, return all products
    
    async def _background_index(self, products: List[Dict[str, Any]]):
        """Index products to vector DB in background (fire and forget)."""
        try:
            await self._index_products(products)
            logger.info(f"💾 Background indexed {len(products)} products to vector DB")
        except Exception as e:
            logger.error(f"❌ Background indexing error: {e}")

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
Keep it extremely concise (2-3 lines max).
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
        """Search vector database for similar products using Jina embeddings."""
        if not self.qdrant_client:
            return []
        
        try:
            # Generate embedding for query using Local Model
            query_embedding = await self.jina_embedder.embed_query(query)
            if query_embedding is None:
                logger.warning("Failed to generate query embedding")
                return []
            
            logger.info(f"   Generated query embedding (dim={len(query_embedding)})")
            
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
1. A brief 2-3 line summary explaining your recommendations
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
        """Index products into Qdrant vector DB using Local embeddings."""
        if not self.qdrant_client or not products:
            return

        import uuid
        
        # Prepare texts
        texts_to_embed = []
        valid_products = []
        
        for product in products:
            text = f"{product.get('title', '')} {product.get('description', '')} {product.get('category', '')} Price: ${product.get('price', 0)}"
            texts_to_embed.append(text)
            valid_products.append(product)
        
        if not texts_to_embed:
            return
        
        # Batch embed using Local Model
        # Notice: jina_embedder was renamed to local_embedder in __init__ but we kept same property name "jina_embedder" 
        # for minimal diff, BUT I will rename it in __init__ properly first.
        # Let's assume I renamed 'self.jina_embedder' to 'self.jina_embedder' in __init__.
        # Wait, I need to do that replacement first/simultaneously.
        # Ideally I update the import and init first.
        
        logger.info(f"   Embedding {len(texts_to_embed)} products with Local Model...")
        embeddings = await self.jina_embedder.embed_texts(texts_to_embed)
        
        points = []
        for product, embedding in zip(valid_products, embeddings):
            if embedding is None:
                continue
            
            payload = {
                "id": product.get("id"),
                "title": product.get("title"),
                "description": product.get("description"),
                "price": product.get("price"),
                "rating": product.get("rating"),
                "review_count": product.get("review_count"),
                "image_url": product.get("image_url"),
                "affiliate_url": product.get("affiliate_url"),
                "source": product.get("source"),
                "category": product.get("category"),
                "last_updated": datetime.utcnow().isoformat(),
            }

            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, str(product.get("id"))))

            points.append(
                qdrant_models.PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload=payload,
                )
            )
        
        if points:
            try:
                # Check/Create collection with correct dimension
                current_dim = len(points[0].vector) # Should be 384
                collection_name = "products"
                
                try:
                    coll_info = self.qdrant_client.get_collection(collection_name)
                    # Check if dimension matches
                    if coll_info.config.params.vectors.size != current_dim:
                        logger.warning(f"⚠️ Collection dim mismatch (Expected {current_dim}, Found {coll_info.config.params.vectors.size}). Recreating...")
                        self.qdrant_client.delete_collection(collection_name)
                        raise Exception("Collection deleted due to mismatch") # Trigger recreation
                        
                except Exception:
                    logger.info(f"   Creating 'products' collection with dim={current_dim}")
                    self.qdrant_client.create_collection(
                        collection_name=collection_name,
                        vectors_config=qdrant_models.VectorParams(
                            size=current_dim,
                            distance=qdrant_models.Distance.COSINE,
                        ),
                    )
                
                # Upsert points
                self.qdrant_client.upsert(
                    collection_name=collection_name,
                    points=points,
                )
                logger.info(f"   ✅ Indexed {len(points)} new products to Qdrant")
            except Exception as e:
                logger.error(f"   ❌ Qdrant upsert error: {e}")
