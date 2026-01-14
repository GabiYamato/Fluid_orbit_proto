'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

export default function SkeletonLoader() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-8 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        {/* Searching Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 mb-8 flex items-center gap-4 transition-colors duration-300"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Image
              src="/fluidorbitlogo.jpg"
              alt="Searching"
              width={50}
              height={50}
              className="rounded-full"
            />
          </motion.div>
          <span className="text-xl text-black dark:text-white transition-colors duration-300">
            Searching the Web...
          </span>
        </motion.div>

        {/* Large Skeleton Card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 mb-6 transition-colors duration-300"
        >
          <div className="flex gap-6">
            <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse transition-colors duration-300" />
            <div className="flex-1 space-y-3">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4 transition-colors duration-300" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full transition-colors duration-300" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-5/6 transition-colors duration-300" />
            </div>
          </div>
        </motion.div>

        {/* Grid of Smaller Skeleton Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 transition-colors duration-300"
            >
              <div className="flex gap-4">
                <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse transition-colors duration-300" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3 transition-colors duration-300" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full transition-colors duration-300" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2 transition-colors duration-300" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
