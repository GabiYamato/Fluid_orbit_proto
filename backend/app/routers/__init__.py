from .auth import router as auth_router
from .query import router as query_router
from .history import router as history_router
from .saved_products import router as saved_products_router
from .inventory import router as inventory_router

__all__ = ["auth_router", "query_router", "history_router", "saved_products_router", "inventory_router"]

