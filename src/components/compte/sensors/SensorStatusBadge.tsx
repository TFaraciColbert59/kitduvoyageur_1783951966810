import React from 'react';

export type SensorStatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface SensorStatusBadgeProps {
  label: string;
  tone?: SensorStatusTone;
  /** Détail secondaire, par exemple un pourcentage de batterie. */
  detail?: string;
  className?: string;
}

/** Pastille compacte d'état ; le ton seul porte la couleur, jamais le texte. */
export function SensorStatusBadge({
  label,
  tone = 'neutral',
  detail,
  className = '',
}: SensorStatusBadgeProps) {
  return (
    <span className={`lkdv-sensor-badge ${className}`.trim()} data-tone={tone}>
      <span className="lkdv-sensor-badge-dot" aria-hidden="true" />
      <span>{label}</span>
      {detail ? <span className="lkdv-sensor-badge-detail">{detail}</span> : null}
    </span>
  );
}

export default SensorStatusBadge;
