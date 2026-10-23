'use client';

import React from 'react';
import { formatNumber } from '../memories/memoriesModel';

/** Une sortie du bootstrap, déjà normalisée pour l'affichage. */
export interface OutingCardData {
  id: string;
  title: string;
  mass: string;
  date: string;
  startedAt: string;
  km: number | null;
  dplus: number | null;
  proven: boolean;
  photos: string[];
  status: string;
  year: number | null;
  /** Section mensuelle lisible (« Juillet 2026 »), calculée depuis startedAt. */
  monthLabel: string;
}

function photoCountLabel(count: number): string {
  return `${count} photo${count > 1 ? 's' : ''}`;
}

/**
 * Carte sortie du slot Souvenirs — 88 px, couverture, titre, km · D+, massif,
 * date, pastille GPS et nombre de photos. Aucune donnée n'est inventée : la
 * couverture n'apparaît que si le bootstrap fournit une photo réelle.
 */
export function OutingCard({ outing }: { outing: OutingCardData }) {
  const cover = outing.photos[0];
  const hasMeta = Boolean(outing.mass || outing.date);
  const metrics = [
    outing.km !== null ? `${formatNumber(outing.km)} km` : null,
    outing.dplus !== null ? `${formatNumber(outing.dplus)} m D+` : null,
  ].filter((metric): metric is string => metric !== null);

  return (
    <li
      data-testid="outing-card"
      className="flex h-[68px] min-h-[68px] items-center gap-2.5 overflow-hidden rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-2 backdrop-blur-[var(--blur-md)]"
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[var(--lkv-radius-sm)] border border-[color:var(--glass-border)] bg-[color:var(--lkv-surface-muted,rgba(236,244,233,.9))]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- couverture distante fournie par le bootstrap
          <img
            src={cover}
            alt={`Couverture de ${outing.title}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center text-[color:var(--lkv-primary)]"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path d="m3 18 5.5-8 4 5 3-3.5L21 18H3Z" strokeLinejoin="round" />
              <circle cx="16.5" cy="7" r="1.6" />
            </svg>
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h4 className="truncate text-[13px] font-semibold leading-tight text-[color:var(--label)]">
          {outing.title}
        </h4>
        {metrics.length > 0 ? (
          <p className="mt-0.5 truncate font-mono text-[10.5px] font-semibold text-[color:var(--lkv-primary)]">
            {metrics.join(' · ')}
          </p>
        ) : null}
        {hasMeta ? (
          <p className="mt-0 truncate text-[10.5px] text-[color:var(--label2)]">
            {[outing.mass, outing.date].filter(Boolean).join(' · ')}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {outing.proven ? (
          <span
            aria-label="Trace GPS vérifiée"
            className="inline-flex h-[19px] items-center gap-1 rounded-full bg-[color:var(--lkv-primary)] px-1.5 font-mono text-[9.5px] font-bold text-white"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <path d="m5 12 5 5L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            GPS
          </span>
        ) : null}
        {outing.photos.length > 0 ? (
          <span className="font-mono text-[10px] font-semibold text-[color:var(--label2)]">
            {photoCountLabel(outing.photos.length)}
          </span>
        ) : null}
      </div>
    </li>
  );
}

export default OutingCard;
