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
                self.model_name = "gemini-2.5-flash-lite"
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
        Enhanced query refinement for shopping context.
        Handles follow-up queries like:
        - "show me cheaper options" -> "mens jeans under $50"
        - "in blue" -> "mens blue jeans"
        - "something more formal" -> "formal mens dress pants"
        """
        if not history:
            return query
        
        # Check if this is a follow-up question that needs context
        follow_up_indicators = [
            "show me", "cheaper", "more", "less", "different", "similar",
            "in ", "with ", "but ", "instead", "other", "another", "also",
            "it", "them", "those", "these", "that", "the same", "like"
        ]
        needs_context = any(ind in query.lower() for ind in follow_up_indicators)
        
        if not needs_context and len(query.split()) >= 3:
            # Likely a standalone query
            return query
            
        # Build rich conversation context
        context_lines = []
        product_mentions = []
        
        for h in history[-4:]:  # Last 4 messages for context
            role = "Assistant" if h.get('role') == 'assistant' else "User"
            txt = h.get('content', '')
            
            # Extract product-related terms from history
            if len(txt) > 200:
                txt = txt[:200] + "..."
            context_lines.append(f"{role}: {txt}")
            
            # Look for product categories in history
            for category in ["jeans", "shirt", "dress", "shoes", "jacket", "hoodie", "sweater", "pants"]:
                if category in txt.lower():
                    product_mentions.append(category)
        
        history_text = "\n".join(context_lines)
        recent_product = product_mentions[-1] if product_mentions else ""
        
        prompt = f"""You are a shopping query rewriter. Your job is to convert follow-up questions into standalone product search queries.

Recent conversation:
{history_text}

Most recent product discussed: {recent_product if recent_product else "unknown"}

User's new message: "{query}"

TASK: Rewrite this into a standalone product search query that e-commerce sites can understand.

EXAMPLES:
- "cheaper ones" → "mens jeans under $40" (if discussing mens jeans)
- "in blue" → "blue mens jeans"
- "show me formal options" → "formal dress pants mens"
- "something similar but for summer" → "lightweight summer jeans mens"
- "any with better ratings" → "highly rated mens jeans"

Output ONLY the rewritten search query, nothing else."""

        logger.info(f"🔄 Refining query: '{query}' with context...")
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
                    max_tokens=80
                )
                cleaned = resp.choices[0].message.content.strip()
            
            # Post-process
            cleaned = cleaned.replace('"', '').replace("Rewritten Query:", "").strip()
            cleaned = cleaned.split('\n')[0]  # Take only first line
            logger.info(f"✅ Refined: '{query}' → '{cleaned}'")
            return cleaned
        except Exception as e:
            logger.warning(f"Refine query error: {e}")
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
            logger.info("📡 SCRAPING: All 3 levels running in PARALLEL...")
            
            # Use a simplified/broad query for maximum results
            scrape_data = await self.scraping_service.search_and_scrape(query, limit=150)
            scraped_products = scrape_data.get("products", [])
            total_scraped = len(scraped_products)
            logger.info(f"   → Scraped {total_scraped} products from retailers")
            
            if scraped_products:
                # STEP 3: Use KEYWORD-BASED filtering (NO Gemini call)
                # This keeps Gemini usage minimal
                logger.info("🔍 Keyword-based filtering (no LLM)...")
                filtered_products = self._filter_by_keywords(query, scraped_products, parsed_intent)
                logger.info(f"   → Kept {len(filtered_products)}/{total_scraped} relevant products")
                
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

        # Score and Sort (this also filters out products without valid links/prices)
        logger.info(f"   → Pre-scoring: {len(products)} products")
        scored_products = self.scoring_service.score_products(
            products=products,
            intent=parsed_intent,
        )
        logger.info(f"   → Post-scoring: {len(scored_products)} products (filtered out {len(products) - len(scored_products)} without price/link)")
        scored_products.sort(key=lambda x: x.get("scores", {}).get("final_score", 0), reverse=True)
        top_products = scored_products[:max_results]
        
        # Generate mini summaries for top products using LLM
        if top_products and (self.gemini_client or self.openai_client):
            try:
                top_products = await self._generate_mini_summaries(top_products, query)
            except Exception as e:
                logger.warning(f"   ⚠️ Mini summary generation failed: {e}")
        
        # Log top product details for debugging
        if top_products:
            logger.info("   📦 Top products:")
            for i, p in enumerate(top_products[:3]):
                logger.info(f"      {i+1}. {p.get('title', 'Unknown')[:50]}... | ${p.get('price', 0)} | {p.get('affiliate_url', 'NO LINK')[:50]}...")

        return {
            "products": top_products,
            "total_found": len(scored_products),  # Only count valid products
            "data_source": data_source,
            "confidence_level": "high" if data_source == "indexed" else "medium",
            "disclaimer": None if data_source == "indexed" else f"Results discovered from {data_source}."
        }
    
    async def _generate_mini_summaries(
        self,
        products: List[Dict[str, Any]],
        query: str,
    ) -> List[Dict[str, Any]]:
        """
        Use LLM to generate concise, helpful mini summaries for product descriptions.
        These replace generic or title-only descriptions with meaningful content.
        """
        if not products:
            return products
        
        # Only process products that need better descriptions
        products_needing_summary = []
        for i, p in enumerate(products):
            desc = p.get("description", "")
            title = p.get("title", "")
            # Check if description is just the title or too short
            if not desc or len(desc) < 20 or desc.lower() == title.lower() or desc.startswith(title):
                products_needing_summary.append((i, p))
        
        if not products_needing_summary:
            return products  # All products have good descriptions
        
        # Build prompt for batch summary generation
        product_list = []
        for idx, (_, p) in enumerate(products_needing_summary):
            product_list.append(f"{idx+1}. Title: {p.get('title', 'Unknown')}, Price: ${p.get('price', 0)}, Source: {p.get('source', 'Unknown')}")
        
        prompt = f"""Generate short, helpful product descriptions (1-2 sentences each) for these items found for the search "{query}".
