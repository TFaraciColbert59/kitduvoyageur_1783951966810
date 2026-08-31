"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ArrowUpRightIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  strokeWidth?: number;
}

export const ArrowUpRightIcon = forwardRef<HTMLDivElement, ArrowUpRightIconProps>(
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
          <line x1="7" y1="17" x2="17" y2="7" />
          <motion.polyline
            points="7 7 17 7 17 17"
            animate={controls}
            variants={{ normal: { x: 0, y: 0 }, animate: { x: [0, 2, 0], y: [0, -2, 0] } }}
            transition={{ duration: 0.3 }}
          />
        </svg>
      </div>
    );
  }
);
ArrowUpRightIcon.displayName = 'ArrowUpRightIcon';
