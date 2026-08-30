'use client';

import React from 'react';
import Link from 'next/link';
import { HubAlert } from '../types/hub.types';

interface SmartPromptsListProps {
  alerts: HubAlert[];
  onDismiss: (id: string) => void;
}

export const SmartPromptsList: React.FC<SmartPromptsListProps> = ({ alerts, onDismiss }) => {
  const visibleAlerts = alerts.filter((a) => !a.isDismissed);

  if (visibleAlerts.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20 text-center">
        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          ✓ Aucune anomalie détectée pour votre départ.
        </p>
      </div>
    );
  }

  const getSeverityStyles = (severity: HubAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-500/10 dark:bg-red-950/30 border-red-500/30',
          badge: 'bg-red-500 text-white',
          title: 'text-red-900 dark:text-red-200',
          text: 'text-red-700 dark:text-red-300',
          btn: 'bg-red-600 text-white hover:bg-red-700',
          icon: '⚠️',
        };
      case 'warning':
        return {
          bg: 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-500/30',
          badge: 'bg-amber-500 text-white',
          title: 'text-amber-900 dark:text-amber-200',
          text: 'text-amber-800 dark:text-amber-300',
          btn: 'bg-amber-600 text-white hover:bg-amber-700',
          icon: '⚡',
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-500/10 dark:bg-blue-950/30 border-blue-500/30',
          badge: 'bg-blue-500 text-white',
          title: 'text-blue-900 dark:text-blue-200',
          text: 'text-blue-800 dark:text-blue-300',
          btn: 'bg-blue-600 text-white hover:bg-blue-700',
          icon: 'ℹ️',
        };
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-mono uppercase tracking-widest text-[#5A7064] dark:text-[#9AAD9E]">
          Smart Prompts & Alertes ({visibleAlerts.length})
        </h4>
      </div>

      <div className="space-y-2.5">
        {visibleAlerts.map((alert) => {
          const style = getSeverityStyles(alert.severity);

          return (
            <div
              key={alert.id}
              className={`p-3.5 rounded-2xl border backdrop-blur-md transition-all ${style.bg}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="text-base leading-none select-none">{style.icon}</span>
                  <div>
                    <h5 className={`text-sm font-semibold tracking-tight ${style.title}`}>
                      {alert.title}
                    </h5>
                    <p className={`text-xs mt-0.5 leading-relaxed ${style.text}`}>
                      {alert.message}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onDismiss(alert.id)}
                  className="text-black/30 dark:text-white/30 hover:text-black/70 dark:hover:text-white/70 p-1 text-xs"
                  aria-label="Fermer cette alerte"
                >
                  ✕
                </button>
              </div>

              {alert.actionLabel && alert.actionHref && (
                <div className="mt-2.5 flex justify-end">
                  <Link
                    href={alert.actionHref}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all ${style.btn}`}
                  >
                    {alert.actionLabel}
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
