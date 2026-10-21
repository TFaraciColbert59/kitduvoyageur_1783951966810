'use client';

import React from 'react';
import { StatTile } from '../cards/StatTile';

export type VitrineLens = 'stats' | 'repost' | 'badges';

export interface VitrineStats {
  km?: number;
  dplus?: number;
  outings?: number;
  nights?: number;
  massifs?: number;
  countries?: number;
  /** 12 valeurs, une par mois (janvier → décembre). */
  yearMonths?: number[];
  bestMonth?: string;
  longestOuting?: number;
}

export interface VitrineSlotProps {
  /** Lentille active fournie par `ProfileDrawerHost` : stats, repost ou badges. */
  lens?: VitrineLens | string;
  /**
   * Payload du bootstrap (contrat hôte) : `payload.stats`, `payload.reposts`,
   * `payload.badges`. Les props directes restent acceptées pour les tests et
   * pour un montage isolé.
   */
  payload?: unknown;
  stats?: VitrineStats | null;
  viewer?: 'owner' | 'visitor';
}

const MONTHS_LONG = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;

const MONTHS_SHORT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const;

const NUMBER_FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const INTEGER_FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asFiniteNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(asFiniteNumber(value));
}

function formatInteger(value: number): string {
  return INTEGER_FORMAT.format(Math.round(asFiniteNumber(value)));
}

function formatKm(value: number): string {
  return `${formatNumber(value)} km`;
}

function formatMeters(value: number): string {
  return `${formatInteger(value)} m`;
}

/**
 * Normalise uniquement les champs attendus. Aucune valeur de repli n'est
 * inventée : un champ absent devient 0 ou une chaîne vide, ce qui reste un
 * affichage explicite et vérifiable.
 */
function readStats(value: unknown): VitrineStats | null {
  const record = asRecord(value);
  const keys = Object.keys(record);
  if (keys.length === 0) return null;
  const yearMonths = Array.isArray(record.yearMonths)
    ? record.yearMonths.slice(0, 12).map(asFiniteNumber)
    : [];
  return {
    km: asFiniteNumber(record.km),
    dplus: asFiniteNumber(record.dplus),
    outings: asFiniteNumber(record.outings),
    nights: asFiniteNumber(record.nights),
    massifs: asFiniteNumber(record.massifs),
    countries: asFiniteNumber(record.countries),
    yearMonths,
    bestMonth: typeof record.bestMonth === 'string' ? record.bestMonth : '',
    longestOuting: asFiniteNumber(record.longestOuting),
  };
}

const ROUTE_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M3 19h18M6 19l5-11 4 7 3-4 3 8" />
    <path d="M9 12h2" />
  </svg>
);

const NIGHT_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M20 14.5A7.5 7.5 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </svg>
);

const MOUNTAIN_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="m3 19 6-12 4 7 2-3 6 8H3Z" />
    <path d="m7 12 2 1 1-2" />
  </svg>
);

const GLOBE_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.6 2.4 4 5.3 4 8.5s-1.4 6.1-4 8.5c-2.6-2.4-4-5.3-4-8.5s1.4-6.1 4-8.5Z" />
  </svg>
);

function EmptyVitrine({ lens, label }: { lens: VitrineLens; label: string }) {
  return (
    <div
      className="lkdv-vitrine"
      data-state="empty"
      data-testid="slot-content"
      data-slot="vitrine"
      data-lens={lens}
    >
      <style>{VITRINE_CSS}</style>
      <div className="lkdv-slot-state" data-state="empty">
        <span className="lkdv-slot-state-ico" aria-hidden="true">
          ○
        </span>
        <p>{label}</p>
      </div>
    </div>
  );
}

