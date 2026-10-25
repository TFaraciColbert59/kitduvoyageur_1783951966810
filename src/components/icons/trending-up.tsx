"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface TrendingUpIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  strokeWidth?: number;
}

export const TrendingUpIcon = forwardRef<HTMLDivElement, TrendingUpIconProps>(
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
          <motion.polyline
            points="23 6 13.5 15.5 8.5 10.5 1 18"
            animate={controls}
            variants={{ normal: { scale: 1 }, animate: { scale: [1, 1.1, 0.95, 1] } }}
            transition={{ duration: 0.3 }}
          />
          <motion.polyline
            points="17 6 23 6 23 12"
            animate={controls}
            variants={{ normal: { x: 0, y: 0 }, animate: { x: [0, 2, 0], y: [0, -2, 0] } }}
            transition={{ duration: 0.3 }}
          />
        </svg>
      </div>
    );
  }
);
TrendingUpIcon.displayName = 'TrendingUpIcon';
