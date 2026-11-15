'use client';

import React from 'react';
import {
  readSlopeAdjustedPace,
  type GapTracePoint,
  type SlopeAdjustedPaceResult,
} from '../activity/slopeAdjustedPace';
import { formatMetricValue, type MetricUnits } from '../activity/metrics';
import type { Sport } from '../state/types';
import { XpEyebrow, XpRow, XpRows } from './blocks';

/**
 * Entrée « Allure ajustée à la pente » de l'onglet Statistiques (S2.09).
 *
 * Calcule le GAP réel via le modèle de coût énergétique de Minetti (2002) dès
 * que la trace contient au moins deux points avec coordonnées, horodatage et
 * altitude. À défaut, conserve une indisponibilité motivée sans rien inventer.
 * Distingue explicitement :
 *   - mesuré : distance GPS, temps en mouvement, dénivelé ;
 *   - calculé : allure brute, pente par segment ;
 *   - estimé : allure ajustée à la pente (GAP, method: minetti-2002-v1).
 */
export function SlopeAdjustedPacePanel({
  sport,
  points,
  units = 'metric',
  result,
}: {
  sport: Sport;
  points?: readonly GapTracePoint[];
  units?: MetricUnits;
  result?: SlopeAdjustedPaceResult | null;
}) {
  const reading = result ?? readSlopeAdjustedPace(sport, points);
  const [open, setOpen] = React.useState(false);
  if (!reading) return null;

  if (reading.status === 'unavailable') {
    return (
      <>
        <XpEyebrow>Allure ajustée à la pente</XpEyebrow>
        <XpRows>
          <XpRow
            icon="timer"
            title="Allure équivalente sur plat"
            sub={
              open
                ? 'Détail ouvert · aucune valeur calculée'
                : 'Aucune estimation calculée · méthode non disponible'
            }
            badge={{ label: 'indisponible', tone: 'muted' }}
            onClick={() => setOpen((value) => !value)}
            ariaExpanded={open}
            ariaLabel={
              open
                ? 'Fermer le détail de l’allure ajustée à la pente'
                : 'Ouvrir le détail de l’allure ajustée à la pente'
            }
          />
        </XpRows>
        {open ? (
          <>
            <p
              style={{
                margin: '10px 2px 8px',
                fontSize: 11.5,
                lineHeight: 1.45,
                color: 'var(--xp-mut)',
              }}
            >
              {reading.reason}
            </p>
            <XpRows>
              <XpRow
                icon="route"
                title="Mesuré"
                sub="Distance · temps en mouvement · D+ GPS"
              />
              <XpRow
                icon="gauge"
                title="Calculé"
                sub="Allure brute dérivée de la vitesse GPS"
              />
              <XpRow
                icon="alert"
                title="Absent"
                sub="Pente et D− par segment"
                tone="muted"
              />
              <XpRow icon="alert" title="Estimé" sub="Aucune valeur produite" tone="warn" />
              <XpRow
                icon="info"
                title="Équivalence"
                sub="Aucune équivalence propriétaire revendiquée"
              />
              <XpRow
                icon="chevl"
                title="Retour"
                sub="Fermer le détail et revenir aux statistiques."
                onClick={() => setOpen(false)}
              />
            </XpRows>
            <p
              style={{
                margin: '10px 2px 0',
                fontSize: 11.5,
                lineHeight: 1.45,
                color: 'var(--xp-mut)',
              }}
            >
              Une future valeur serait étiquetée « estimée », jamais « mesurée ». Aucune
              équivalence avec un algorithme propriétaire n’est revendiquée.
            </p>
          </>
        ) : null}
      </>
    );
  }

  const gapFormatted = formatMetricValue('pace', reading.gapPaceSecondsPerKm, units);
  const rawFormatted = formatMetricValue('pace', reading.rawPaceSecondsPerKm, units);

  return (
    <>
      <XpEyebrow>Allure ajustée à la pente</XpEyebrow>
      <XpRows>
        <XpRow
          icon="timer"
          title={`Allure équivalente sur plat : ${gapFormatted}`}
          sub={`Allure brute ${rawFormatted} · pente moy. ${reading.averageGradePercent.toFixed(1)} %`}
          badge={{ label: 'estimée', tone: 'good' }}
          onClick={() => setOpen((value) => !value)}
          ariaExpanded={open}
          ariaLabel={
            open
              ? 'Fermer le détail de l’allure ajustée à la pente'
              : 'Ouvrir le détail de l’allure ajustée à la pente'
          }
        />
      </XpRows>
      {open ? (
        <>
          <XpRows>
            <XpRow
              icon="route"
              title="Mesuré"
              sub={`${(reading.coveredDistanceM / 1000).toFixed(2)} km · ${Math.round(reading.coveredDurationS)} s · altitude GPS`}
            />
            <XpRow
              icon="gauge"
              title="Calculé"
              sub={`Allure brute ${rawFormatted} · facteur pente ×${reading.gradeFactor.toFixed(2)} (${reading.segments.length} segments)`}
            />
            <XpRow
              icon="timer"
              title="Estimé"
              sub={`GAP ${gapFormatted} · modèle Minetti (2002) ${reading.method}`}
            />
            <XpRow
              icon="info"
              title="Équivalence"
              sub="Modèle ouvert Minetti (2002), aucune équivalence propriétaire revendiquée"
            />
            <XpRow
              icon="chevl"
              title="Retour"
              sub="Fermer le détail et revenir aux statistiques."
              onClick={() => setOpen(false)}
            />
          </XpRows>
        </>
      ) : null}
    </>
  );
}
