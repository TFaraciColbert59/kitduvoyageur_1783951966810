"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface Share2IconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

export const Share2Icon = forwardRef<HTMLDivElement, Share2IconProps>(
  ({ className, size = 20, ...props }, ref) => {
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
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <motion.circle
            cx="18" cy="5" r="3"
            animate={controls}
            variants={{ normal: { scale: 1 }, animate: { scale: [1, 1.25, 1] } }}
            transition={{ duration: 0.3 }}
          />
          <motion.circle
            cx="6" cy="12" r="3"
            animate={controls}
            variants={{ normal: { scale: 1 }, animate: { scale: [1, 1.2, 1] } }}
            transition={{ duration: 0.3, delay: 0.05 }}
          />
          <motion.circle
            cx="18" cy="19" r="3"
            animate={controls}
            variants={{ normal: { scale: 1 }, animate: { scale: [1, 1.25, 1] } }}
            transition={{ duration: 0.3, delay: 0.1 }}
          />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </div>
    );
  }
);
Share2Icon.displayName = 'Share2Icon';
