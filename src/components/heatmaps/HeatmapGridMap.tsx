'use client';

import React, { useMemo } from 'react';
import {
  MAP_VIEWBOX,
  bandColor,
  bandLabel,
  computeMapBounds,
  projectCells,
  type GeoBounds,
  type MapRect,
} from './heatmapViewModel';
import type { PersonalHeatmapCell, PublicHeatmapCell } from '@/features/heatmaps/types';

export type HeatmapMapCell = PublicHeatmapCell | PersonalHeatmapCell;

export interface HeatmapGridMapProps {
  cells: readonly HeatmapMapCell[];
  kind: 'community' | 'personal';
  /** Résumé accessible (nombre de cellules, sport, fenêtre). */
  label: string;
  className?: string;
}

const BANDS = ['low', 'medium', 'high', 'peak'] as const;

function cellTitle(cell: HeatmapMapCell): string {
  if ('activityCount' in cell) {
    return `${cell.activityCount} sortie${cell.activityCount > 1 ? 's' : ''} dans cette cellule`;
  }
  return `${cell.distinctContributorCount} contributeurs, ${cell.passageCount} passages`;
}

function buildRects(cells: readonly HeatmapMapCell[], bounds: GeoBounds): MapRect[] {
  return projectCells(cells, bounds).map((rect, index) => ({
    ...rect,
    title: cellTitle(cells[index]),
  }));
}

/**
 * Aperçu cartographique de la grille agrégée.
 *
 * Ce n'est pas un fond de carte : aucune tuile, aucun lieu nommé, aucune
 * coordonnée brute. Chaque rectangle est une cellule quantifiée du moteur C02,
 * ce qui rend l'aperçu testable et strictement égal aux données publiées.
 */
export default function HeatmapGridMap({
  cells,
  kind,
  label,
  className = '',
}: HeatmapGridMapProps) {
  const bounds = useMemo(() => computeMapBounds(cells), [cells]);
  const rects = useMemo(() => buildRects(cells, bounds), [cells, bounds]);
  const empty = cells.length === 0;
  const titleId = React.useId();

  return (
    <figure
      className={`g1 overflow-hidden rounded-[var(--lkv-radius-card)] border border-[color:var(--glass-border-color)] shadow-sm ${className}`}
      style={{ background: 'var(--glass-subtle-fill)' }}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div>
          <figcaption className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
            {kind === 'community' ? 'Grille communautaire' : 'Vos zones parcourues'}
          </figcaption>
          <p className="mt-0.5 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
            Cellules agrégées · projection équirectangulaire
          </p>
        </div>
        <span
          aria-hidden="true"
          className="rounded-full border border-[color:var(--glass-border-color)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--lkv-text-secondary)]"
        >
          {kind === 'community' ? 'Public' : 'Privé'}
        </span>
      </div>

      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
          role="img"
          aria-labelledby={titleId}
          aria-describedby={`${titleId}-desc`}
          className="h-auto w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <title id={titleId}>{label}</title>
          <desc id={`${titleId}-desc`}>
            {empty
              ? 'Aucune cellule publiable pour ces filtres.'
              : `${cells.length} cellules agrégées affichées, sans coordonnée brute.`}
          </desc>

          <rect
            x="0"
            y="0"
            width={MAP_VIEWBOX.width}
            height={MAP_VIEWBOX.height}
            fill="var(--lkv-forest-50)"
          />
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
            <g key={ratio} aria-hidden="true">
              <line
                x1="0"
                x2={MAP_VIEWBOX.width}
                y1={MAP_VIEWBOX.height * ratio}
                y2={MAP_VIEWBOX.height * ratio}
                stroke="var(--lkv-border-subtle)"
                strokeWidth="1"
              />
              <line
                x1={MAP_VIEWBOX.width * ratio}
                x2={MAP_VIEWBOX.width * ratio}
                y1="0"
                y2={MAP_VIEWBOX.height}
                stroke="var(--lkv-border-subtle)"
                strokeWidth="1"
              />
            </g>
          ))}

          {rects.map((rect) => (
            <rect
              key={rect.cellId}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={Math.min(4, rect.width / 3, rect.height / 3)}
              fill={rect.fill}
              fillOpacity={rect.opacity}
              stroke="var(--lkv-forest-900)"
              strokeOpacity="0.18"
              strokeWidth="0.6"
            >
              <title>{rect.title}</title>
            </rect>
          ))}

          {empty && (
            <g>
              <rect
                x={MAP_VIEWBOX.width / 2 - 190}
                y={MAP_VIEWBOX.height / 2 - 44}
                width="380"
                height="88"
                rx="18"
                fill="var(--glass-bg-strong)"
                stroke="var(--glass-border-color)"
              />
              <text
                x={MAP_VIEWBOX.width / 2}
                y={MAP_VIEWBOX.height / 2 - 6}
                textAnchor="middle"
                fill="var(--lkv-text-primary)"
                fontSize="20"
                fontWeight="600"
              >
                Aucune cellule publiable
              </text>
              <text
                x={MAP_VIEWBOX.width / 2}
                y={MAP_VIEWBOX.height / 2 + 20}
                textAnchor="middle"
                fill="var(--lkv-text-secondary)"
                fontSize="14"
              >
                Le seuil de confidentialité protège encore ces traces.
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-4 pt-1">
        {BANDS.map((band) => (
          <span
            key={band}
            className="inline-flex items-center gap-1.5 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]"
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ background: bandColor(band) }}
            />
            {bandLabel(band)}
          </span>
        ))}
      </div>
    </figure>
  );
}
