'use client';

import React from 'react';
import {
  AnimatePresence,
  MotionConfig,
  motion,
  type Variants,
} from 'framer-motion';
import NumberFlow from '@number-flow/react';

export const CARNET_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 34,
  mass: 0.85,
};

export const CARNET_STAGGER_CONTAINER: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const CARNET_STAGGER_ITEM: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: CARNET_SPRING,
  },
};

export function CarnetMotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export function LensTransition({
  transitionKey,
  children,
}: {
  transitionKey: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={transitionKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        style={{ minHeight: '100%' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function StackSlideView({
  stackKey,
  children,
}: {
  stackKey: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      key={stackKey}
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={CARNET_SPRING}
      style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerList({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      variants={CARNET_STAGGER_CONTAINER}
      initial="hidden"
      animate="show"
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

export function StaggerCard({
  children,
  className,
  style,
  onClick,
  asButton,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  asButton?: boolean;
}) {
  if (asButton) {
    return (
      <motion.button
        type="button"
        variants={CARNET_STAGGER_ITEM}
        whileTap={{ scale: 0.978 }}
        className={className}
        style={style}
        onClick={onClick}
      >
        {children}
      </motion.button>
    );
  }
  return (
    <motion.div
      variants={CARNET_STAGGER_ITEM}
      whileTap={onClick ? { scale: 0.982 } : undefined}
      className={className}
      style={style}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedNumber({
  value,
  suffix,
  prefix,
  maximumFractionDigits = 0,
}: {
  value: number | null | undefined;
  suffix?: string;
  prefix?: string;
  maximumFractionDigits?: number;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span>—</span>;
  }
  return (
    <NumberFlow
      value={value}
      locales="fr-FR"
      format={{ maximumFractionDigits }}
      prefix={prefix}
      suffix={suffix}
    />
  );
}
