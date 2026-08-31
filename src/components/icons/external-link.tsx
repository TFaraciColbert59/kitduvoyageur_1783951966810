"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ExternalLinkIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

export const ExternalLinkIcon = forwardRef<HTMLDivElement, ExternalLinkIconProps>(
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
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <motion.polyline
            points="15 3 21 3 21 9"
            animate={controls}
            variants={{ normal: { x: 0, y: 0 }, animate: { x: [0, 2, 0], y: [0, -2, 0] } }}
            transition={{ duration: 0.3 }}
          />
          <motion.line
            x1="10" y1="14" x2="21" y2="3"
            animate={controls}
            variants={{ normal: { scale: 1 }, animate: { scale: [1, 1.1, 1] } }}
            transition={{ duration: 0.3 }}
          />
        </svg>
      </div>
    );
  }
);
ExternalLinkIcon.displayName = 'ExternalLinkIcon';
