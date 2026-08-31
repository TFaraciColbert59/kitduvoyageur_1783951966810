"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface FilterIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

export const FilterIcon = forwardRef<HTMLDivElement, FilterIconProps>(
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
            points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
            animate={controls}
            variants={{ normal: { rotate: 0 }, animate: { rotate: [0, -12, 10, -6, 0] } }}
            transition={{ duration: 0.4 }}
          />
        </svg>
      </div>
    );
  }
);
FilterIcon.displayName = 'FilterIcon';
