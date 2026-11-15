'use client';

import React from 'react';
import { MUSCLE_LABELS, type MuscleGroupId, type MuscleHeatmapSummary } from './muscles';

function muscleFill(intensity: number): string {
  if (intensity <= 0) return 'rgba(148, 163, 184, 0.22)';
  if (intensity < 0.35) return '#FCD34D';
  if (intensity < 0.7) return '#F97316';
  return '#DC2626';
}

export interface MuscleMapSvgProps {
  heatmap: MuscleHeatmapSummary;
  compact?: boolean;
}

export function MuscleMapSvg({ heatmap, compact = false }: MuscleMapSvgProps) {
  const s = heatmap.scoreByMuscle;
  const zoneProps = (id: MuscleGroupId) => ({
    fill: muscleFill(s[id]),
    stroke: 'rgba(15, 23, 42, 0.35)',
    strokeWidth: 1,
    'data-muscle': id,
    'data-intensity': String(s[id]),
  });

  const activeLabels = heatmap.muscles.slice(0, 5).map((m) => m.label).join(', ');

  return (
    <div className="xp-strength-muscle-map" data-testid="strength-muscle-map">
      <svg
        viewBox="0 0 260 190"
        width={compact ? 210 : 260}
        height={compact ? 154 : 190}
        role="img"
        aria-label={
          activeLabels
            ? `Carte anatomique des muscles sollicités : ${activeLabels}`
            : 'Carte anatomique des muscles (aucun muscle ciblé)'
        }
        style={{ display: 'block', maxWidth: '100%' }}
      >
        {/* Vue Face */}
        <g aria-label="Face avant">
          <text x="62" y="12" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.65">
            Face
          </text>
          <circle cx="62" cy="26" r="9" fill="rgba(148,163,184,0.22)" />
          {/* Épaules */}
          <ellipse cx="40" cy="46" rx="7" ry="6" {...zoneProps('epaules')} />
          <ellipse cx="84" cy="46" rx="7" ry="6" {...zoneProps('epaules')} />
          {/* Pectoraux */}
          <rect x="46" y="40" width="15" height="14" rx="4" {...zoneProps('pectoraux')} />
          <rect x="63" y="40" width="15" height="14" rx="4" {...zoneProps('pectoraux')} />
          {/* Biceps */}
          <rect x="33" y="53" width="7" height="18" rx="3" {...zoneProps('biceps')} />
          <rect x="84" y="53" width="7" height="18" rx="3" {...zoneProps('biceps')} />
          {/* Avant-bras */}
          <rect x="31" y="73" width="6" height="18" rx="3" {...zoneProps('avant_bras')} />
          <rect x="87" y="73" width="6" height="18" rx="3" {...zoneProps('avant_bras')} />
          {/* Abdos */}
          <rect x="50" y="56" width="24" height="28" rx="4" {...zoneProps('abdos')} />
          {/* Quadriceps */}
          <rect x="46" y="88" width="14" height="38" rx="5" {...zoneProps('quadriceps')} />
          <rect x="64" y="88" width="14" height="38" rx="5" {...zoneProps('quadriceps')} />
          {/* Tibias */}
          <rect x="48" y="130" width="10" height="36" rx="4" fill="rgba(148,163,184,0.16)" />
          <rect x="66" y="130" width="10" height="36" rx="4" fill="rgba(148,163,184,0.16)" />
        </g>

        {/* Vue Dos */}
        <g transform="translate(132,0)" aria-label="Face arrière">
          <text x="62" y="12" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.65">
            Dos
          </text>
          <circle cx="62" cy="26" r="9" fill="rgba(148,163,184,0.22)" />
          {/* Épaules */}
          <ellipse cx="40" cy="46" rx="7" ry="6" {...zoneProps('epaules')} />
          <ellipse cx="84" cy="46" rx="7" ry="6" {...zoneProps('epaules')} />
          {/* Dos */}
          <polygon points="45,40 79,40 72,78 52,78" {...zoneProps('dos')} />
          {/* Triceps */}
          <rect x="33" y="53" width="7" height="18" rx="3" {...zoneProps('triceps')} />
          <rect x="84" y="53" width="7" height="18" rx="3" {...zoneProps('triceps')} />
          {/* Fessiers */}
          <rect x="46" y="80" width="15" height="16" rx="5" {...zoneProps('fessiers')} />
          <rect x="63" y="80" width="15" height="16" rx="5" {...zoneProps('fessiers')} />
          {/* Ischios */}
          <rect x="47" y="98" width="13" height="28" rx="5" {...zoneProps('ischios')} />
          <rect x="64" y="98" width="13" height="28" rx="5" {...zoneProps('ischios')} />
          {/* Mollets */}
          <rect x="48" y="130" width="11" height="32" rx="4" {...zoneProps('mollets')} />
          <rect x="65" y="130" width="11" height="32" rx="4" {...zoneProps('mollets')} />
        </g>
      </svg>

      {heatmap.muscles.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 4, fontSize: 12 }}>
          {heatmap.muscles.map((m) => (
            <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    marginRight: 6,
                    background: muscleFill(m.intensity),
                  }}
                />
                {MUSCLE_LABELS[m.id]} ({m.role === 'primary' ? 'principal' : 'secondaire'})
              </span>
              <span>
                {m.sets} série{m.sets > 1 ? 's' : ''}
                {m.volumeKg !== null ? ` · ${m.volumeKg} kg` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 12, opacity: 0.72, margin: '6px 0 0' }}>
          Ajoute un exercice reconnu (squat, développé couché, tractions, fentes, gainage…) pour
          visualiser la carte musculaire.
        </p>
      )}
    </div>
  );
}
