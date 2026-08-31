"use client";

import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface TentIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface TentIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const TentIcon = forwardRef<TentIconHandle, TentIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const controls = useAnimation();

    return (
      <div
        className={cn(className)}
        onMouseEnter={() => controls.start('animate')}
        onMouseLeave={() => controls.start('normal')}
        onClick={() => controls.start('animate')}
        onTouchStart={() => controls.start('animate')}
        {...props}
      >
        <svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          <motion.path
            animate={controls}
            d="M3.5 21 14 3l10.5 18H3.5z"
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            variants={{
              normal: { scale: 1 },
              animate: { scale: [1, 1.15, 0.95, 1] },
            }}
          />
          <path d="M8.5 21 14 11l5.5 10" />
        </svg>
      </div>
    );
  }
);

TentIcon.displayName = 'TentIcon';

export { TentIcon };
