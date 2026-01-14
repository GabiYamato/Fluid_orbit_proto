"""
Jina Embedding Service (Local).

Uses Jina AI's jina-embeddings-v4 model locally via transformers.
No API key required - runs entirely on your machine.
"""

from typing import List, Optional
from app.config import get_settings

settings = get_settings()

# Global model instance (lazy loaded)
_model = None
_model_loading = False


import asyncio
import concurrent.futures

def get_jina_model():
    """Lazy load the Jina model to avoid loading on every request."""
    global _model, _model_loading
    
    if _model is not None:
        return _model
    
    if _model_loading:
        # Wait for another thread to finish loading
        import time
        while _model_loading and _model is None:
            time.sleep(0.1)
        return _model
    
    _model_loading = True
    try:
        from transformers import AutoModel
        import torch
        
        print("🔄 Loading Jina Embeddings V4 model locally...")
        
        # Determine device
        if torch.cuda.is_available():
            device = "cuda"
            dtype = torch.float16
        elif torch.backends.mps.is_available():
            device = "mps"
            dtype = torch.float32  # MPS works better with float32
        else:
            device = "cpu"
            dtype = torch.float32
        
        print(f"   Using device: {device}")
        
        _model = AutoModel.from_pretrained(
            "jinaai/jina-embeddings-v4",
            trust_remote_code=True,
            torch_dtype=dtype,
        )
        
        # Move to device if not auto-handled
        if hasattr(_model, 'to'):
            _model = _model.to(device)
        
        print("✅ Jina Embeddings V4 model loaded successfully!")
        return _model
        
    except Exception as e:
        print(f"❌ Failed to load Jina model: {e}")
        print("   Falling back to hash-based embeddings")
        _model_loading = False
        return None
    finally:
        _model_loading = False


class JinaEmbeddingService:
    """Service to generate embeddings using local Jina model."""

    EMBEDDING_DIM = 1024  # jina-embeddings-v4 dimension

    def __init__(self):
        # Model is lazy-loaded on first use
        self._model = None

    @property
    def model(self):
        """Get the model, loading if necessary."""
        if self._model is None:
            self._model = get_jina_model()
        return self._model

    async def embed_text(self, text: str, task: str = "retrieval.passage") -> Optional[List[float]]:
        """
        Generate embedding for a single text.
        
        Args:
            text: Text to embed
            task: Embedding task type ('retrieval.passage' or 'retrieval.query')
            
        Returns:
            List of floats representing the embedding, or None on failure
        """
        if self.model is None:
            return self._fallback_embed(text)

        try:
            # Jina v4 supports task-specific embeddings
            embeddings = self.model.encode(
                [text],
                task=task,
                truncate_dim=self.EMBEDDING_DIM,
            )
            
            # Convert to list
            if hasattr(embeddings, 'tolist'):
                return embeddings[0].tolist()
            return list(embeddings[0])

        except Exception as e:
            print(f"Jina embedding error: {e}")
            return self._fallback_embed(text)

    async def embed_texts(
        self, texts: List[str], task: str = "retrieval.passage", batch_size: int = 32, max_retries: int = 3
    ) -> List[Optional[List[float]]]:
        """
        Generate embeddings for multiple texts (batch) with retry logic.
        
        Args:
            texts: List of texts to embed
            task: Embedding task type
            batch_size: Max texts per batch to avoid OOM
            max_retries: Number of retry attempts on failure
            
        Returns:
            List of embeddings (or None for failed items)
        """
        import asyncio
        
        if not texts:
            return []
            
        if self.model is None:
            return [self._fallback_embed(t) for t in texts]

        all_embeddings = []
        
        # Process in batches to avoid OOM
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embeddings = None
            
            # Retry loop with exponential backoff
            for attempt in range(max_retries):
                try:
                    embeddings = self.model.encode(
                        batch,
                        task=task,
                        truncate_dim=self.EMBEDDING_DIM,
                    )
                    
                    batch_embeddings = []
                    for emb in embeddings:
                        if hasattr(emb, 'tolist'):
                            batch_embeddings.append(emb.tolist())
                        else:
                            batch_embeddings.append(list(emb))
                    break  # Success, exit retry loop
                    
                except Exception as e:
                    wait_time = 2 ** attempt  # Exponential backoff: 1, 2, 4 seconds
                    print(f"Jina batch embedding error (attempt {attempt + 1}/{max_retries}): {e}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(wait_time)
                    else:
                        # Final attempt failed, use fallback for this batch
                        batch_embeddings = [self._fallback_embed(t) for t in batch]
            
            all_embeddings.extend(batch_embeddings or [self._fallback_embed(t) for t in batch])
        
        return all_embeddings

    async def embed_query(self, query: str) -> Optional[List[float]]:
        """
        Generate embedding for a search query.
        Uses 'retrieval.query' task for asymmetric search.
        
        Args:
            query: Search query text
            
        Returns:
            Query embedding
        """
        return await self.embed_text(query, task="retrieval.query")

    def _fallback_embed(self, text: str) -> List[float]:
        """
        Simple hash-based fallback embedding when model is unavailable.
        This is NOT suitable for production but allows the system to function.
        """
        import hashlib
        import math

        # Create a deterministic pseudo-embedding based on text hash
        hash_obj = hashlib.sha256(text.encode())
        hash_bytes = hash_obj.digest()

        # Expand to embedding dimension
        embedding = []
        for i in range(self.EMBEDDING_DIM):
            byte_idx = i % len(hash_bytes)
            # Normalize to [-1, 1] range
            val = (hash_bytes[byte_idx] / 127.5) - 1.0
            embedding.append(val)

        # Normalize vector
        magnitude = math.sqrt(sum(v * v for v in embedding))
        if magnitude > 0:
            embedding = [v / magnitude for v in embedding]

        return embedding

    @property
    def dimension(self) -> int:
        """Return the embedding dimension."""
        return self.EMBEDDING_DIM

    async def ensure_model_loaded(self):
        """
        Explicitly ensure the model is loaded. 
        Useful during startup to avoid lag on first request.
        """
        if _model is not None:
            return
        
        print("💡 Pre-loading Jina Embeddings model...")
        # Run the synchronous loading in a thread to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, get_jina_model)
