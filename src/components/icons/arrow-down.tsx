"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ArrowDownIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  strokeWidth?: number;
}

export const ArrowDownIcon = forwardRef<HTMLDivElement, ArrowDownIconProps>(
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
          <line x1="12" y1="5" x2="12" y2="19" />
          <motion.polyline
            points="19 12 12 19 5 12"
            animate={controls}
            variants={{ normal: { y: 0 }, animate: { y: [0, 3, 0] } }}
            transition={{ duration: 0.3 }}
          />
        </svg>
      </div>
    );
  }
);
ArrowDownIcon.displayName = 'ArrowDownIcon';
