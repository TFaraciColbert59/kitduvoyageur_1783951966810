'use client';
import { useState, useEffect } from 'react';
import { AlertTriangle, Info, Zap, X, ChevronDown, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { generateSmartPrompts, type ActionableAlert, type SmartPromptsInput } from '@/features/materiel/services/generateSmartPrompts';
import { cn } from '@/lib/utils';

const MAX_VISIBLE = 3;
const DISMISS_STORAGE_KEY = 'lkdv_dismissed_depart_alerts_v1';

const severityIcon = (s: ActionableAlert['severity']) => {
  if (s === 'critical') return <Zap size={14} aria-hidden="true" />;
  if (s === 'warning') return <AlertTriangle size={14} aria-hidden="true" />;
  return <Info size={14} aria-hidden="true" />;
};

const severityClasses: Record<ActionableAlert['severity'], { container: string; btn: string }> = {
  critical: {
    container: 'bg-[rgba(168,68,58,0.10)] border-[rgba(168,68,58,0.25)] text-[#8A241B]',
    btn: 'bg-[#8A241B] text-white hover:bg-[#8A241B]/90',
  },
  warning: {
    container: 'bg-[rgba(200,154,59,0.10)] border-[rgba(200,154,59,0.25)] text-[#8C6418]',
    btn: 'bg-[#8C6418] text-white hover:bg-[#8C6418]/90',
  },
  info: {
    container: 'bg-[rgba(91,127,85,0.08)] border-[rgba(91,127,85,0.20)] text-[#17402C]',
    btn: 'bg-[#2D6B4A] text-white hover:bg-[#2D6B4A]/90',
  },
};

interface DepartAlertsProps {
  input: SmartPromptsInput;
}

export function DepartAlerts({ input }: DepartAlertsProps) {
  const shouldReduceMotion = useReducedMotion();
  const allAlerts = generateSmartPrompts(input);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  // Charger les alertes acquittées depuis le localStorage avec horodatage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Expiration après 24h
        const validDismissed = Object.entries(parsed)
          .filter(([_, timestamp]) => Date.now() - Number(timestamp) < 24 * 3600 * 1000)
          .map(([id]) => id);
        setDismissed(new Set(validDismissed));
      }
    } catch {
      // Ignorer erreurs de lecture locale
    }
  }, []);

  const handleDismiss = (id: string) => {
    setDismissed((prev) => {
      const updated = new Set(prev).add(id);
      try {
        const payload: Record<string, number> = {};
        updated.forEach((alertId) => {
          payload[alertId] = Date.now();
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
    } else if (alert.actionType === 'scroll_weather') {
      const el = document.getElementById('section-depart-terrain');
      el?.scrollIntoView({ behavior: 'smooth' });
    } else if (alert.actionType === 'edit_emergency') {
      const el = document.getElementById('section-depart-terrain');
      el?.scrollIntoView({ behavior: 'smooth' });
    } else if (alert.actionType === 'mark_planned') {
      handleDismiss(alert.id);
    } else if (alert.actionType === 'check_item' && alert.targetItemId) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('toggle-item-from-alert', { detail: { id: alert.targetItemId } })
        );
      }
      handleDismiss(alert.id);
    }
  };

  // Filtrer les alertes non acquittées
  const activeAlerts = allAlerts.filter((a) => !dismissed.has(a.id));
  const visibleAlerts = expanded ? activeAlerts : activeAlerts.slice(0, MAX_VISIBLE);
  const hiddenCount = activeAlerts.length - MAX_VISIBLE;

  if (visibleAlerts.length === 0) {
    return (
      <div className="glass rounded-[24px] p-4 sm:p-5 text-center space-y-2 border border-emerald-300/50 bg-emerald-50/40 dark:bg-emerald-950/20">
        <div className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-[#2D6B4A] dark:text-emerald-400 flex items-center justify-center mx-auto shadow-2xs">
          <ShieldCheck size={18} />
        </div>
        <div>
          <h3 className="text-xs sm:text-[13px] font-bold text-[#17402C]">
            Aucun point bloquant détecté
          </h3>
          <p className="text-[11px] text-[#5A7064] mt-0.5 max-w-md mx-auto">
            Vos équipements vitaux, vivres et paramètres de sécurité sont prêts. Aucune alerte critique pour le départ.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5" role="region" aria-label="Alertes avant départ">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A241B] flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-[#8A241B]" />
            À régler avant le départ ({activeAlerts.length})
          </span>
        </div>

        {hiddenCount > 0 && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[11px] font-semibold text-[#5A7064] hover:text-[#17402C] flex items-center gap-1 cursor-pointer"
          >
            <span>+{hiddenCount} autre{hiddenCount > 1 ? 's' : ''}</span>
            <ChevronDown size={12} />
          </button>
        )}
      </div>

      <AnimatePresence>
        <div className="space-y-2">
          {visibleAlerts.map((alert) => {
            const sc = severityClasses[alert.severity] || severityClasses.info;

            return (
              <motion.div
                key={alert.id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
                className={cn(
                  'glass p-3 sm:p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs',
                  sc.container
                )}
                role="alert"
              >
                {/* Icône + Contenu */}
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                    {severityIcon(alert.severity)}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <h3 className="text-xs sm:text-[12.5px] font-bold leading-tight truncate">
                      {alert.title}
                    </h3>
                    <p className="text-[11px] opacity-90 leading-snug line-clamp-2 sm:line-clamp-1">
                      {alert.message}
                    </p>
                  </div>
                </div>

                {/* Actions en 1 tap (§4C) */}
                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  {alert.actionLabel && (
                    <button
                      type="button"
                      onClick={() => handleAction(alert)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer',
                        sc.btn
                      )}
                    >
                      <span>{alert.actionLabel}</span>
                      <ArrowRight size={11} />
                    </button>
                  )}

                  {/* Dismiss discret */}
                  <button
                    type="button"
                    onClick={() => handleDismiss(alert.id)}
                    className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                    title="Masquer cette alerte"
                    aria-label={`Masquer l'alerte : ${alert.title}`}
                  >
                    <X size={13} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </AnimatePresence>
    </div>
  );
}
