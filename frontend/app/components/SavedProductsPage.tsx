'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import ProductCard from './ProductCard';
import { getSavedProducts, removeSavedProduct, SavedProduct } from '../../lib/savedProductsService';

interface SavedProductsPageProps {
    onBack?: () => void;
    onProductClick?: (product: SavedProduct) => void;
}

export default function SavedProductsPage({ onBack, onProductClick }: SavedProductsPageProps) {
    const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

    // Fetch saved products on mount
    useEffect(() => {
        fetchSavedProducts();
    }, []);

    // Clear notification after 3 seconds
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const fetchSavedProducts = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getSavedProducts();
            setSavedProducts(data.products);
        } catch (err: any) {
            setError(err.message || 'Failed to load saved products');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveProduct = async (productId: string) => {
        try {
            setDeletingIds(prev => new Set(prev).add(productId));
            await removeSavedProduct(productId);
            setSavedProducts(prev => prev.filter(p => p.id !== productId));
            setNotification('Product removed from saved');
        } catch (err: any) {
            setNotification(err.message || 'Failed to remove product');
        } finally {
            setDeletingIds(prev => {
                const updated = new Set(prev);
                updated.delete(productId);
                return updated;
            });
        }
    };

    // Format price
    const formatPrice = (price?: number) => {
        if (!price) return 'N/A';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(price);
    };

    // Format date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
            {/* Notification Toast */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg shadow-lg text-sm font-medium"
                    >
                        {notification}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-40 border-b border-gray-200 dark:border-gray-800">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {onBack && (
                                <button
                                    onClick={onBack}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            )}
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Saved Products</h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {savedProducts.length} {savedProducts.length === 1 ? 'product' : 'products'} saved
                                </p>
                            </div>
                        </div>

                        {savedProducts.length > 0 && (
                            <button
                                onClick={fetchSavedProducts}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                {loading ? (
                    // Loading skeleton
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden animate-pulse">
                                <div className="h-48 bg-gray-200 dark:bg-gray-700" />
                                <div className="p-4 space-y-3">
                                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    // Error state
                    <div className="text-center py-16">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
                        <button
                            onClick={fetchSavedProducts}
                            className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:opacity-90 transition-opacity"
                        >
                            Try Again
                        </button>
                    </div>
                ) : savedProducts.length === 0 ? (
                    // Empty state
                    <div className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No saved products yet</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                            When you find products you love, click the heart icon to save them here for later.
                        </p>
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-medium hover:opacity-90 transition-opacity"
                            >
                                Start Shopping
                            </button>
                        )}
                    </div>
                ) : (
                    // Products grid
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                        <AnimatePresence>
                            {savedProducts.map((product, index) => (
                                <motion.div
                                    key={product.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700 group"
                                >
                                    {/* Product Image */}
                                    <div className="relative h-48 bg-gray-100 dark:bg-gray-700">
                                        {product.image_url ? (
                                            <img
                                                src={product.image_url}
                                                alt={product.title}
                                                className="w-full h-full object-contain p-4"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50" y="55" font-family="sans-serif" font-size="10" text-anchor="middle" fill="%239ca3af">No Image</text></svg>';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                        )}

                                        {/* Remove button */}
                                        <button
                                            onClick={() => handleRemoveProduct(product.id)}
                                            disabled={deletingIds.has(product.id)}
                                            className={`absolute top-3 right-3 w-8 h-8 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-md transition-all ${deletingIds.has(product.id) ? 'opacity-50' : 'hover:bg-red-50 dark:hover:bg-red-900/30'
                                                }`}
                                        >
                                            {deletingIds.has(product.id) ? (
                                                <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                                </svg>
                                            )}
                                        </button>

                                        {/* Source badge */}
                                        {product.source && (
                                            <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 text-white text-xs rounded-md">
                                                {product.source}
                                            </div>
                                        )}
                                    </div>

                                    {/* Product Info */}
                                    <div className="p-4">
                                        <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2">
                                            {product.title}
                                        </h3>

                                        {product.rating && (
                                            <div className="flex items-center gap-1 mb-2">
                                                <span className="text-amber-500">★</span>
                                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                                    {product.rating.toFixed(1)}
                                                    {product.review_count && ` (${product.review_count})`}
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between">
                                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                                                {formatPrice(product.price)}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                Saved {formatDate(product.saved_at)}
                                            </p>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="mt-4 flex gap-2">
                                            <a
                                                href={product.affiliate_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 py-2 bg-black dark:bg-white text-white dark:text-black text-center text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                                            >
                                                View Product
                                            </a>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