Focus on what makes each item appealing. Be concise and informative.

Products:
{chr(10).join(product_list)}

Return a JSON array with the format:
[{{"index": 1, "summary": "Your concise description here"}}, ...]

Only return the JSON array, nothing else."""

        try:
            response_text = ""
            if self.gemini_client:
                resp = self.gemini_client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config={
                        'temperature': 0.7,
                        'response_mime_type': 'application/json',
                    }
                )
                response_text = resp.text.strip()
            elif self.openai_client:
                resp = await self.openai_client.chat.completions.create(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    max_tokens=500,
                )
                response_text = resp.choices[0].message.content.strip()
            
            if response_text:
                # Parse JSON response
                summaries = json.loads(response_text)
                if isinstance(summaries, dict):
                    summaries = summaries.get("summaries", summaries.get("items", []))
                
                # Apply summaries to products
                for summary_item in summaries:
                    idx = summary_item.get("index", 0) - 1
                    new_desc = summary_item.get("summary", "")
                    if 0 <= idx < len(products_needing_summary) and new_desc:
                        original_idx = products_needing_summary[idx][0]
                        products[original_idx]["description"] = new_desc[:200]
                
                logger.info(f"   ✨ Generated {len(summaries)} mini summaries")
        
        except Exception as e:
            logger.warning(f"   Mini summary parsing error: {e}")
        
        return products
    
    def _filter_by_keywords(
        self,
        query: str,
        products: List[Dict[str, Any]],
        intent: ParsedIntent,
    ) -> List[Dict[str, Any]]:
        """
        Fast keyword-based filtering WITHOUT LLM calls.
        Uses pattern matching to filter out irrelevant products.
        """
        if not products:
            return []
        
        query_lower = query.lower()
        
        # Extract key terms from query
        query_words = set(re.findall(r'\b[a-z]{3,}\b', query_lower))
        
        # Category synonyms for better matching
        category_synonyms = {
            "jeans": ["jeans", "denim", "jean", "pants", "trousers"],
            "shirt": ["shirt", "tee", "top", "blouse", "polo", "button"],
            "t-shirt": ["t-shirt", "tshirt", "tee", "t shirt"],
            "dress": ["dress", "gown", "frock", "maxi", "midi", "mini"],
            "shoes": ["shoes", "sneakers", "boots", "heels", "sandals", "footwear"],
            "jacket": ["jacket", "coat", "blazer", "outerwear", "parka"],
            "hoodie": ["hoodie", "hoody", "sweatshirt", "pullover"],
            "sweater": ["sweater", "jumper", "cardigan", "knitwear"],
            "shorts": ["shorts", "short"],
            "skirt": ["skirt"],
            "pants": ["pants", "trousers", "chinos", "slacks"],
            "bag": ["bag", "purse", "handbag", "tote", "backpack"],
            "watch": ["watch", "watches", "timepiece"],
        }
        
        # Find which category we're looking for
        target_keywords = set()
        for category, synonyms in category_synonyms.items():
            if any(syn in query_lower for syn in synonyms):
                target_keywords.update(synonyms)
        
        # Add category from parsed intent
        if intent.category:
            cat_lower = intent.category.lower()
            target_keywords.add(cat_lower)
            if cat_lower in category_synonyms:
                target_keywords.update(category_synonyms[cat_lower])
        
        # If no specific category detected, use query words directly
        if not target_keywords:
            target_keywords = query_words
        
        # Gender filtering
        gender_terms = {
            "men": ["men", "mens", "men's", "male", "man", "boy", "boys"],
            "women": ["women", "womens", "women's", "female", "woman", "girl", "girls", "ladies"],
            "kids": ["kids", "kid", "children", "child", "baby", "toddler"],
        }
        
        target_gender = None
        for gender, terms in gender_terms.items():
            if any(term in query_lower for term in terms):
                target_gender = gender
                break
        
        # Filter products
        filtered = []
        for p in products:
            title_lower = p.get('title', '').lower()
            desc_lower = p.get('description', '').lower()
            combined = f"{title_lower} {desc_lower}"
            
            # Check if title matches any target keyword
            matches_category = any(kw in combined for kw in target_keywords) if target_keywords else True
            
            # Check gender match (if specified)
            matches_gender = True
            if target_gender:
                # Check if product matches OR is unisex
                product_genders = []
                for gender, terms in gender_terms.items():
                    if any(term in combined for term in terms):
                        product_genders.append(gender)
                
                if product_genders:
                    matches_gender = target_gender in product_genders
            
            # Exclude obvious non-matches (accessories when looking for clothing)
            is_accessory = any(acc in title_lower for acc in [
                "sunglasses", "glasses", "belt", "wallet", "jewelry", "earring",
                "necklace", "bracelet", "ring", "hat", "cap", "scarf", "gloves",
                "socks", "tie", "bow tie", "cufflinks"
            ])
            
            # Only exclude accessories if we're NOT looking for accessories
            if is_accessory and not any(acc in query_lower for acc in ["accessories", "sunglasses", "jewelry", "belt", "wallet"]):
                continue
            
            if matches_category and matches_gender:
                filtered.append(p)
        
        # If filtering was too aggressive, return top products
        if len(filtered) < 5 and len(products) > 5:
            logger.debug("Keyword filter too aggressive, loosening criteria")
            return products[:30]
        
        return filtered

    async def _filter_with_llm(
        self,
        query: str,
        products: List[Dict[str, Any]],
        intent: ParsedIntent,
    ) -> List[Dict[str, Any]]:
        """
        OPTIONAL: Use Gemini/LLM to filter out products that don't match the query.
        Only use this if keyword filtering isn't sufficient.
        """
        if not products:
            return []
        
        # Limit to first 30 products for LLM processing
        products_to_check = products[:30]
        
        # Build product list for LLM
        product_list = []
        for i, p in enumerate(products_to_check):
            product_list.append(f"{i+1}. {p.get('title', 'Unknown')}")
        
        prompt = f"""Filter products by relevance to: "{query}"

