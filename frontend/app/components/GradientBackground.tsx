'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

export default function GradientBackground() {
  return (
    <div className="relative w-full h-full overflow-hidden bg-white border-r border-gray-200">
      <div className="absolute top-[54%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[80%] rounded-[40px] overflow-hidden [mask-image:radial-gradient(ellipse_at_center,black_70%,transparent_100%)]">
        <img
          src="/Login.GIF"
          alt="Login Animation"
          className="w-full h-full object-cover"
        />
      </div>
      {/* Overlay to ensure text readability */}
      <div className="absolute top-8 left-8 flex items-center gap-3 z-10">
        <img
          src="/background.png"
          alt="Fluid Orbit Logo"
          className="h-[84px] w-auto object-contain"
        />
        <h1 className="text-2xl text-black font-normal tracking-tight">
          Fluid Orbit
        </h1>
      </div>
    </div>
  );
}
