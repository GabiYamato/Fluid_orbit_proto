'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface Product {
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  price: number;
  rating?: number;
  review_count?: number;
  image_url?: string;
  image?: string;
  affiliate_url?: string;
  link?: string;
  url?: string;
  source?: string;
  scores?: {
    final_score?: number;
    price_score?: number;
    rating_score?: number;
  };
}

interface ProductCardProps {
  product?: Product;
  // Legacy props for backward compatibility
  name?: string;
  description?: string;
  price?: number;
  rating?: number;
  image?: string;
  size?: 'large' | 'small';
  delay?: number;
  index?: number;
  // Save functionality
  onSave?: (product: Product) => void;
  onUnsave?: (productId: string) => void;
  isSaved?: boolean;
  savedProductId?: string;
  onOpenModal?: (product: Product) => void;
}

// Skeleton loader for product cards
export function ProductCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden animate-pulse border border-gray-100 dark:border-gray-700 flex flex-row h-28 w-full">
      {/* Image skeleton */}
      <div className="w-28 h-full bg-gray-200 dark:bg-gray-700 shrink-0" />

      {/* Content skeleton */}
      <div className="flex-1 p-3 flex flex-col justify-between">
        <div className="space-y-2">
          {/* Title and Rating */}
          <div className="flex justify-between gap-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-8" />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
          </div>
        </div>

        {/* Footer: Price and Button */}
        <div className="flex items-end justify-between">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
        </div>
      </div>
    </div>
  );
}

