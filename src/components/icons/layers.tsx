"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface LayersIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  strokeWidth?: number;
}

export const LayersIcon = forwardRef<HTMLDivElement, LayersIconProps>(
  ({ className, size = 20, strokeWidth = 2, ...props }, ref) => {
    const controls = useAnimation();
    return (
      <div
        ref={ref}
        className={cn('inline-flex items-center justify-center cursor-pointer', className)}
        onMouseEnter={() => controls.start('animate')}
        onMouseLeave={() => controls.start('normal')}
        onClick={() => controls.start('animate')}
        onTouchStart={() => controls.start('animate')}
        {...props}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <motion.polygon
            points="12 2 2 7 12 12 22 7 12 2"
            animate={controls}
            variants={{ normal: { y: 0 }, animate: { y: [0, -3, 0] } }}
            transition={{ duration: 0.3 }}
          />
          <motion.polyline
            points="2 17 12 22 22 17"
            animate={controls}
            variants={{ normal: { y: 0 }, animate: { y: [0, 2, 0] } }}
            transition={{ duration: 0.3 }}
          />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </div>
    );
  }
);
LayersIcon.displayName = 'LayersIcon';
