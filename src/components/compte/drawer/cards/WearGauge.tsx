'use client';

import React from 'react';

/**
 * Seuils d'usure centralisés, jamais réécrits dans le rendu :
 * - `outings` : 30 sorties = 100 % d'usure (échelle de la jauge) ;
 * - `warnPercent` : entretien recommandé dès 80 % (soit 24 sorties).
 */
export const WEAR_LIMITS: Readonly<{ outings: number; warnPercent: number }> = Object.freeze({
  outings: 30,
  warnPercent: 80,
});
export const WEAR_THRESHOLD: number = WEAR_LIMITS.outings;
export const WEAR_WARN_PERCENT: number = WEAR_LIMITS.warnPercent;

/**
 * Usure dérivée des sorties réelles du kit (aucune valeur inventée).
 * `null` quand le nombre de sorties est inconnu : on l'annonce au lieu
 * d'afficher un « 0 % » trompeur.
 */
export function wearPercent(
  outings: number | null | undefined,
  threshold = WEAR_THRESHOLD
): number | null {
  if (typeof outings !== 'number' || !Number.isFinite(outings) || outings < 0) return null;
  return Math.min(100, Math.round((outings / Math.max(1, threshold)) * 100));
}

export interface WearGaugeProps {
  /** Nombre de sorties réellement mesuré pour ce kit. */
  outings?: number | null;
  /** Seuil de sorties avant entretien. */
  threshold?: number;
  /** Nom du kit, pour l'accessibilité. */
  kitName?: string;
  /** Cible du CTA entretien (inventaire par défaut). */
  maintenanceHref?: string;
}

/**
 * Jauge d'usure du kit : valeur dérivée des sorties, seuil, CTA entretien.
 * Le seuil est annoncé en toutes lettres quand l'usure n'est pas mesurée.
 */
export function WearGauge({
  outings,
  threshold = WEAR_THRESHOLD,
  kitName,
  maintenanceHref = '/hub/inventaire',
}: WearGaugeProps) {
  const percent = wearPercent(outings, threshold);
  const due = percent !== null && percent >= WEAR_WARN_PERCENT;
  const label = kitName ? `Usure de ${kitName}` : 'Usure du kit';
  const maintenanceLabel = kitName
    ? `Planifier l’entretien du kit ${kitName}`
    : 'Planifier l’entretien du kit';

  return (
    <div className="lkdv-wear" data-due={due ? 'true' : 'false'}>
      <div className="lkdv-wear-head">
        <span>Usure</span>
        <b>{percent === null ? 'Non mesurée' : `${percent} %`}</b>
      </div>
      <div
        className="lkdv-wear-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? 'Usure non mesurée' : `${percent} % d’usure`}
      >
        <i style={{ width: `${percent ?? 0}%` }} />
      </div>
      <div className="lkdv-wear-foot">
        <span>
          {percent === null
            ? 'Sorties non renseignées'
            : due
              ? 'Entretien recommandé'
              : `Seuil ${threshold} sorties`}
        </span>
        <a className="lkdv-wear-cta" href={maintenanceHref} aria-label={maintenanceLabel}>
          Entretien
        </a>
      </div>
    </div>
  );
}

export const WEAR_GAUGE_CSS = `
.lkdv-wear{display:flex!important;flex-direction:column!important;gap:5px!important;padding:8px 10px!important;border-radius:14px!important;background:rgba(255,255,255,.46)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.92),0 0 0 .5px rgba(23,43,36,.07)!important;}
.lkdv-wear-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;font:600 11px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;color:var(--label2,#56665D)!important;}
.lkdv-wear-head b{font:700 12px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;color:var(--tint,#17402C)!important;font-variant-numeric:tabular-nums!important;}
.lkdv-wear-track{height:6px!important;border-radius:999px!important;background:rgba(23,43,36,.1)!important;overflow:hidden!important;}
.lkdv-wear-track i{display:block!important;height:100%!important;border-radius:999px!important;background:linear-gradient(90deg,#5B7F55,#3D7A52)!important;transition:width .3s ease!important;}
.lkdv-wear[data-due="true"] .lkdv-wear-track i{background:linear-gradient(90deg,#C9A34A,#A97D22)!important;}
.lkdv-wear-foot{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;}
.lkdv-wear-foot span{font:400 10.5px/1.25 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;color:var(--label2,#56665D)!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}
.lkdv-wear-cta{flex:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:44px!important;min-width:44px!important;padding:0 12px!important;border-radius:999px!important;background:rgba(236,244,233,.9)!important;color:var(--tint,#17402C)!important;font:600 11.5px/1 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;text-decoration:none!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1)!important;cursor:pointer!important;}
.lkdv-wear-cta:active{transform:scale(.97)!important;}
.lkdv-wear-cta:focus-visible{outline:none!important;box-shadow:inset 0 0 0 2px #17402C,inset 0 0 0 4px #FFFFFF!important;}
@media (prefers-reduced-motion:reduce){.lkdv-wear-track i{transition:none!important;}.lkdv-wear-cta:active{transform:none!important;}}
`;

export default WearGauge;