Products:
{chr(10).join(product_list)}

RULES:
- Keep products that match the item type (e.g., "jeans" query → keep jeans/denim, reject shirts/accessories)
- Consider category hint: {intent.category or 'any'}
- Consider features: {', '.join(intent.features) if intent.features else 'any'}

Return ONLY the numbers of RELEVANT products as comma-separated list.
Example: 1,3,5,7,12
If none match: NONE"""

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
        """Generator that streams an enhanced LLM chat response."""
        if not self.gemini_client and not self.openai_client:
            yield "I found some products for you, but I cannot generate a summary right now."
            return

        # Build rich product context for better recommendations
        products_context = []
        for i, p in enumerate(products[:5]):  # Focus on top 5
            ctx = {
                "rank": i + 1,
                "title": p.get("title", "Unknown")[:60],
                "price": f"${p.get('price', 0):.2f}",
                "source": p.get("source", "Unknown"),
                "rating": f"{p.get('rating', 'N/A')}/5" if p.get('rating') else "No rating",
                "reviews": f"{p.get('review_count', 0):,}" if p.get('review_count') else "0",
                "has_image": bool(p.get("image_url") and "placehold" not in p.get("image_url", "")),
            }
            products_context.append(ctx)
        
        # Calculate price range for context
        prices = [p.get("price", 0) for p in products if p.get("price")]
        price_context = ""
        if prices:
            price_context = f"Price range: ${min(prices):.0f} - ${max(prices):.0f}"
        
        # Build intent context
        intent_context = []
        if intent.category:
            intent_context.append(f"Category: {intent.category}")
        if intent.budget_max:
            intent_context.append(f"Budget: up to ${intent.budget_max}")
        for feature in (intent.features or [])[:3]:
            intent_context.append(f"Preference: {feature}")

        prompt = f"""You are a friendly, knowledgeable fashion shopping assistant. The user asked: "{query}"

User preferences:
{chr(10).join(intent_context) if intent_context else "No specific preferences mentioned"}

I found {len(products)} products. Here are the top picks:
{json.dumps(products_context, indent=2)}

{price_context}

Write a helpful, conversational response (3-4 sentences):
1. Start with excitement about what you found
2. Highlight the #1 pick and WHY it's great (price, rating, or brand)
3. If there's a great value option (good rating + lower price), mention it
4. End with an engaging question or suggestion

RULES:
- Be warm and conversational, like a helpful friend
- Use specific prices and brand names from the data
- Don't just list products - give personalized insight
- Keep it concise - user can see the products already
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
            yield "I found some great options for you! Check out the products below - I've sorted them by quality and value."
    
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
