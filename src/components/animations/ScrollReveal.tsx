'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { springConfigs } from '@/lib/animations/constants';

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  threshold?: number;
}

export default function ScrollReveal({
  children,
  delay = 0,
  threshold = 0.2
}: ScrollRevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: threshold });

  return (
    <motion.div
      ref={ref}
      initial={{ y: 20, opacity: 0 }}
      animate={isInView ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
      transition={{ ...springConfigs.smooth, delay }}
    >
      {children}
    </motion.div>
  );
}

export { ScrollReveal };
