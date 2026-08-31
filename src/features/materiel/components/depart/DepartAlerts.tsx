'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  X,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  HelpCircle,
} from 'lucide-react';
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
      <div className="glass rounded-[28px] p-5 text-center space-y-2 border border-emerald-300/50 bg-emerald-50/40 dark:bg-emerald-950/20 backdrop-blur-md">
        <div className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-[#2D6B4A] dark:text-emerald-400 flex items-center justify-center mx-auto shadow-2xs">
          <ShieldCheck size={18} />
        </div>
        <div>
          <h3 className="text-xs sm:text-[13px] font-bold text-[#17402C]">
            Aucun point bloquant détecté
          </h3>
          <p className="text-[11px] text-[#5A7064] mt-0.5 max-w-md mx-auto">
            Vos équipements vitaux, vivres et paramètres de sécurité sont prêts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" role="region" aria-label="Alertes avant départ">
      {/* En-tête de section avec badge de compteur */}
      <div className="flex items-center justify-between px-1.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#8A241B] animate-pulse" />
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#8A241B]">
            À régler avant le départ ({activeAlerts.length})
          </span>
        </div>

        {hiddenCount > 0 && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[10.5px] font-semibold text-[#5A7064] hover:text-[#17402C] flex items-center gap-0.5 cursor-pointer"
          >
            <span>+{hiddenCount} autre{hiddenCount > 1 ? 's' : ''}</span>
            <ChevronDown size={11} />
          </button>
        )}
      </div>

      <AnimatePresence>
        <div className="space-y-2.5">
          {visibleAlerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            const isWhyOpen = openWhyId === alert.id;

            return (
              <motion.div
                key={alert.id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
                className={cn(
                  'rounded-[24px] p-3.5 space-y-2.5 border shadow-xs backdrop-blur-md transition-all',
                  isCritical
                    ? 'bg-rose-50/90 dark:bg-rose-950/20 border-rose-200/80 text-[#8A241B]'
                    : 'bg-white/85 dark:bg-stone-900/80 border-white/90 dark:border-white/20 text-[#17402C]'
                )}
                role="alert"
              >
                {/* ── ÉTAGE 1 : ICÔNE + TITRE + BOUTONS SNOOZE / DISMISS ── */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-2xs',
                        isCritical ? 'bg-rose-200/80 text-[#8A241B]' : 'bg-[#2D6B4A]/10 text-[#2D6B4A]'
                      )}
                    >
                      {isCritical ? <AlertTriangle size={14} /> : <AlertCircle size={14} />}
                    </div>

                    <h4 className="text-xs font-bold leading-snug truncate">
                      {alert.title}
                    </h4>
                  </div>

                  {/* Boutons d'action rapide Liquid Glass (Image 4) */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSnooze(alert.id)}
                      className="glass-circle-btn !w-6 !h-6 text-[9.5px] font-bold cursor-pointer text-[#17402C]"
                      title="Reporter de 24h"
                      aria-label={`Reporter l'alerte : ${alert.title}`}
                    >
                      <Clock size={10} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSnooze(alert.id)}
                      className="glass-circle-btn !w-6 !h-6 cursor-pointer text-[#17402C]"
                      title="Masquer"
                      aria-label="Masquer l'alerte"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>

                {/* ── ÉTAGE 2 : MESSAGE EXPLICATIF SANS CHEVAUCHEMENT ── */}
                <p className="text-[11px] text-[#5A7064] dark:text-stone-300 leading-relaxed line-clamp-2">
                  {alert.message}
                </p>

                {/* ── ÉTAGE 3 : PIED D'ACTION (Lien Pourquoi + Bouton Capsule Liquid Glass) ── */}
                <div className="pt-1.5 border-t border-black/5 dark:border-white/10 flex items-center justify-between gap-2">
                  {alert.whyExplanation ? (
                    <button
                      type="button"
                      onClick={() => setOpenWhyId(isWhyOpen ? null : alert.id)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#5A7064] hover:text-[#17402C] cursor-pointer underline underline-offset-2"
                      title="Pourquoi cette alerte ?"
                    >
                      <HelpCircle size={11} />
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
                        'glass-capsule-btn !py-1 !px-3 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition-all active:scale-95',
                        isCritical ? 'primary !bg-[#8A241B] !text-white' : 'primary'
                      )}
                    >
                      <span>{alert.actionLabel}</span>
                      {alert.actionType === 'view_dispo' ? (
                        <ExternalLink size={10} />
                      ) : (
                        <ArrowRight size={10} />
                      )}
                    </button>
                  )}
                </div>

                {/* Volet "Pourquoi cette alerte ?" */}
                <AnimatePresence>
                  {isWhyOpen && alert.whyExplanation && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-[10.5px] p-2.5 rounded-xl bg-white/90 dark:bg-stone-900 border border-black/5 text-[#17402C] leading-relaxed shadow-2xs"
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
