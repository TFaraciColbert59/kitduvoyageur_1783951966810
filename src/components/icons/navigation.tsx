"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface NavigationIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  strokeWidth?: number;
}

export const NavigationIcon = forwardRef<HTMLDivElement, NavigationIconProps>(
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
          <motion.polygon
            points="3 11 22 2 13 21 11 13 3 11"
            animate={controls}
            variants={{ normal: { rotate: 0 }, animate: { rotate: [0, -25, 15, 0] } }}
            transition={{ duration: 0.4 }}
          />
        </svg>
      </div>
    );
  }
);
NavigationIcon.displayName = 'NavigationIcon';
