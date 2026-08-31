"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ListIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  strokeWidth?: number;
}

export const ListIcon = forwardRef<HTMLDivElement, ListIconProps>(
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
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <motion.line
            x1="3" y1="6" x2="3.01" y2="6"
            animate={controls}
            variants={{ normal: { scale: 1 }, animate: { scale: [1, 1.4, 1] } }}
            transition={{ duration: 0.2 }}
          />
          <motion.line
            x1="3" y1="12" x2="3.01" y2="12"
            animate={controls}
            variants={{ normal: { scale: 1 }, animate: { scale: [1, 1.4, 1] } }}
            transition={{ duration: 0.2, delay: 0.05 }}
          />
          <motion.line
            x1="3" y1="18" x2="3.01" y2="18"
            animate={controls}
            variants={{ normal: { scale: 1 }, animate: { scale: [1, 1.4, 1] } }}
            transition={{ duration: 0.2, delay: 0.1 }}
          />
        </svg>
      </div>
    );
  }
);
ListIcon.displayName = 'ListIcon';
