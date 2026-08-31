'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AlertTriangle, AlertCircle, Clock, ShieldCheck, HelpCircle } from 'lucide-react';
import { ExternalLinkIcon as ExternalLink } from '@/components/icons/external-link';
import { ChevronDownIcon as ChevronDown } from '@/components/icons/chevron-down';
import { ArrowRightIcon as ArrowRightAnimated } from '@/components/icons/arrow-right';
import { XIcon as XAnimated } from '@/components/icons/x';
import { cn } from '@/lib/utils';
import type { ActionableAlert, SmartPromptsInput } from '@/features/materiel/services/generateSmartPrompts';
import { generateSmartPrompts } from '@/features/materiel/services/generateSmartPrompts';

const DISMISS_STORAGE_KEY = 'lkdv_dismissed_depart_alerts_v2';
const SNOOZE_HOURS = 24;
const MAX_VISIBLE = 3;

interface DismissEntry {
  dismissedAt: number;
  snoozeUntil: number;
}

export function DepartAlerts({ input }: { input: SmartPromptsInput }) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const [dismissed, setDismissed] = useState<Map<string, DismissEntry>>(new Map());
  const [expanded, setExpanded] = useState(false);
  const [openWhyId, setOpenWhyId] = useState<string | null>(null);

  const allAlerts = generateSmartPrompts(input);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (raw) {
        const parsed: Record<string, DismissEntry> = JSON.parse(raw);
        const now = Date.now();
        const valid = new Map<string, DismissEntry>();
        for (const [id, entry] of Object.entries(parsed)) {
          if (entry.snoozeUntil > now) {
            valid.set(id, entry);
          }
        }
        setDismissed(valid);
      }
    } catch {}
  }, []);

  const handleSnooze = (alertId: string) => {
    setDismissed((prev) => {
      const updated = new Map(prev);
      const now = Date.now();
      updated.set(alertId, {
        dismissedAt: now,
        snoozeUntil: now + SNOOZE_HOURS * 3600 * 1000,
      });

      try {
        const payload: Record<string, DismissEntry> = {};
        updated.forEach((v, k) => {
          payload[k] = v;
        });
        localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(payload));
      } catch {}
      return updated;
    });
  };

  const handleAction = (alert: ActionableAlert) => {
    if (alert.actionType === 'scroll_checklist') {
      const el = document.getElementById('section-depart-checklist');
      el?.scrollIntoView({ behavior: 'smooth' });
      if (alert.targetItemId && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('highlight-checklist-item', { detail: { id: alert.targetItemId } })
        );
      }
    } else if (alert.actionType === 'view_dispo') {
      router.push('/materiel/dispo');
    } else if (alert.actionType === 'scroll_weather' || alert.actionType === 'edit_emergency') {
      const el = document.getElementById('section-depart-terrain');
      el?.scrollIntoView({ behavior: 'smooth' });
    } else if (alert.actionType === 'mark_planned') {
      handleSnooze(alert.id);
    } else if (alert.actionType === 'check_item' && alert.targetItemId) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('toggle-item-from-alert', { detail: { id: alert.targetItemId } })
        );
      }
      handleSnooze(alert.id);
    }
  };

  const activeAlerts = allAlerts.filter((a) => !dismissed.has(a.id));
  const visibleAlerts = expanded ? activeAlerts : activeAlerts.slice(0, MAX_VISIBLE);
  const hiddenCount = activeAlerts.length - MAX_VISIBLE;

  if (visibleAlerts.length === 0) {
    return (
      <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-stone-900/60 border border-white/80 text-center space-y-1.5 shadow-2xs">
        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-[#2D6B4A] dark:text-emerald-400 flex items-center justify-center mx-auto shadow-2xs">
          <ShieldCheck size={16} />
        </div>
        <h4 className="text-xs font-bold text-[#17402C]">
          Aucun point bloquant
        </h4>
        <p className="text-[10.5px] text-[#5A7064]">
          Équipements et sécurité prêts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5" role="region" aria-label="Alertes avant départ">
      {/* En-tête avec compteur */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#8A241B] animate-pulse" />
          <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#8A241B]">
            À régler ({activeAlerts.length})
          </span>
        </div>

        {hiddenCount > 0 && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[9.5px] font-semibold text-[#5A7064] hover:text-[#17402C] flex items-center gap-0.5 cursor-pointer"
          >
            <span>+{hiddenCount}</span>
            <ChevronDown size={10} />
          </button>
        )}
      </div>

      <AnimatePresence>
        <div className="space-y-2">
          {visibleAlerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            const isWhyOpen = openWhyId === alert.id;

            return (
              <motion.div
                key={alert.id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.16 }}
                className={cn(
                  'p-3 rounded-2xl border space-y-2 shadow-2xs backdrop-blur-md transition-all',
                  isCritical
                    ? 'bg-rose-50/90 dark:bg-rose-950/20 border-rose-200/80 text-[#8A241B]'
                    : 'bg-white/85 dark:bg-stone-900/80 border-white/90 dark:border-white/20 text-[#17402C]'
                )}
                role="alert"
              >
                {/* ── LIGNE 1 : ICÔNE + TITRE + ACTIONS DISMISS/SNOOZE ── */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        'w-5.5 h-5.5 rounded-lg flex items-center justify-center shrink-0 shadow-2xs mt-0.5',
                        isCritical ? 'bg-rose-200/80 text-[#8A241B]' : 'bg-[#2D6B4A]/10 text-[#2D6B4A]'
                      )}
                    >
                      {isCritical ? <AlertTriangle size={11} /> : <AlertCircle size={11} />}
                    </div>

                    <h5 className="text-[11.5px] font-bold leading-tight text-[#17402C] break-words line-clamp-2">
                      {alert.title}
                    </h5>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSnooze(alert.id)}
                      className="glass-circle-btn !w-5.5 !h-5.5 text-[9px] font-bold cursor-pointer text-[#17402C]"
                      title="Reporter de 24h"
                      aria-label={`Reporter : ${alert.title}`}
                    >
                      <Clock size={9} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSnooze(alert.id)}
                      className="glass-circle-btn !w-5.5 !h-5.5 cursor-pointer text-[#17402C]"
                      title="Masquer"
                      aria-label="Masquer"
                    >
                      <XAnimated size={10} />
                    </button>
                  </div>
                </div>

                {/* ── LIGNE 2 : MESSAGE LISIBLE SANS CHEVAUCHEMENT ── */}
                <p className="text-[10.5px] text-[#5A7064] dark:text-stone-300 leading-snug line-clamp-2">
                  {alert.message}
                </p>

                {/* ── LIGNE 3 : LIEN POURQUOI & BOUTON ACTION CAPSULE ── */}
                <div className="pt-1 border-t border-black/5 dark:border-white/10 flex items-center justify-between gap-1.5">
                  {alert.whyExplanation ? (
                    <button
                      type="button"
                      onClick={() => setOpenWhyId(isWhyOpen ? null : alert.id)}
                      className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-[#5A7064] hover:text-[#17402C] cursor-pointer underline underline-offset-2"
                      title="Pourquoi cette alerte ?"
                    >
                      <HelpCircle size={9.5} />
                      <span>Pourquoi ?</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  {alert.actionLabel && (
                    <button
                      type="button"
                      onClick={() => handleAction(alert)}
                      className={cn(
                        'glass-capsule-btn !py-1 !px-2.5 text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition-all active:scale-95 shrink-0',
                        isCritical ? 'primary !bg-[#8A241B] !text-white' : 'primary'
                      )}
                    >
                      <span>{alert.actionLabel}</span>
                      {alert.actionType === 'view_dispo' ? (
                        <ExternalLink size={9} />
                      ) : (
                        <ArrowRightAnimated size={9} />
                      )}
                    </button>
                  )}
                </div>

                {/* Volet explicatif dépliable */}
                <AnimatePresence>
                  {isWhyOpen && alert.whyExplanation && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-[10px] p-2 rounded-xl bg-white/95 dark:bg-stone-900 border border-black/5 text-[#17402C] leading-relaxed shadow-2xs"
                    >
                      <p>
                        <strong>Règle LKDV :</strong> {alert.whyExplanation}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </AnimatePresence>
    </div>
  );
}
