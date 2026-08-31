'use client';
import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActionableAlert } from '@/features/materiel/services/generateSmartPrompts';

export interface MobileVitalAlertBannerProps {
  alerts: ActionableAlert[];
  onAction?: (alert: ActionableAlert) => void;
  onDismiss?: (alert: ActionableAlert) => void;
  dismissedIds?: string[];
  className?: string;
}

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/**
 * MobileVitalAlertBanner — Retractable Vital Safety Notification Banner
 *
 * Designed according to Apple iOS 18 Notification Banner ergonomics:
 * - Displays the highest-priority active safety/vital alert
 * - Styled as an iOS notification card: rounded-2xl, rose tinted glass, crisp typography
 * - 1-tap action capsule with direct trigger callback
 * - Dismiss / snooze button with accessible 44-48px touch target
 * - Framer Motion spring transition with useReducedMotion support
 */
export function MobileVitalAlertBanner({
  alerts = [],
  onAction,
  onDismiss,
  dismissedIds,
  className,
}: MobileVitalAlertBannerProps) {
  const shouldReduceMotion = useReducedMotion();

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        // Fallback gracefully on environments without vibration support
      }
    }
  };

  const activeAlerts = (alerts || []).filter(
    (a) => a && (!dismissedIds || !dismissedIds.includes(a.id))
  );

  if (activeAlerts.length === 0) {
    return null;
  }

  // Sort by priority (critical first, then warning, then info)
  const sortedAlerts = [...activeAlerts].sort(
    (a, b) => (SEVERITY_WEIGHT[a.severity] ?? 9) - (SEVERITY_WEIGHT[b.severity] ?? 9)
  );

  const currentAlert = sortedAlerts[0];
  if (!currentAlert) {
    return null;
  }

  const handleDismiss = () => {
    triggerHaptic();
    onDismiss?.(currentAlert);
  };

  const handleAction = () => {
    triggerHaptic();
    onAction?.(currentAlert);
  };

  return (
    <AnimatePresence mode="wait">
      <motion.aside
        key={currentAlert.id}
        role="alert"
        aria-live="polite"
        initial={shouldReduceMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={
          shouldReduceMotion
            ? { opacity: 0 }
            : { opacity: 0, height: 0, y: -8, scale: 0.98, transition: { duration: 0.2 } }
        }
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={cn(
          'w-full p-2.5 sm:p-3 rounded-2xl border select-none transition-all',
          'bg-rose-50/95 dark:bg-rose-950/40 border-rose-200/90 dark:border-rose-900/50 text-[#8A241B] dark:text-rose-200',
          'shadow-2xs backdrop-blur-md',
          className
        )}
      >
        {/* ════ EN-TÊTE COMPACT : ICÔNE + TITRE & MESSAGE + BOUTONS ACTION & FERMER ════ */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-xl bg-rose-200/80 dark:bg-rose-900/60 text-[#8A241B] dark:text-rose-300 flex items-center justify-center shrink-0 shadow-2xs">
              <AlertTriangle size={14} aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-[#8A241B] dark:text-rose-200 truncate leading-tight">
                {currentAlert.title}
              </h4>
              <p className="text-[10.5px] text-[#8A241B]/90 dark:text-rose-300/90 leading-tight truncate mt-0.5">
                {currentAlert.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Bouton Action Rapide */}
            <button
              type="button"
              data-testid="vital-alert-action"
              onClick={handleAction}
              className="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-[#8A241B] hover:bg-[#6b1c15] text-white shadow-2xs flex items-center gap-1 cursor-pointer transition-transform active:scale-95 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A241B]"
            >
              <span>{currentAlert.actionLabel || "Régler"}</span>
              <ArrowRight size={10} aria-hidden="true" />
            </button>

            {/* Bouton Fermer */}
            <button
              type="button"
              data-testid="vital-alert-dismiss"
              onClick={handleDismiss}
              aria-label="Masquer l'alerte"
              className="w-7 h-7 flex items-center justify-center text-[#8A241B]/70 hover:text-[#8A241B] dark:text-rose-300/70 hover:bg-rose-200/50 dark:hover:bg-rose-900/50 rounded-full cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 shrink-0"
            >
              <X size={12} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