function StatsLens({ stats }: { stats: VitrineStats }) {
  const yearMonths = MONTHS_LONG.map((_, index) => asFiniteNumber(stats.yearMonths?.[index]));
  const maxMonth = Math.max(0, ...yearMonths);
  const hasYearData = maxMonth > 0;

  return (
    <div
      className="lkdv-vitrine"
      data-state="ready"
      data-testid="slot-content"
      data-slot="vitrine"
      data-lens="stats"
    >
      <style>{VITRINE_CSS}</style>

      <section className="lkdv-vitrine-card lkdv-vitrine-hero" aria-label="Statistiques clés">
        <div className="lkdv-vitrine-metric">
          <b>{formatKm(stats.km ?? 0)}</b>
          <span>Distance</span>
        </div>
        <div className="lkdv-vitrine-metric">
          <b>{formatMeters(stats.dplus ?? 0)}</b>
          <span>Dénivelé positif</span>
        </div>
        <div className="lkdv-vitrine-metric">
          <b>{formatInteger(stats.outings ?? 0)}</b>
          <span>Sorties</span>
        </div>
      </section>

      <div className="lkdv-vitrine-tiles" role="list" aria-label="Repères de la vitrine">
        <StatTile label="Nuits" value={formatInteger(stats.nights ?? 0)} icon={NIGHT_ICON} />
        <StatTile label="Massifs" value={formatInteger(stats.massifs ?? 0)} icon={MOUNTAIN_ICON} />
        <StatTile label="Pays" value={formatInteger(stats.countries ?? 0)} icon={GLOBE_ICON} />
      </div>

      <section className="lkdv-vitrine-card lkdv-vitrine-year" aria-labelledby="lkdv-vitrine-year-title">
        <header className="lkdv-vitrine-year-head">
          <h3 id="lkdv-vitrine-year-title">Cette année</h3>
          <span aria-hidden="true">{ROUTE_ICON}</span>
        </header>

        <div className="lkdv-vitrine-bars" role="group" aria-label="Distance parcourue par mois">
          {yearMonths.map((value, index) => {
            const height = hasYearData
              ? Math.max(4, Math.round((value / maxMonth) * 100))
              : 4;
            const label = `${MONTHS_LONG[index]} : ${formatNumber(value)} km`;
            return (
              <div className="lkdv-vitrine-month" key={MONTHS_LONG[index]}>
                <div
                  className="lkdv-vitrine-bar"
                  data-testid="vitrine-month-bar"
                  role="img"
                  aria-label={label}
                  title={label}
                >
                  <i style={{ height: `${height}%` }} />
                </div>
                <small aria-hidden="true">{MONTHS_SHORT[index]}</small>
              </div>
            );
          })}
        </div>

        {hasYearData ? null : (
          <p className="lkdv-vitrine-note">Aucune sortie enregistrée cette année.</p>
        )}

        <div className="lkdv-vitrine-year-foot">
          <div>
            <span>Meilleur mois</span>
            <b>{stats.bestMonth?.trim() || '—'}</b>
          </div>
          <div>
            <span>Plus longue sortie</span>
            <b>{formatKm(stats.longestOuting ?? 0)}</b>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Slot Vitrine du drawer Profil.
 *
 * La lentille `stats` affiche les agrégats réels du bootstrap. Les lentilles
 * `repost` et `badges` sont livrées par la tâche suivante : d'ici là elles
 * gardent un état vide explicite, sans donnée inventée.
 */
export function VitrineSlot({ lens, payload, stats: statsProp, viewer }: VitrineSlotProps) {
  const normalizedLens: VitrineLens =
    lens === 'repost' || lens === 'badges' ? lens : 'stats';
  const data = asRecord(payload);
  const stats = readStats(statsProp ?? data.stats);
  const owner = viewer !== 'visitor' && data.viewer !== 'visitor';

  if (normalizedLens === 'repost') {
    return (
      <EmptyVitrine
        lens="repost"
        label={owner ? 'Aucune republication pour le moment.' : 'Aucune republication publique.'}
      />
    );
  }

  if (normalizedLens === 'badges') {
    return <EmptyVitrine lens="badges" label="Aucun badge pour le moment." />;
  }

  if (!stats) {
    return <EmptyVitrine lens="stats" label="Aucune statistique à afficher pour le moment." />;
  }

  return <StatsLens stats={stats} />;
}

/**
 * Styles scopés du slot. Ils ne créent aucune palette : uniquement les tokens
 * verre du runtime et les classes existantes (`.li`, `.mbtn`, `--glass-*`).
 */
export const VITRINE_CSS = `
.lkdv-vitrine{display:flex;flex-direction:column;gap:8px;padding:0 0 2px;color:var(--label);}
.lkdv-vitrine-card{border-radius:20px;background:var(--glass-bg-medium,rgba(255,255,255,.46));border:.5px solid var(--glass-border,rgba(23,43,36,.12));box-shadow:inset 0 1px 0 rgba(255,255,255,.92),0 6px 18px rgba(23,43,36,.06);padding:11px 12px;box-sizing:border-box;}
.lkdv-vitrine-hero{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;padding:12px 6px;}
.lkdv-vitrine-metric{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0;padding:0 4px;text-align:center;}
.lkdv-vitrine-metric+.lkdv-vitrine-metric::before{content:"";position:absolute;left:0;top:4px;bottom:4px;width:.5px;background:var(--sep,rgba(23,43,36,.1));}
.lkdv-vitrine-metric b{display:block;font-family:var(--sf);font-weight:700;font-size:clamp(20px,7.2vw,28px);line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:var(--label);white-space:nowrap;}
.lkdv-vitrine-metric span{display:block;font-family:var(--sf);font-weight:600;font-size:9.5px;line-height:1.15;letter-spacing:.02em;text-transform:uppercase;color:var(--label2);text-align:center;}
.lkdv-vitrine-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;}
.lkdv-vitrine .lkdv-stat-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-width:0;min-height:60px;padding:7px 5px;border-top:0;border-radius:16px;background:var(--glass-bg-medium,rgba(255,255,255,.46));box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px var(--glass-border,rgba(23,43,36,.1));text-align:center;box-sizing:border-box;}
.lkdv-stat-tile-ico{display:grid;place-items:center;width:16px;height:16px;color:var(--accent);opacity:.9;}
.lkdv-stat-tile-ico svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}
.lkdv-stat-tile-value{display:block;font-family:var(--sf);font-weight:700;font-size:19px;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--label);}
.lkdv-stat-tile-label{display:block;font-family:var(--sf);font-weight:600;font-size:9px;line-height:1.15;letter-spacing:.03em;text-transform:uppercase;color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
.lkdv-vitrine-year{display:flex;flex-direction:column;gap:8px;}
.lkdv-vitrine-year-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.lkdv-vitrine-year-head h3{margin:0;font-family:var(--sf);font-weight:700;font-size:14px;line-height:1.2;letter-spacing:-.01em;color:var(--label);}
.lkdv-vitrine-year-head>span{display:grid;place-items:center;width:18px;height:18px;color:var(--accent);opacity:.8;}
.lkdv-vitrine-year-head svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}
.lkdv-vitrine-bars{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:3px;align-items:end;}
.lkdv-vitrine-month{display:flex;flex-direction:column;align-items:stretch;gap:2px;min-width:0;}
.lkdv-vitrine-bar{height:62px;display:flex;align-items:flex-end;border-radius:5px;background:rgba(23,43,36,.05);overflow:hidden;}
.lkdv-vitrine-bar i{display:block;width:100%;border-radius:4px 4px 2px 2px;background:linear-gradient(180deg,var(--accent,#5B7F55),var(--tint,#17402C));}
.lkdv-vitrine-month small{display:block;font-family:var(--sf);font-weight:600;font-size:7.5px;line-height:1;color:var(--label3);text-align:center;}
.lkdv-vitrine-note{margin:0;font-family:var(--sf);font-size:11px;line-height:1.3;color:var(--label2);}
.lkdv-vitrine-year-foot{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:2px;border-top:.5px solid var(--sep,rgba(23,43,36,.1));}
.lkdv-vitrine-year-foot div{min-width:0;display:flex;flex-direction:column;gap:1px;}
.lkdv-vitrine-year-foot span{font-family:var(--sf);font-weight:500;font-size:9.5px;line-height:1.15;color:var(--label2);}
.lkdv-vitrine-year-foot b{font-family:var(--sf);font-weight:700;font-size:13px;line-height:1.2;color:var(--label);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
@media (prefers-reduced-motion:reduce){.lkdv-vitrine,.lkdv-vitrine *{transition:none!important;animation:none!important;}}
`;

export default VitrineSlot;
