'use client';

import React from 'react';
import {
  AnimatePresence,
  MotionConfig,
  motion,
  type Variants,
} from 'framer-motion';
import NumberFlow from '@number-flow/react';

export const CLUB_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 34,
  mass: 0.85,
};

export const CARNET_SPRING = CLUB_SPRING;

export const CLUB_STAGGER_CONTAINER: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const CLUB_STAGGER_ITEM: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: CLUB_SPRING,
  },
};

export function ClubMotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export const CarnetMotionRoot = ClubMotionRoot;

export function LensTransition({
  transitionKey,
  children,
}: {
  transitionKey: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      key={transitionKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      style={{ minHeight: '100%' }}
    >
      {children}
    </motion.div>
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
      transition={CLUB_SPRING}
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
  role,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  role?: React.AriaRole;
  'aria-label'?: string;
}) {
  return (
    <motion.div
      variants={CLUB_STAGGER_CONTAINER}
      initial="hidden"
      animate="show"
      className={className}
      style={style}
      role={role}
      aria-label={ariaLabel}
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
  role,
  'aria-current': ariaCurrent,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  asButton?: boolean;
  role?: React.AriaRole;
  'aria-current'?: React.AriaAttributes['aria-current'];
  'aria-label'?: string;
}) {
  if (asButton) {
    return (
      <motion.button
        type="button"
        variants={CLUB_STAGGER_ITEM}
        whileTap={{ scale: 0.978 }}
        className={className}
        style={style}
        onClick={onClick}
        aria-current={ariaCurrent}
        aria-label={ariaLabel}
      >
        {children}
      </motion.button>
    );
  }
  return (
    <motion.div
      variants={CLUB_STAGGER_ITEM}
      whileTap={onClick ? { scale: 0.982 } : undefined}
      className={className}
      style={style}
      onClick={onClick}
      role={role}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
    >
      {children}
    </motion.div>
  );
}

export const ClubStaggerList = StaggerList;
export const ClubStaggerCard = StaggerCard;

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
