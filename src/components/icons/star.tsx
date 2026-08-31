"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface StarIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

export const StarIcon = forwardRef<HTMLDivElement, StarIconProps>(
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
          <motion.polygon
            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
            animate={controls}
            variants={{ normal: { rotate: 0, scale: 1 }, animate: { rotate: [0, 35, -20, 0], scale: [1, 1.2, 0.95, 1] } }}
            transition={{ duration: 0.4 }}
          />
        </svg>
      </div>
    );
  }
);
StarIcon.displayName = 'StarIcon';
