"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface MinusIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

export const MinusIcon = forwardRef<HTMLDivElement, MinusIconProps>(
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
          <motion.line
            x1="5" y1="12" x2="19" y2="12"
            animate={controls}
            variants={{ normal: { scaleX: 1 }, animate: { scaleX: [1, 1.25, 0.9, 1] } }}
            transition={{ duration: 0.25 }}
          />
        </svg>
      </div>
    );
  }
);
MinusIcon.displayName = 'MinusIcon';
