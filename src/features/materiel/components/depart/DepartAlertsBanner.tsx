'use client';
import React from 'react';
import { MobileVitalAlertBanner } from '@/features/materiel/components/mobile/MobileVitalAlertBanner';
import type { ActionableAlert } from '@/features/materiel/services/generateSmartPrompts';

export interface DepartAlertsBannerProps {
  alerts: ActionableAlert[];
  onAction?: (alert: ActionableAlert) => void;
  onDismiss?: (alert: ActionableAlert) => void;
  className?: string;
}

export function DepartAlertsBanner({
  alerts,
  onAction,
  onDismiss,
  className,
}: DepartAlertsBannerProps) {
  if (!alerts || alerts.length === 0) {
    return (
      <p className="glass-sub-card rounded-2xl px-3 py-2 text-xs font-medium text-[var(--lkv-text-primary)]/70">
        Tout est prêt — aucun point bloquant.
      </p>
    );
  }

  return (
    <MobileVitalAlertBanner
      alerts={alerts}
      onAction={onAction}
      onDismiss={onDismiss}
      className={className}
    />
  );
}
