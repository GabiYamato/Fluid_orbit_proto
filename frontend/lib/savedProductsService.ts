/**
 * Saved Products Service
 * Handles API calls for saved/wishlisted products
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface SavedProduct {
    id: string;
    user_id: string;
    product_id?: string;
    title: string;
    description?: string;
    price?: number;
    currency: string;
    rating?: number;
    review_count?: number;
    image_url?: string;
    affiliate_url: string;
    source?: string;
    category?: string;
    brand?: string;
    notes?: string;
    saved_at: string;
    updated_at: string;
}

export interface SaveProductRequest {
    product_id?: string;
    title: string;
    description?: string;
    price?: number;
    currency?: string;
    rating?: number;
    review_count?: number;
    image_url?: string;
    affiliate_url: string;
    source?: string;
    category?: string;
    brand?: string;
    notes?: string;
}

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

/**
 * Get all saved products for the current user
 */
export async function getSavedProducts(): Promise<{ products: SavedProduct[]; total: number }> {
    const response = await fetch(`${API_URL}/saved-products`, {
        method: 'GET',
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Please log in to view saved products');
        }
        throw new Error('Failed to fetch saved products');
    }

    return response.json();
}

/**
 * Save a product to the user's wishlist
 */
export async function saveProduct(product: SaveProductRequest): Promise<SavedProduct> {
    const response = await fetch(`${API_URL}/saved-products`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(product),
    });

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Please log in to save products');
        }
        if (response.status === 409) {
            // Product already saved - fetch and return the existing one instead of throwing
            const checkResponse = await fetch(`${API_URL}/saved-products/check`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ affiliate_url: product.affiliate_url }),
            });
            if (checkResponse.ok) {
                const data = await checkResponse.json();
                if (data.saved_product_id) {
                    // Return a mock SavedProduct with the ID so the UI can track it
                    return {
                        id: data.saved_product_id,
                        user_id: '',
                        title: product.title,
                        affiliate_url: product.affiliate_url,
                        currency: product.currency || 'USD',
                        saved_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    } as SavedProduct;
                }
            }
            throw new Error('Product already saved');
        }
        throw new Error('Failed to save product');
    }

    return response.json();
}

/**
 * Remove a product from saved list
 */
export async function removeSavedProduct(productId: string): Promise<void> {
    const response = await fetch(`${API_URL}/saved-products/${productId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Please log in to remove saved products');
        }
        if (response.status === 404) {
            throw new Error('Product not found');
        }
        throw new Error('Failed to remove product');
    }
}

/**
 * Check if a product is already saved
 */
export async function checkIfSaved(affiliateUrl: string): Promise<{ is_saved: boolean; saved_product_id?: string }> {
    const response = await fetch(`${API_URL}/saved-products/check`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ affiliate_url: affiliateUrl }),
    });

    if (!response.ok) {
        if (response.status === 401) {
            return { is_saved: false };
        }
        throw new Error('Failed to check saved status');
    }

    return response.json();
}

/**
 * Update a saved product (e.g., add notes)
 */
export async function updateSavedProduct(productId: string, notes: string): Promise<SavedProduct> {
    const response = await fetch(`${API_URL}/saved-products/${productId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ notes }),
    });

    if (!response.ok) {
        throw new Error('Failed to update product');
    }

    return response.json();
}

/**
 * Clear all saved products
 */
export async function clearAllSavedProducts(): Promise<void> {
    const response = await fetch(`${API_URL}/saved-products`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error('Failed to clear saved products');
    }
}
