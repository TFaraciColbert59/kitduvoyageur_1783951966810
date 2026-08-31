"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface LockIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

export const LockIcon = forwardRef<HTMLDivElement, LockIconProps>(
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
          <motion.rect
            x="3" y="11" width="18" height="11" rx="2" ry="2"
            animate={controls}
            variants={{ normal: { scale: 1 }, animate: { scale: [1, 1.08, 0.96, 1] } }}
            transition={{ duration: 0.3 }}
          />
          <motion.path
            d="M7 11V7a5 5 0 0 1 10 0v4"
            animate={controls}
            variants={{ normal: { y: 0 }, animate: { y: [0, -2, 0] } }}
            transition={{ duration: 0.3 }}
          />
        </svg>
      </div>
    );
  }
);
LockIcon.displayName = 'LockIcon';
