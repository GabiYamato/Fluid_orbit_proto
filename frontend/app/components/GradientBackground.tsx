'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

export default function GradientBackground() {
  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[80%] rounded-[40px] overflow-hidden border border-white/10 shadow-2xl bg-black">
        <video
          src="/frontend_video.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
      {/* Overlay to ensure text readability if needed, though user asked for "perfect fit" and "black background" matching video */}
      <div className="absolute top-8 left-8 flex items-center gap-3 z-10">
        <img
          src="/fluid-orbit-logo-new.png"
          alt="Fluid Orbit Logo"
          className="h-[40px] w-auto object-contain" 
        />
        <h1 className="text-2xl text-white font-normal">
          Fluid Orbit
        </h1>
      </div>
    </div>
  );
}
