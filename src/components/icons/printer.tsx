"use client";
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface PrinterIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

export const PrinterIcon = forwardRef<HTMLDivElement, PrinterIconProps>(
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
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <motion.rect
            x="6" y="14" width="12" height="8"
            animate={controls}
            variants={{ normal: { y: 0 }, animate: { y: [0, 3, 0] } }}
            transition={{ duration: 0.35 }}
          />
        </svg>
      </div>
    );
  }
);
PrinterIcon.displayName = 'PrinterIcon';
