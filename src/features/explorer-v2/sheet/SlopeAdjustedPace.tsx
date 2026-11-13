'use client';

import React from 'react';
import { readSlopeAdjustedPace } from '../activity/slopeAdjustedPace';
import type { Sport } from '../state/types';
import { XpEyebrow, XpRow, XpRows } from './blocks';

/**
 * Entrée « Allure ajustée à la pente » de l'onglet Statistiques (S2.09).
 *
 * La fiche demande une ouverture sur action explicite et un retour qui
 * restaure le contexte du drawer parent. Le drawer actuel ne possède qu'un
 * seul niveau d'onglets : ce panneau est donc un **sous-panneau en place**,
 * ouvert par la ligne, qui ne change ni l'onglet ni la hauteur de la feuille.
 * Le bouton « Retour » referme le détail.
 *
 * Aucun nombre n'est affiché : le contrat `readSlopeAdjustedPace` retourne une
 * indisponibilité motivée, et l'interface distingue explicitement :
 *   - ce qui est mesuré (distance, temps en mouvement, D+ GPS) ;
 *   - ce qui est calculé (allure brute dérivée de la vitesse) ;
 *   - ce qui serait estimé (allure ajustée à la pente) et ne l'est pas ;
 *   - ce qui est absent (pente par segment, D− par segment).
 */
export function SlopeAdjustedPacePanel({ sport }: { sport: Sport }) {
  const reading = readSlopeAdjustedPace(sport);
  const [open, setOpen] = React.useState(false);
  if (!reading) return null;

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
