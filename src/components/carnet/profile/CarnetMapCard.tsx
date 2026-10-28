'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import type { CarnetPlaceFocus } from './CarnetCard';
import { SUMMARY_FOCUS_KEY, dayTrace, dayTraceFlight, type DayPoint } from './dayTrace';

/** Carte du monde du Compte, telle quelle : MapLibre 3D, HUD, crédits Esri. */
const CompteMap = dynamic(
  () => import('@/components/compte/map/CompteMap').then((mod) => mod.CompteMap),
  {
    ssr: false,
    loading: () => <div className="ckp-mapzone-loading">Initialisation du Relief 3D…</div>,
  },
);

export interface CarnetMapCardProps {
  detail: CarnetDetail;
  /**
   * Points GPS du jour affiché. `null` (défaut) = Résumé → tracé complet du
   * carnet ; `[]` = jour réellement sans point GPS → aucun tracé, état vide.
   * Le tableau doit être stable (mémorisé par l'écran) : son identité et
   * `focusKey` décident du vol de caméra.
   */
  dayPoints?: DayPoint[] | null;
  /** Identifiant stable de la page affichée : `'resume'`, `'j1'`, `'j2'`… */
  focusKey?: string;
  /** Cible de recentrage demandée depuis la ligne de lieu de la carte. */
  focus?: CarnetPlaceFocus | null;
}

/**
 * Carte 3D du bas de la fiche : elle ne peint que le tracé réel de la page
 * affichée — le segment du jour, ou le tracé complet sur le Résumé — avec la
 * même peinture et la même inclinaison que la carte d'une sortie du Compte.
 * Au changement de page, la caméra vole vers ces bornes (900 ms,
 * `cubic-bezier(.22,1,.36,1)`, `pitch 45`) ; `prefers-reduced-motion` la fait
 * sauter sans animation. Sans trace en base, l'état vide est affiché — jamais
 * l'invitation « connecte-toi » de la carte du compte, qui n'a pas de sens ici.
 */
export function CarnetMapCard({
  detail,
  dayPoints = null,
  focusKey = SUMMARY_FOCUS_KEY,
  focus = null,
}: CarnetMapCardProps) {
  /* `isOwner` est calculé côté serveur avec les cookies : c'est la seule
     source fiable pour l'état de la carte (le contexte client peut être en
     retard sur la session). */
  const authState = detail.isOwner ? 'owner' : 'guest';

  /* Tracé de la page : segment du jour, ou tracé complet sur le Résumé. */
  const trace = useMemo(() => dayTrace(detail.trace, dayPoints), [detail.trace, dayPoints]);
  /* Vol mémorisé par page : identité stable tant que `focusKey` ne change pas,
     donc aucune reprise de caméra sur un simple rendu. */
  const traceFlight = useMemo(() => dayTraceFlight(focusKey), [focusKey]);

  return (
    <section className="ckp-mapzone" aria-label={`Carte du monde — ${detail.title}`}>
      <div className="ckp-mapzone-canvas">
        <CompteMap
          authState={authState}
          context={{ mode: 'overview' }}
          focus={focus}
          variant="carnet"
          trace={trace}
          traceFlight={traceFlight}
          emptyTitle="—"
          emptyHint=""
        />
      </div>
      <span className="ckp-mapzone-badge">GLOBE 3D</span>
    </section>
  );
}

export default CarnetMapCard;
