'use client';
import { useState, useEffect } from 'react';
import { AlertTriangle, Info, Zap, X, ChevronDown, ArrowRight, Check } from 'lucide-react';
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
  const visible = allAlerts.filter((a) => !dismissed.has(a.id));

  // Règle d'or (§4B & §2.3) : Si 0 problème, la section disparaît intégralement
  if (visible.length === 0) return null;

  const displayed = expanded ? visible : visible.slice(0, MAX_VISIBLE);
  const hasMore = visible.length > MAX_VISIBLE;

  return (
    <section aria-label="À régler avant le départ" className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#5A7064]">
          À régler avant le départ ({visible.length})
        </h2>
        {hasMore && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#17402C] hover:underline"
            aria-expanded={expanded}
          >
            <span>{expanded ? 'Réduire' : `+${visible.length - MAX_VISIBLE} autres`}</span>
            <ChevronDown size={11} className={cn('transition-transform', expanded && 'rotate-180')} />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {displayed.map((alert) => {
            const styles = severityClasses[alert.severity];

            return (
              <motion.div
                key={alert.id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.16, ease: 'easeOut' }}
              >
                <div
                  className={cn(
                    'relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-3.5 shadow-2xs backdrop-blur-md',
                    styles.container
                  )}
                  role="alert"
                  aria-live={alert.severity === 'critical' ? 'assertive' : 'polite'}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span className="mt-0.5 shrink-0">{severityIcon(alert.severity)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-[13px] font-bold leading-snug">{alert.title}</p>
                      <p className="text-[11px] sm:text-xs text-current/80 mt-0.5 leading-relaxed">
                        {alert.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {alert.actionLabel && (
                      <button
                        type="button"
                        onClick={() => handleAction(alert)}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer',
                          styles.btn
                        )}
                      >
                        <span>{alert.actionLabel}</span>
                        <ArrowRight size={11} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDismiss(alert.id)}
                      className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-current/60 hover:text-current"
                      aria-label={`Ignorer : ${alert.title}`}
                      title="Ignorer cette alerte"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
