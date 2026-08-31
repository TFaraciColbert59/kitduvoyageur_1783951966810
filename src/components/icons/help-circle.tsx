"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface HelpCircleIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  strokeWidth?: number;
}

export const HelpCircleIcon = forwardRef<HTMLDivElement, HelpCircleIconProps>(
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
          <circle cx="12" cy="12" r="10" />
          <motion.path
            d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
            animate={controls}
            variants={{ normal: { rotate: 0 }, animate: { rotate: [0, -15, 15, 0] } }}
            transition={{ duration: 0.35 }}
          />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
    );
  }
);
HelpCircleIcon.displayName = 'HelpCircleIcon';
