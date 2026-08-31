"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ShoppingBagIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

export const ShoppingBagIcon = forwardRef<HTMLDivElement, ShoppingBagIconProps>(
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
          <motion.path
            d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"
            animate={controls}
            variants={{ normal: { scale: 1 }, animate: { scale: [1, 1.1, 0.95, 1] } }}
            transition={{ duration: 0.3 }}
          />
          <path d="M3 6h18" />
          <motion.path
            d="M16 10a4 4 0 0 1-8 0"
            animate={controls}
            variants={{ normal: { y: 0 }, animate: { y: [0, -2, 0] } }}
            transition={{ duration: 0.3 }}
          />
        </svg>
      </div>
    );
  }
);
ShoppingBagIcon.displayName = 'ShoppingBagIcon';
