'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 transition-colors duration-300">
      <motion.div
        animate={{
          opacity: [1, 0.5, 1],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="mb-8"
      >
        <img
          src="/fluid-orbit-infinity-logo.png"
          alt="Fluid Orbit Logo"
          className="w-[120px] h-[120px] object-contain"
        />
      </motion.div>
      
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-5xl font-bold text-black dark:text-white mb-4 transition-colors duration-300"
      >
        Hello, ENUID
      </motion.h1>
      
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-xl text-gray-600 dark:text-gray-400 transition-colors duration-300"
      >
        Shop at the Speed of Thought.
      </motion.p>
    </div>
  );
}
