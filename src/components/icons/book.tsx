"use client";

import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface BookIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface BookIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const BookIcon = forwardRef<BookIconHandle, BookIconProps>(
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
            d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"
            transition={{ duration: 0.3 }}
            variants={{
              normal: { rotate: 0 },
              animate: { rotate: [0, -8, 4, 0] },
            }}
          />
          <path d="M6 6h10" />
          <path d="M6 10h10" />
        </svg>
      </div>
    );
  }
);

BookIcon.displayName = 'BookIcon';

export { BookIcon };
