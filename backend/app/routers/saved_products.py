from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.saved_product import SavedProduct
from app.schemas.saved_product import (
    SaveProductRequest,
    SavedProductResponse,
    SavedProductsListResponse,
    UpdateSavedProductRequest,
)
from app.utils.jwt import get_current_user

router = APIRouter(prefix="/saved-products", tags=["Saved Products"])


@router.get("", response_model=SavedProductsListResponse)
async def get_saved_products(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all saved products for the current user."""
    result = await db.execute(
        select(SavedProduct)
        .where(SavedProduct.user_id == current_user.id)
        .order_by(SavedProduct.saved_at.desc())
    )
    products = result.scalars().all()
    
    return SavedProductsListResponse(
        products=[SavedProductResponse.model_validate(p) for p in products],
        total=len(products)
    )


@router.post("", response_model=SavedProductResponse, status_code=status.HTTP_201_CREATED)
async def save_product(
    request: SaveProductRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a product to the user's wishlist."""
    # Check if product is already saved (by affiliate_url to avoid duplicates)
    existing = await db.execute(
        select(SavedProduct).where(
            SavedProduct.user_id == current_user.id,
            SavedProduct.affiliate_url == request.affiliate_url
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Product already saved"
        )
    
    # Create new saved product
    saved_product = SavedProduct(
        user_id=current_user.id,
        product_id=request.product_id,
        title=request.title,
        description=request.description,
        price=request.price,
        currency=request.currency,
        rating=request.rating,
        review_count=request.review_count,
        image_url=request.image_url,
        affiliate_url=request.affiliate_url,
        source=request.source,
        category=request.category,
        brand=request.brand,
        notes=request.notes,
    )
    
    db.add(saved_product)
    await db.commit()
    await db.refresh(saved_product)
    
    return SavedProductResponse.model_validate(saved_product)


@router.get("/{product_id}", response_model=SavedProductResponse)
async def get_saved_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific saved product."""
    result = await db.execute(
        select(SavedProduct).where(
            SavedProduct.id == product_id,
            SavedProduct.user_id == current_user.id
        )
    )
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved product not found"
        )
    
    return SavedProductResponse.model_validate(product)


@router.patch("/{product_id}", response_model=SavedProductResponse)
async def update_saved_product(
    product_id: str,
    request: UpdateSavedProductRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a saved product (e.g., add notes)."""
    result = await db.execute(
        select(SavedProduct).where(
            SavedProduct.id == product_id,
            SavedProduct.user_id == current_user.id
        )
    )
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved product not found"
        )
    
    # Update fields
    if request.notes is not None:
        product.notes = request.notes
    
    await db.commit()
    await db.refresh(product)
    
    return SavedProductResponse.model_validate(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a product from saved list."""
    result = await db.execute(
        select(SavedProduct).where(
            SavedProduct.id == product_id,
            SavedProduct.user_id == current_user.id
        )
    )
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved product not found"
        )
    
    await db.delete(product)
    await db.commit()
    
    return None


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def clear_saved_products(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clear all saved products for the current user."""
    await db.execute(
        delete(SavedProduct).where(SavedProduct.user_id == current_user.id)
    )
    await db.commit()
    
    return None


@router.post("/check", response_model=dict)
async def check_if_saved(
    request: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check if a product is already saved (by affiliate_url)."""
    affiliate_url = request.get("affiliate_url")
    if not affiliate_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="affiliate_url is required"
        )
    
    result = await db.execute(
        select(SavedProduct).where(
            SavedProduct.user_id == current_user.id,
            SavedProduct.affiliate_url == affiliate_url
        )
    )
    product = result.scalar_one_or_none()
    
    return {
        "is_saved": product is not None,
        "saved_product_id": product.id if product else None
    }