export default function ProductCard({
  product,
  name,
  description,
  price,
  rating,
  image,
  size = 'small',
  delay = 0,
  index = 0,
  onSave,
  onUnsave,
  isSaved = false,
  savedProductId,
  onOpenModal,
}: ProductCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [localSaved, setLocalSaved] = useState(isSaved);
  const [saving, setSaving] = useState(false);

  // Handle save/unsave
  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saving) return;

    setSaving(true);
    try {
      if (localSaved && onUnsave && savedProductId) {
        await onUnsave(savedProductId);
        setLocalSaved(false);
      } else if (!localSaved && onSave && productData) {
        await onSave(productData as Product);
        setLocalSaved(true);
      }
    } catch (error) {
      console.error('Save/unsave error:', error);
    } finally {
      setSaving(false);
    }
  };

  // Normalize product data (handle both new and legacy props)
  const productData = product || {
    title: name,
    description,
    price: price || 0,
    rating,
    image_url: image,
  };

  const displayTitle = productData.title || productData.name || 'Unknown Product';
  const displayDescription = productData.description || 'No description available for this product.';
  const displayPrice = productData.price || 0;
  const displayRating = productData.rating || 0;
  const displayImage = productData.image_url || productData.image || '';
  const finalScore = productData.scores?.final_score;
  const displaySource = productData.source || '';

  // Robust URL extraction with validation
  const rawUrl = productData.affiliate_url || productData.link || productData.url || '';
  const displayUrl = (() => {
    if (!rawUrl) return '';
    // If it's already a full URL
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return rawUrl;
    }
    // If it looks like a relative path, try to construct absolute URL
    if (rawUrl.startsWith('/')) {
      // Try to use source domain if available
      const source = displaySource.toLowerCase();
      // Common domain mappings
      const domainMap: Record<string, string> = {
        'amazon': 'www.amazon.com',
        'google_shopping': 'shopping.google.com',
        'express': 'www.express.com',
        'asos': 'www.asos.com',
        'nordstrom': 'www.nordstrom.com',
        'macys': 'www.macys.com',
        'h&m': 'www.hm.com',
      };
      const domain = Object.entries(domainMap).find(([key]) => source.includes(key))?.[1];
      if (domain) {
        return `https://${domain}${rawUrl}`;
      }
    }
    // Return as-is if we can't fix it (will be caught by validation in handleClick)
    return rawUrl;
  })();

  const hasValidUrl = displayUrl.startsWith('http://') || displayUrl.startsWith('https://');

  const handleClick = () => {
    if (onOpenModal) {
      onOpenModal(productData as Product);
    } else if (hasValidUrl) {
      window.open(displayUrl, '_blank', 'noopener,noreferrer');
    } else {
      console.warn('[ProductCard] No valid URL for product:', displayTitle, 'Raw URL:', rawUrl);
    }
  };

  // Format price
  const formatPrice = (p: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(p);
  };

  // Large variant (Featured horizontal card - compact)
  if (size === 'large') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: (delay || index * 0.03) }}
        whileHover={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
        className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-row h-32 group cursor-pointer"
        onClick={handleClick}
      >
        {/* Image Section with carousel controls */}
        <div className="relative w-32 h-full bg-gray-50 dark:bg-gray-700/50 shrink-0 flex items-center justify-center">
          {displayImage ? (
            <img
              src={displayImage}
              alt={displayTitle}
              className="w-full h-full object-contain p-2"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50" y="55" font-family="sans-serif" font-size="10" text-anchor="middle" fill="%239ca3af">No Image</text></svg>';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}



          {/* Save button */}
          {(onSave || onUnsave) && (
            <button
              onClick={handleSaveClick}
              disabled={saving}
              className={`absolute top-1 right-1 w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-sm ${localSaved
                ? 'bg-orange-500 text-white'
                : 'bg-white/90 dark:bg-gray-800/90 text-gray-400 hover:text-orange-500 opacity-0 group-hover:opacity-100'
                } ${saving ? 'animate-pulse' : ''}`}
              title={localSaved ? 'Remove from saved' : 'Save for later'}
            >
              <svg
                className="w-4 h-4"
                fill={localSaved ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          )}
        </div>

        {/* Content Section */}
        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
            {/* Marketplace and Title */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{displaySource || 'Marketplace'}</span>
              </div>
              <div className="flex items-start gap-2">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1 leading-tight flex-1">
                  {displayTitle}
                </h3>
                {displayRating > 0 && (
                  <div className="flex items-center gap-0.5 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-700 dark:text-amber-400 shrink-0">
                    <span>{displayRating.toFixed(1)}</span>
                    <span>★</span>
                    {productData.review_count !== undefined && (
                      <span className="text-[9px] opacity-60 ml-0.5 font-medium">({productData.review_count})</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed">
              {displayDescription}
            </p>
            {/* Footer: Price and Link */}
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {formatPrice(displayPrice)}
              </p>
              {hasValidUrl ? (
                <button className="text-xs font-medium text-orange-500 hover:text-orange-600 flex items-center gap-1 transition-colors">
                  Product Details
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              ) : (
                <span className="text-[10px] text-gray-400">No link</span>
              )}
            </div>
          </div>
      </motion.div>
    );
  }

  // Small variant (Compact horizontal card)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (delay || index * 0.03) }}
      whileHover={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-row h-28 group cursor-pointer"
      onClick={handleClick}
    >
      {/* Image Section with carousel controls */}
      <div className="relative w-28 h-full bg-gray-50 dark:bg-gray-700/50 shrink-0 flex items-center justify-center">
        {displayImage ? (
          <img
            src={displayImage}
            alt={displayTitle}
            className="w-full h-full object-contain p-2"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50" y="55" font-family="sans-serif" font-size="10" text-anchor="middle" fill="%239ca3af">No Image</text></svg>';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}



        {/* Save button */}
        {(onSave || onUnsave) && (
          <button
            onClick={handleSaveClick}
            disabled={saving}
            className={`absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-sm ${localSaved
              ? 'bg-orange-500 text-white'
              : 'bg-white/90 dark:bg-gray-800/90 text-gray-400 hover:text-orange-500 opacity-0 group-hover:opacity-100'
              } ${saving ? 'animate-pulse' : ''}`}
            title={localSaved ? 'Remove from saved' : 'Save for later'}
          >
            <svg
              className="w-3.5 h-3.5"
              fill={localSaved ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        )}
      </div>

      {/* Content Section */}
      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
        <div className="space-y-0.5">
          {/* Marketplace and Title */}
          <div className="flex items-center gap-1.5">
             <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{displaySource || 'Marketplace'}</span>
          </div>
          <div className="flex items-start gap-2">
            <h3 className="font-semibold text-xs text-gray-900 dark:text-white line-clamp-1 leading-tight flex-1">
              {displayTitle}
            </h3>
            {displayRating > 0 && (
              <div className="flex items-center gap-0.5 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-700 dark:text-amber-400 shrink-0">
                <span>{displayRating.toFixed(1)}</span>
                <span>★</span>
                {productData.review_count !== undefined && (
                  <span className="text-[9px] opacity-60 ml-0.5 font-medium">({productData.review_count})</span>
                )}
              </div>
            )}
          </div>
          {/* Description */}
          <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
            {displayDescription}
          </p>
        </div>
        {/* Footer: Price and Link */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {formatPrice(displayPrice)}
          </p>
          {hasValidUrl ? (
            <button className="text-[11px] font-medium text-orange-500 hover:text-orange-600 flex items-center gap-1 transition-colors">
              Product Details
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          ) : (
            <span className="text-[10px] text-gray-400">No link</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
