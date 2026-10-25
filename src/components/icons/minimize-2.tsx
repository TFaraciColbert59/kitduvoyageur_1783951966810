"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface Minimize2IconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  strokeWidth?: number;
}

export const Minimize2Icon = forwardRef<HTMLDivElement, Minimize2IconProps>(
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
            points="4 14 10 14 10 20"
            animate={controls}
            variants={{ normal: { x: 0, y: 0 }, animate: { x: [0, 2, 0], y: [0, -2, 0] } }}
            transition={{ duration: 0.3 }}
          />
          <motion.polyline
            points="20 10 14 10 14 4"
            animate={controls}
            variants={{ normal: { x: 0, y: 0 }, animate: { x: [0, -2, 0], y: [0, 2, 0] } }}
            transition={{ duration: 0.3 }}
          />
          <line x1="14" y1="10" x2="21" y2="3" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </div>
    );
  }
);
Minimize2Icon.displayName = 'Minimize2Icon';
