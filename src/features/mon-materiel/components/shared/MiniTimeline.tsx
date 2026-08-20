'use client';
/**
 * LKDV — MiniTimeline : frise horizontale de dates (retours de prêts, événements).
 */
import React from 'react';

export interface MiniTimelineEvent {
  id: string;
  label: string;   // nom objet / prêt
  date: string;    // ISO date
  icon?: React.ReactNode;
  urgent?: boolean; // surligné en rouge si conflit
}

export interface MiniTimelineItem {
  label: string;
  timestamp: Date;
  subtitle?: string;
}

interface MiniTimelineProps {
  events?: MiniTimelineEvent[];
  items?: MiniTimelineItem[];
  className?: string;
}

function shortDate(d: Date) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function MiniTimeline({ events, items, className = '' }: MiniTimelineProps) {
  const rows: { key: string; label: string; date: Date; subtitle?: string; urgent?: boolean }[] = [];

  if (items) {
    items.forEach((it, i) => {
      rows.push({
        key: `item-${i}`,
        label: it.label,
        date: it.timestamp,
        subtitle: it.subtitle,
      });
    });
  } else {
    (events || []).forEach((ev, i) => {
      rows.push({
        key: ev.id || `ev-${i}`,
        label: ev.label,
        date: new Date(ev.date),
        urgent: ev.urgent,
      });
    });
  }

  if (!rows.length) {
    return <p className="text-xs text-[#1C2620]/40 italic">Aucun événement</p>;
  }
  return (
    <div className={`flex items-start gap-3 overflow-x-auto pb-1 ${className}`}>
      {rows.map((row, i) => (
        <React.Fragment key={row.key}>
          <div className="flex flex-col items-center min-w-[52px]">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm border ${
                row.urgent
                  ? 'border-[#9B2C2C]/40 bg-[#9B2C2C]/10'
                  : 'border-[#2D5A3D]/30 bg-[#2D5A3D]/8'
              }`}
              aria-hidden
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${row.urgent ? 'bg-[#9B2C2C]' : 'bg-[#2D5A3D]'}`}
              />
            </div>
            <span className={`text-[9px] mt-0.5 text-center leading-tight ${row.urgent ? 'text-[#9B2C2C]' : 'text-[#1C2620]/50'}`}>
              {shortDate(row.date)}
            </span>
            <span className="text-[9px] text-center leading-tight text-[#1C2620]/60 max-w-[52px] truncate">
              {row.label}
            </span>
            {row.subtitle && (
              <span className="text-[8px] text-center leading-tight text-[#1C2620]/45 max-w-[52px] truncate">
                {row.subtitle}
              </span>
            )}
          </div>
          {i < rows.length - 1 && (
            <div className="mt-3.5 h-px w-4 bg-[#1C2620]/15 shrink-0" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}