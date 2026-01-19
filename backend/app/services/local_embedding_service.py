"""
Local Embedding Service.

Uses sentence-transformers/all-MiniLM-L6-v2 which is:
- Fast (small model)
- Reliable (standard architecture)
- High quality for retrieval tasks
- Runs efficiently on CPU/MPS
"""

from typing import List, Optional
import logging
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Global model instance (lazy loaded)
_model = None
_model_loading = False


def get_local_model():
    """Lazy load the SentenceTransformer model."""
    global _model, _model_loading
    
    if _model is not None:
        return _model
    
    if _model_loading:
        import time
        while _model_loading and _model is None:
            time.sleep(0.1)
        return _model
    
    _model_loading = True
    try:
        from sentence_transformers import SentenceTransformer
        
        logger.info("🔄 Loading Local Embedding Model (all-MiniLM-L6-v2)...")
        
        # Load model - this will auto-download from HF if not present
        model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        
        # Move to appropriate device (SentenceTransformer handles this well usually, but we can be explicit if needed)
        # It defaults to CUDA if available, else CPU. MPS support is auto-detected in newer versions.
        
        logger.info(f"✅ Local Embedding Model loaded successfully! Device: {model.device}")
        _model = model
        return _model
        
    except Exception as e:
        logger.error(f"❌ Failed to load local embedding model: {e}")
        _model_loading = False
        return None
    finally:
        _model_loading = False


class LocalEmbeddingService:
    """Service to generate embeddings using local SentenceTransformer model."""

    EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 dimension

    def __init__(self):
        self._model = None

    @property
    def model(self):
        if self._model is None:
            self._model = get_local_model()
        return self._model

    async def embed_texts(
        self, texts: List[str], task: str = "retrieval.passage", batch_size: int = 32, max_retries: int = 3
    ) -> List[Optional[List[float]]]:
        """
        Generate embeddings for multiple texts.
        
        Args:
            texts: List of texts
            task: Task type (ignored for MiniLM but kept for API compat)
            batch_size: Batch size
            max_retries: Retries (ignored here as SentenceTransformer is stable, but kept for signature)
        """
        import asyncio
        if not texts:
            return []
            
        if self.model is None:
            return [self._fallback_embed(t) for t in texts]

        try:
            # SentenceTransformer encode returns numpy array or list of tensors
            # We want simple list of list of floats
            embeddings = self.model.encode(texts, batch_size=batch_size, convert_to_tensor=False)
            
            # Convert numpy arrays to lists
            return [e.tolist() for e in embeddings]

        except Exception as e:
            logger.error(f"Batch embedding error: {e}")
            return [self._fallback_embed(t) for t in texts]

    async def embed_query(self, query: str) -> Optional[List[float]]:
        """Generate embedding for a single query."""
        if not query:
            return None
            
        if self.model is None:
            return self._fallback_embed(query)

        try:
            # encode returns a 1D numpy array for single string
            embedding = self.model.encode(query, convert_to_tensor=False)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Query embedding error: {e}")
            return self._fallback_embed(query)

    def _fallback_embed(self, text: str) -> List[float]:
        """Deterministic fallback embedding (hash-based) for testing/failures."""
        import hashlib
        import numpy as np
        
        # Consistent seeded random based on text hash
        seed = int(hashlib.sha256(text.encode()).hexdigest(), 16) % (2**32)
        rng = np.random.default_rng(seed)
        return rng.random(self.EMBEDDING_DIM).tolist()

    async def ensure_model_loaded(self):
        """Trigger model loading."""
        get_local_model()
