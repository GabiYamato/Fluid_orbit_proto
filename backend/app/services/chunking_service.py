"""
Semantic Chunking Service.

This service takes raw product data and chunks it into semantic categories:
- Pros (advantages, strengths)
- Cons (disadvantages, weaknesses)
- Specs (technical specifications)
- Use Cases (ideal users, scenarios)

Uses LLM to generate these chunks from product information.
"""

import json
from typing import List, Dict, Any, Optional

from app.config import get_settings

settings = get_settings()


class ChunkingService:
    """Service to semantically chunk product information using LLM."""

    def __init__(self):
        self.gemini_client = None
        self.openai_client = None
        self.model_name = "gemini-2.5-flash"

        # Initialize LLM client
        if settings.gemini_api_key:
            try:
                from google import genai
                self.gemini_client = genai.Client(api_key=settings.gemini_api_key)
            except Exception as e:
                print(f"Gemini initialization error in ChunkingService: {e}")

        if not self.gemini_client and settings.openai_api_key:
            import openai
            self.openai_client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
            self.model_name = "gpt-4o-mini"

    async def chunk_product(self, product: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Chunk a single product into semantic chunks.
        
        Args:
            product: Raw product data with title, description, price, etc.
            
        Returns:
            List of chunk dictionaries, each containing:
            - chunk_type: 'pros', 'cons', 'specs', 'use_cases', 'summary'
            - content: The chunk text
            - product_id: Reference to parent product
        """
        if not self.gemini_client and not self.openai_client:
            # Fallback: create basic chunks without LLM
            return self._create_basic_chunks(product)

        prompt = self._build_chunking_prompt(product)
        
        try:
            if self.gemini_client:
                response = self.gemini_client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config={
                        'temperature': 0.3,
                        'response_mime_type': 'application/json',
                    }
                )
                result = json.loads(response.text)
            else:
                import openai
                response = await self.openai_client.chat.completions.create(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.3,
                )
                result = json.loads(response.choices[0].message.content)

            return self._parse_llm_chunks(result, product)

        except Exception as e:
            print(f"Chunking error for product {product.get('title')}: {e}")
            return self._create_basic_chunks(product)

    def _build_chunking_prompt(self, product: Dict[str, Any]) -> str:
        """Build the LLM prompt for semantic chunking."""
        title = product.get("title", "Unknown Product")
        description = product.get("description", "")
        price = product.get("price", 0)
        rating = product.get("rating", 0)
        review_count = product.get("review_count", 0)
        source = product.get("source", "unknown")

        return f"""Analyze this product and extract semantic information.

Product: {title}
Description: {description}
Price: ${price}
Rating: {rating}/5 ({review_count} reviews)
Source: {source}

Generate a JSON response with these keys:
{{
    "pros": ["list of 2-4 advantages/strengths based on the product info"],
    "cons": ["list of 1-3 potential disadvantages or limitations"],
    "specs": ["list of 2-4 key technical specifications extracted or inferred"],
    "use_cases": ["list of 2-3 ideal user profiles or scenarios"],
    "summary": "A 1-2 sentence summary of this product"
}}

Be concise but informative. If information is missing, make reasonable inferences based on product category and price point. Do not hallucinate specific numbers or features not implied by the data."""

    def _parse_llm_chunks(
        self, llm_result: Dict[str, Any], product: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Parse LLM response into chunk objects, ensuring product name is in every chunk."""
        product_id = product.get("id", "unknown")
        product_title = product.get("title", "Unknown Product")
        product_price = product.get("price", 0)
        product_source = product.get("source", "unknown")
        chunks = []

        chunk_types = ["pros", "cons", "specs", "use_cases", "summary"]
        
        for chunk_type in chunk_types:
            content = llm_result.get(chunk_type, [])
            
            if isinstance(content, list):
                content_text = " | ".join(content) if content else ""
            else:
                content_text = str(content)

            if content_text:
                # Prepend product name to content for self-contained chunks
                full_content = f"[{product_title}] {content_text}"
                
                chunks.append({
                    "chunk_type": chunk_type,
                    "content": full_content,
                    "product_id": product_id,
                    "product_title": product_title,
                    "product_price": product_price,
                    "source": product_source,
                })

        return chunks

    def _create_basic_chunks(self, product: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Create basic chunks without LLM (fallback), ensuring product name in every chunk."""
        product_id = product.get("id", "unknown")
        title = product.get("title", "Unknown Product")
        description = product.get("description", "")
        price = product.get("price", 0)
        rating = product.get("rating", 0)
        source = product.get("source", "unknown")

        chunks = []

        # Summary chunk - includes product name
        summary_content = f"[{title}] Price: ${price}. Rating: {rating}/5."
        if description:
            summary_content += f" {description[:200]}"
        
        chunks.append({
            "chunk_type": "summary",
            "content": summary_content,
            "product_id": product_id,
            "product_title": title,
            "product_price": price,
            "source": source,
        })

        # Basic pros/cons based on rating - also includes product name
        if rating >= 4.0:
            chunks.append({
                "chunk_type": "pros",
                "content": f"[{title}] Highly rated product ({rating}/5 stars) | Good customer satisfaction",
                "product_id": product_id,
                "product_title": title,
                "product_price": price,
                "source": source,
            })
        elif rating < 3.5 and rating > 0:
            chunks.append({
                "chunk_type": "cons",
                "content": f"[{title}] Mixed reviews ({rating}/5 stars) | Consider alternatives",
                "product_id": product_id,
                "product_title": title,
                "product_price": price,
                "source": source,
            })

        return chunks

    async def chunk_products_batch(
        self, products: List[Dict[str, Any]], max_concurrent: int = 5
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Chunk multiple products, returning a mapping of product_id -> chunks.
        
        Args:
            products: List of product dictionaries
            max_concurrent: Max concurrent LLM calls
            
        Returns:
            Dict mapping product_id to list of chunks
        """
        import asyncio

        results = {}
        semaphore = asyncio.Semaphore(max_concurrent)

        async def chunk_with_semaphore(product):
            async with semaphore:
                chunks = await self.chunk_product(product)
                return product.get("id", "unknown"), chunks

        tasks = [chunk_with_semaphore(p) for p in products]
        completed = await asyncio.gather(*tasks, return_exceptions=True)

        for result in completed:
            if isinstance(result, Exception):
                print(f"Batch chunking error: {result}")
                continue
            product_id, chunks = result
            results[product_id] = chunks

        return results
