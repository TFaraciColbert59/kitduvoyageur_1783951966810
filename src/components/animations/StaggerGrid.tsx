'use client';

import { motion } from 'framer-motion';
import { springConfigs } from '@/lib/animations/constants';

interface StaggerGridProps {
  children: React.ReactNode[];
  columns?: 2 | 3 | 4;
  staggerDelay?: number;
}

export default function StaggerGrid({
  children,
  columns = 2,
  staggerDelay = 0.05
}: StaggerGridProps) {
  return (
    <div className={`grid grid-cols-${columns} gap-4`}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...springConfigs.smooth, delay: i * staggerDelay }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

export { StaggerGrid };
