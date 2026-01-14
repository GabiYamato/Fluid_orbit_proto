'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface ProductCardProps {
  name: string;
  description: string;
  price: number;
  rating: number;
  image?: string;
  size?: 'large' | 'small';
  delay?: number;
}

export default function ProductCard({
  name,
  description,
  price,
  rating,
  image,
  size = 'small',
  delay = 0,
}: ProductCardProps) {
  const [imageUrl, setImageUrl] = useState(image || '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`bg-white rounded-2xl shadow-md p-6 hover:shadow-xl transition-shadow ${
        size === 'large' ? 'col-span-full' : ''
      }`}
    >
      <div className="flex gap-6">
        {/* Product Image */}
        <div
          className={`${
            size === 'large' ? 'w-32 h-32' : 'w-20 h-20'
          } bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0`}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <svg
              className={`${size === 'large' ? 'w-16 h-16' : 'w-10 h-10'} text-gray-400`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          )}
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h3 className={`${size === 'large' ? 'text-2xl' : 'text-lg'} font-semibold text-black`}>
              {name}
            </h3>
            <div className="flex items-center gap-1 bg-yellow-100 px-2 py-1 rounded-lg flex-shrink-0">
              <span className="text-yellow-600 text-sm">★</span>
              <span className="text-sm font-medium text-black">{rating}</span>
            </div>
          </div>

          <p className={`text-gray-600 mb-4 ${size === 'large' ? 'text-base' : 'text-sm'} line-clamp-2`}>
            {description}
          </p>

          <div className="flex items-center justify-between">
            <span className={`${size === 'large' ? 'text-3xl' : 'text-2xl'} font-bold text-black`}>
              ${price.toFixed(2)}
            </span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              Buy now
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
