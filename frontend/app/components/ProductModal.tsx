'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

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
  images?: string[];
}

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSave?: (product: Product) => void;
  onUnsave?: (productId: string) => void;
  isSaved?: boolean;
  savedProductId?: string;
}

export default function ProductModal({
  isOpen,
  onClose,
  product,
  onSave,
  onUnsave,
  isSaved = false,
  savedProductId,
}: ProductModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Reset index when product changes
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [product?.id]);
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!product) return null;

  const displayTitle = product.title || product.name || 'Unknown Product';
  const displayDescription = product.description || 'No description available for this product.';
  const displayPrice = product.price || 0;
  const displayRating = product.rating || 0;
  const displayReviewCount = product.review_count || 0;

  const productImages = product.images && product.images.length > 0
    ? product.images
    : [product.image_url || product.image || ''];

  const activeImage = productImages[currentImageIndex] || productImages[0];
  const displaySource = product.source || 'Marketplace';

  // Normalize source for display (e.g., "amazon" -> "amazon.com")
  const marketplaceName = (() => {
    const s = displaySource.toLowerCase();
    if (s.includes('.')) return s;
    if (s === 'amazon') return 'amazon.com';
    if (s === 'google_shopping') return 'shopping.google.com';
    if (s === 'express') return 'express.com';
    if (s === 'asos') return 'asos.com';
    if (s === 'nordstrom') return 'nordstrom.com';
    if (s === 'macys') return 'macys.com';
    if (s === 'h&m') return 'hm.com';
    return `${s}.com`;
  })();

  const rawUrl = product.affiliate_url || product.link || product.url || '';
  const formatPrice = (p: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(p);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: displayTitle,
        text: displayDescription,
        url: rawUrl || window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(rawUrl || window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 md:p-10">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-5xl bg-white dark:bg-gray-900 rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:px-8 md:py-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                  <svg className="w-5 h-5 hover:text-black dark:hover:text-white cursor-pointer transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <svg className="w-5 h-5 hover:text-black dark:hover:text-white cursor-pointer transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>

              <div className="font-bold text-gray-400 dark:text-gray-500 text-xs tracking-widest uppercase">
                {marketplaceName}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors group"
                >
                  <svg className="w-6 h-6 text-gray-900 dark:text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content Body Wrapper */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Store Info Header (Full Width) */}
              <div className="flex items-center gap-4 px-6 md:px-10 py-5 border-b border-gray-50 dark:border-gray-800/50 bg-white dark:bg-gray-900 shrink-0">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-xs uppercase overflow-hidden text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 shrink-0">
                  {marketplaceName.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-base md:text-lg text-gray-900 dark:text-white leading-tight">{marketplaceName}</h4>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-bold text-gray-900 dark:text-white">{displayRating ? displayRating.toFixed(1) : '4.8'}</span>
                    <span className="text-amber-500">★</span>
                    <span>({displayReviewCount || '120'} reviews)</span>
                  </div>
                </div>
                <button
                  onClick={() => window.open(rawUrl, '_blank')}
                  className="ml-auto px-6 py-2 rounded-full border border-black dark:border-white text-black dark:text-white text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shrink-0"
                >
                  Visit store
                </button>
              </div>

              {/* Two Column Content */}
              <div className="flex-1 md:flex overflow-hidden">
                {/* Left Column: Enlarged Product Image */}
                <div className="md:w-[50%] p-6 md:p-10 flex flex-col bg-gray-50/50 dark:bg-gray-800/10 relative group border-r border-gray-50 dark:border-gray-800/50">
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="relative w-full aspect-square max-w-[360px]">
                      <AnimatePresence mode="wait">
                        <motion.img
                          key={currentImageIndex}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.2 }}
                          src={activeImage}
                          alt={displayTitle}
                          className="w-full h-full object-contain drop-shadow-xl"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50" y="55" font-family="sans-serif" font-size="10" text-anchor="middle" fill="%239ca3af">No Image</text></svg>';
                          }}
                        />
                      </AnimatePresence>
                    </div>

                    {/* Thumbnails row */}
                    <div className="mt-4 flex items-center justify-center w-full px-4 mb-8">
                      <div className="flex gap-2.5 overflow-x-auto p-2 scrollbar-hide">
                        {productImages.map((img, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentImageIndex(i)}
                            className={`w-11 h-11 rounded-xl border-2 shrink-0 transition-all ${i === currentImageIndex ? 'border-gray-900 dark:border-white scale-105 shadow-md bg-white dark:bg-gray-800' : 'border-transparent opacity-40 hover:opacity-100 hover:scale-105'}`}
                          >
                            <img src={img} className="w-full h-full object-contain p-1" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Content Column */}
                <div className="flex-1 p-6 md:p-8 flex flex-col min-h-0 bg-white dark:bg-gray-900">
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Main Product Info */}
                    <div className="mb-6">
                      <h1 className="text-lg md:text-xl font-black text-gray-900 dark:text-white mb-2 leading-tight tracking-tight">
                        {displayTitle}
                      </h1>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">{formatPrice(displayPrice)}</span>
                        <div className="h-3 w-[1px] bg-gray-200 dark:bg-gray-800" />
                        <span className="text-[9px] font-black text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-0.5 rounded-full uppercase tracking-widest">In stock</span>
                      </div>
                    </div>

                    {/* Primary Actions */}
                    <div className="space-y-4 mb-8">
                      <button
                        onClick={() => window.open(rawUrl, '_blank')}
                        className="w-full py-4 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-black text-sm hover:opacity-90 transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        Visit Product Page
                      </button>
                      <div className="flex gap-4">
                        <button
                          onClick={() => {
                            if (isSaved && onUnsave && savedProductId) onUnsave(savedProductId);
                            else if (!isSaved && onSave) onSave(product);
                          }}
                          className={`flex-1 py-4 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold text-sm transition-all active:scale-[0.98] ${isSaved ? 'bg-orange-500 border-orange-500 text-white shadow-orange-500/20 shadow-lg' : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                          <svg className={`w-5 h-5 ${isSaved ? 'fill-current' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                          {isSaved ? 'Saved' : 'Save'}
                        </button>
                        <button
                          onClick={handleShare}
                          className="flex-1 py-4 rounded-2xl border-2 border-gray-100 dark:border-gray-800 flex items-center justify-center gap-2 font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-[0.98]"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          Share
                        </button>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="mb-6 flex-1 min-h-0 min-w-0">
                      <h3 className="font-black text-[9px] mb-2 uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Description</h3>
                      <div className="max-h-[120px] overflow-y-auto pr-4 scrollbar-hide">
                        <p className="text-gray-600 dark:text-gray-400 text-[13px] leading-[1.6] font-medium">
                          {displayDescription}
                        </p>
                      </div>
                    </div>

                    {/* Policies side-by-side at bottom */}
                    <div className="mt-auto pt-6 border-t border-gray-50 dark:border-gray-800/50 hidden md:flex flex-row gap-3">
                      <div className="flex-1 flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all group cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-white/5">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-white dark:bg-gray-900 rounded-xl shadow-sm text-gray-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                          </div>
                          <span className="text-xs font-bold text-gray-900 dark:text-white">Shipping</span>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <div className="flex-1 flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all group cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-white/5">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-white dark:bg-gray-900 rounded-xl shadow-sm text-gray-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3" />
                            </svg>
                          </div>
                          <span className="text-xs font-bold text-gray-900 dark:text-white">Refund</span>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Policies visible here for mobile */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-6 flex flex-col sm:flex-row gap-4 md:hidden">
                <div className="flex-1 flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-transparent">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">Shipping Policy</span>
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-transparent">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">Refund Policy</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Nav Bar (Mobile Only) */}
            <div className="md:hidden flex items-center justify-around p-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
              <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg>
              <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M4 18h11c.55 0 1-.45 1-1s-.45-1-1-1H4c-.55 0-1 .45-1 1s.45 1 1 1zm0-4h8c.55 0 1-.45 1-1s-.45-1-1-1H4c-.55 0-1 .45-1 1s.45 1 1 1zm0-4h11c.55 0 1-.45 1-1s-.45-1-1-1H4c-.55 0-1 .45-1 1s.45 1 1 1zm0-8v2h18V4H4z" /></svg>
              <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" /></svg>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
