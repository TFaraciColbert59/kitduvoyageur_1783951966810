import React from 'react';
import { LkvChip, type LkvChipTone } from './LkvChip';

export type BadgeTone = 'sage' | 'warn' | 'danger' | 'info' | 'stone';

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <LkvChip tone={tone as LkvChipTone}>
      {children}
    </LkvChip>
  );
}

export default Badge;
