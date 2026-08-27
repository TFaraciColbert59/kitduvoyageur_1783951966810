'use client';

import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      key={pathname}
      initial={prefersReducedMotion ? false : { opacity: 0.92 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="w-full h-full min-h-full"
    >
      {children}
    </motion.div>
  );
}
