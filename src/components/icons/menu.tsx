"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface MenuIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

export const MenuIcon = forwardRef<HTMLDivElement, MenuIconProps>(
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
          <motion.line x1="4" y1="6" x2="20" y2="6" animate={controls} variants={{ normal: { scaleX: 1 }, animate: { scaleX: [1, 1.15, 1] } }} />
          <motion.line x1="4" y1="12" x2="20" y2="12" animate={controls} variants={{ normal: { scaleX: 1 }, animate: { scaleX: [1, 0.85, 1] } }} />
          <motion.line x1="4" y1="18" x2="20" y2="18" animate={controls} variants={{ normal: { scaleX: 1 }, animate: { scaleX: [1, 1.15, 1] } }} />
        </svg>
      </div>
    );
  }
);
MenuIcon.displayName = 'MenuIcon';
