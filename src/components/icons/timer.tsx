"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface TimerIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  strokeWidth?: number;
}

export const TimerIcon = forwardRef<HTMLDivElement, TimerIconProps>(
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
          <line x1="10" y1="2" x2="14" y2="2" />
          <line x1="12" y1="14" x2="15" y2="11" />
          <motion.circle
            cx="12" cy="14" r="8"
            animate={controls}
            variants={{ normal: { scale: 1 }, animate: { scale: [1, 1.08, 0.96, 1] } }}
            transition={{ duration: 0.3 }}
          />
        </svg>
      </div>
    );
  }
);
TimerIcon.displayName = 'TimerIcon';
