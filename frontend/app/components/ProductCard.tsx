'use client';

import { motion } from 'framer-motion';

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
}

// Skeleton loader for product cards
export function ProductCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden animate-pulse border border-gray-100 dark:border-gray-700">
      {/* Image skeleton */}
      <div className="w-full h-40 bg-gray-200 dark:bg-gray-700" />

      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />

        {/* Price */}
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mt-2" />

        {/* Rating */}
        <div className="flex gap-1 mt-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full" />
          ))}
        </div>

        {/* Button */}
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg mt-3" />
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
}: ProductCardProps) {
  // Normalize product data (handle both new and legacy props)
  const productData = product || {
    title: name,
    description,
    price: price || 0,
    rating,
    image_url: image,
  };

  const displayTitle = productData.title || productData.name || 'Unknown Product';
  const displayPrice = productData.price || 0;
  const displayRating = productData.rating || 0;
  const displayImage = productData.image_url || productData.image || '';
  const displayUrl = productData.affiliate_url || productData.link || productData.url || '';
  const displaySource = productData.source || '';
  const displayReviews = productData.review_count || 0;
  const finalScore = productData.scores?.final_score;

  const handleClick = () => {
    if (displayUrl) {
      window.open(displayUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Format price
  const formatPrice = (p: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(p);
  };

  // Render stars
  const renderStars = (r: number = 0) => {
    const stars = [];
    const fullStars = Math.floor(r);
    const halfStar = r % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <svg key={i} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
          </svg>
        );
      } else if (i === fullStars && halfStar) {
        stars.push(
          <svg key={i} className="w-4 h-4 text-yellow-400" viewBox="0 0 20 20">
            <defs>
              <linearGradient id={`half-${index}-${i}`}>
                <stop offset="50%" stopColor="currentColor" />
                <stop offset="50%" stopColor="#D1D5DB" />
              </linearGradient>
            </defs>
            <path fill={`url(#half-${index}-${i})`} d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
          </svg>
        );
      } else {
        stars.push(
          <svg key={i} className="w-4 h-4 text-gray-300 dark:text-gray-600 fill-current" viewBox="0 0 20 20">
            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
          </svg>
        );
      }
    }
    return stars;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (delay || index * 0.05) }}
      whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}
      onClick={handleClick}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg border border-gray-100 dark:border-gray-700"
    >
      {/* Product Image */}
      <div className="relative w-full h-40 bg-gray-100 dark:bg-gray-700 overflow-hidden">
        {displayImage ? (
          <img
            src={displayImage}
            alt={displayTitle}
            className="w-full h-full object-contain p-2"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50" y="55" font-family="sans-serif" font-size="12" text-anchor="middle" fill="%239ca3af">No Image</text></svg>';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Score badge */}
        {finalScore && (
          <div className="absolute top-2 right-2 bg-black dark:bg-white text-white dark:text-black text-xs font-bold px-2 py-1 rounded-full">
            {Math.round(finalScore)}% match
          </div>
        )}

        {/* Source badge */}
        {displaySource && (
          <div className="absolute top-2 left-2 bg-gray-800/70 dark:bg-gray-200/70 text-white dark:text-black text-xs px-2 py-1 rounded">
            {displaySource}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="font-medium text-sm text-gray-900 dark:text-white line-clamp-2 mb-2 min-h-[2.5rem]">
          {displayTitle}
        </h3>

        {/* Price */}
        <p className="text-lg font-bold text-black dark:text-white mb-2">
          {formatPrice(displayPrice)}
        </p>

        {/* Rating */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex">{renderStars(displayRating)}</div>
          {displayReviews > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({displayReviews.toLocaleString()})
            </span>
          )}
        </div>

        {/* View Button */}
        <button
          className="w-full py-2 px-4 bg-black dark:bg-white text-white dark:text-black text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
        >
          View Deal
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}
