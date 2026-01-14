'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

export default function GradientBackground() {
  return (
    <div className="relative w-full h-full overflow-hidden">
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #f5e6e8 0%, #d4a5a5 50%, #ff6b35 100%)',
        }}
        animate={{
          background: [
            'linear-gradient(135deg, #f5e6e8 0%, #d4a5a5 50%, #ff6b35 100%)',
            'linear-gradient(135deg, #ffd4a3 0%, #ff9a76 50%, #ff6b35 100%)',
            'linear-gradient(135deg, #f5e6e8 0%, #d4a5a5 50%, #ff6b35 100%)',
          ],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <div className="absolute top-8 left-8 flex items-center gap-4">
        <Image
          src="/fluidorbitlogo.jpg"
          alt="Fluid Orbit Logo"
          width={60}
          height={60}
          className="rounded-lg"
        />
        <h1 className="text-4xl font-bold text-black">
          Fluid Orbit
        </h1>
      </div>
    </div>
  );
}
