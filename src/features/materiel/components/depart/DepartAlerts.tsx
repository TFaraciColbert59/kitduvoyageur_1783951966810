'use client';
import { useState } from 'react';
import { AlertTriangle, Info, Zap, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { generateSmartPrompts } from '@/features/materiel/services/generateSmartPrompts';
import type { SmartPromptsInput } from '@/features/materiel/services/generateSmartPrompts';
import type { SmartPromptAlert } from '@/features/materiel/types/trekHub';

const MAX_VISIBLE = 3;

const severityIcon = (s: SmartPromptAlert['severity']) => {
  if (s === 'critical') return <Zap size={14} aria-hidden="true" />;
  if (s === 'warning') return <AlertTriangle size={14} aria-hidden="true" />;
  return <Info size={14} aria-hidden="true" />;
};

const severityClasses: Record<SmartPromptAlert['severity'], string> = {
  critical:
    'bg-[rgba(168,68,58,0.10)] border-[rgba(168,68,58,0.25)] text-[#8A241B]',
  warning:
    'bg-[rgba(200,154,59,0.10)] border-[rgba(200,154,59,0.25)] text-[#8C6418]',
  info:
    'bg-[rgba(91,127,85,0.08)] border-[rgba(91,127,85,0.20)] text-[#17402C]',
};

interface DepartAlertsProps {
  input: SmartPromptsInput;
}

export function DepartAlerts({ input }: DepartAlertsProps) {
  const allAlerts = generateSmartPrompts(input);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const visible = allAlerts.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const displayed = expanded ? visible : visible.slice(0, MAX_VISIBLE);
  const hasMore = visible.length > MAX_VISIBLE;

  return (
    <section aria-label="Alertes départ">
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {displayed.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <div
                className={`relative flex items-start gap-3 rounded-2xl border px-3.5 py-3 ${severityClasses[alert.severity]}`}
                role="alert"
                aria-live={alert.severity === 'critical' ? 'assertive' : 'polite'}
              >
                <span className="mt-0.5 shrink-0">{severityIcon(alert.severity)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-[13px] font-semibold leading-snug">{alert.title}</p>
                  <p className="text-[11px] sm:text-xs text-current/80 mt-0.5 leading-relaxed">{alert.message}</p>
                </div>
                <button
                  onClick={() => setDismissed((prev) => new Set(prev).add(alert.id))}
                  className="shrink-0 mt-0.5 p-1 rounded-full hover:bg-current/10 transition-colors focus-visible:outline-2 focus-visible:outline-current"
                  aria-label={`Fermer : ${alert.title}`}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {hasMore && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5A7064] hover:text-[#17402C] transition-colors px-1 focus-visible:outline-2 focus-visible:outline-[#17402C] rounded"
            aria-expanded={expanded}
          >
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={13} aria-hidden="true" />
            </motion.span>
            {expanded ? 'Réduire' : `Voir ${visible.length - MAX_VISIBLE} alerte(s) supplémentaire(s)`}
          </button>
        )}
      </div>
    </section>
  );
}
