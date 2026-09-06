import React from 'react';
import { LkvChip, type LkvChipTone } from './LkvChip';

export type BadgeTone = 'sage' | 'warn' | 'danger' | 'info' | 'stone';

export interface BadgeProps {
  tone?: BadgeTone;
  children?: React.ReactNode;
  className?: string;
}

export function Badge({ tone, children, className }: BadgeProps) {
  return (
    <LkvChip tone={tone as LkvChipTone} className={className}>
      {children}
    </LkvChip>
  );
}

export default Badge;
