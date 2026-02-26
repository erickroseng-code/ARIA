'use client';

import { motion } from 'framer-motion';

/**
 * Story 6.1 — Task 2: Background Wave/Blob Animations
 * SVG animated blobs for hero/header backgrounds.
 * Respects prefers-reduced-motion via Framer Motion defaults.
 */

const blobVariants = {
  animate: {
    d: [
      'M45,-55.2C58.1,-47.1,68.5,-33.3,73.1,-17.4C77.7,-1.5,76.5,16.5,68.6,30.7C60.7,44.9,46.1,55.3,30.1,62.4C14.1,69.5,-3.3,73.3,-20.1,70.1C-36.9,66.9,-53.1,56.7,-63.1,42.3C-73.1,27.9,-76.9,9.3,-73.8,-7.6C-70.7,-24.5,-60.7,-39.7,-47.6,-47.8C-34.5,-55.9,-18.3,-56.9,-0.8,-55.9C16.7,-54.9,31.9,-63.3,45,-55.2Z',
      'M42,-50.4C54.3,-42.9,63.8,-30.3,67.8,-15.8C71.8,-1.3,70.3,15.1,63.1,28.3C55.9,41.5,43,51.5,28.5,58.1C14,64.7,-2.1,67.9,-17.8,65.2C-33.5,62.5,-48.8,53.9,-58.7,40.7C-68.6,27.5,-73.1,9.7,-70.2,-6.3C-67.3,-22.3,-57,-36.5,-44.3,-44C-31.6,-51.5,-16.5,-52.3,-0.6,-51.6C15.3,-50.9,29.7,-57.9,42,-50.4Z',
      'M45,-55.2C58.1,-47.1,68.5,-33.3,73.1,-17.4C77.7,-1.5,76.5,16.5,68.6,30.7C60.7,44.9,46.1,55.3,30.1,62.4C14.1,69.5,-3.3,73.3,-20.1,70.1C-36.9,66.9,-53.1,56.7,-63.1,42.3C-73.1,27.9,-76.9,9.3,-73.8,-7.6C-70.7,-24.5,-60.7,-39.7,-47.6,-47.8C-34.5,-55.9,-18.3,-56.9,-0.8,-55.9C16.7,-54.9,31.9,-63.3,45,-55.2Z',
    ],
    transition: {
      duration: 12,
      repeat: Infinity,
      repeatType: 'mirror' as const,
      ease: 'easeInOut',
    },
  },
};

const blob2Variants = {
  animate: {
    d: [
      'M38,-46.8C49.1,-38.6,57.5,-26.3,61.7,-12.2C65.9,1.9,65.9,17.8,59.3,30.7C52.7,43.6,39.5,53.5,24.5,59.7C9.5,65.9,-7.3,68.4,-22.9,64.5C-38.5,60.6,-52.9,50.3,-61.2,36.3C-69.5,22.3,-71.7,4.6,-67.5,-10.8C-63.3,-26.2,-52.7,-39.3,-40.1,-47.3C-27.5,-55.3,-12.9,-58.2,0.8,-59.2C14.5,-60.2,26.9,-55,38,-46.8Z',
      'M41,-50.2C52.8,-42.1,62.1,-29.7,66.5,-15.2C70.9,-0.7,70.4,15.9,63.5,29C56.6,42.1,43.3,51.7,28.8,57.5C14.3,63.3,-1.4,65.3,-16.7,62.1C-32,58.9,-46.9,50.5,-56.3,37.9C-65.7,25.3,-69.6,8.5,-67,-7C-64.4,-22.5,-55.3,-36.7,-43.3,-44.8C-31.3,-52.9,-16.3,-54.9,-0.5,-54.3C15.3,-53.7,29.2,-58.3,41,-50.2Z',
      'M38,-46.8C49.1,-38.6,57.5,-26.3,61.7,-12.2C65.9,1.9,65.9,17.8,59.3,30.7C52.7,43.6,39.5,53.5,24.5,59.7C9.5,65.9,-7.3,68.4,-22.9,64.5C-38.5,60.6,-52.9,50.3,-61.2,36.3C-69.5,22.3,-71.7,4.6,-67.5,-10.8C-63.3,-26.2,-52.7,-39.3,-40.1,-47.3C-27.5,-55.3,-12.9,-58.2,0.8,-59.2C14.5,-60.2,26.9,-55,38,-46.8Z',
    ],
    transition: {
      duration: 15,
      repeat: Infinity,
      repeatType: 'mirror' as const,
      ease: 'easeInOut',
    },
  },
};

interface WaveBackgroundProps {
  className?: string;
  opacity?: number;
  colorFrom?: string;
  colorTo?: string;
}

export function WaveBackground({
  className = '',
  opacity = 0.15,
  colorFrom = '#6366F1',
  colorTo = '#7C3AED',
}: WaveBackgroundProps) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="-100 -100 200 200"
        className="absolute -top-1/4 -right-1/4 w-[150%] h-[150%]"
        style={{ opacity }}
      >
        <defs>
          <linearGradient id="blob-gradient-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorFrom} />
            <stop offset="100%" stopColor={colorTo} />
          </linearGradient>
          <linearGradient id="blob-gradient-2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colorTo} />
            <stop offset="100%" stopColor={colorFrom} />
          </linearGradient>
        </defs>
        <motion.path
          fill="url(#blob-gradient-1)"
          variants={blobVariants}
          animate="animate"
        />
        <motion.path
          fill="url(#blob-gradient-2)"
          variants={blob2Variants}
          animate="animate"
          style={{ opacity: 0.6 }}
        />
      </svg>
    </div>
  );
}
