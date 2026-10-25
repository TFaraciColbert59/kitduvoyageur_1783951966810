"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface VolumeXIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

export const VolumeXIcon = forwardRef<HTMLDivElement, VolumeXIconProps>(
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
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <motion.line
            x1="23" y1="9" x2="17" y2="15"
            animate={controls}
            variants={{ normal: { scale: 1 }, animate: { scale: [1, 1.2, 1] } }}
            transition={{ duration: 0.25 }}
          />
          <motion.line
            x1="17" y1="9" x2="23" y2="15"
            animate={controls}
            variants={{ normal: { scale: 1 }, animate: { scale: [1, 1.2, 1] } }}
            transition={{ duration: 0.25 }}
          />
        </svg>
      </div>
    );
  }
);
VolumeXIcon.displayName = 'VolumeXIcon';
