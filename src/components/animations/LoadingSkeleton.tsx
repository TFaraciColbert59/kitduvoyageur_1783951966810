'use client';

import { motion } from 'framer-motion';

interface LoadingSkeletonProps {
  variant: 'card' | 'list' | 'text' | 'image';
  count?: number;
}

export function LoadingSkeleton({ variant, count = 1 }: LoadingSkeletonProps) {
  const skeletons = Array.from({ length: count });

  const variants = {
    card: 'h-[200px] rounded-2xl',
    list: 'h-[80px] rounded-xl',
    text: 'h-[16px] rounded',
    image: 'aspect-square rounded-xl'
  };

  return (
    <>
      {skeletons.map((_, i) => (
        <motion.div
          key={i}
          className={`bg-ink-100 ${variants[variant]}`}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}
    </>
  );
}
