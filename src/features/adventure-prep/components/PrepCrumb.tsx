'use client';

import React from 'react';
import { PREP_STEPS, PREP_STEP_LABELS, type PrepStepId } from '../types';
import { canOpenStep } from '../engine/steps';
import type { AdventurePrepDraft } from '../types';

/* ------------------------------------------------------------------ */
/* Rail d etapes                                                       */
/* ------------------------------------------------------------------ */

/**
 * Etat d un segment. Un seul, jamais deux : `active` pour l etape courante,
 * `done` pour une etape atteinte, `locked` pour une etape qui ne l est pas
 * encore. L etat est un `data-` ET une valeur de couleur : la couleur ne
 * porte jamais l information seule.
 */
type SegmentState = 'active' | 'done' | 'locked';

/**
 * Aspect d un segment.
 *
 * Le soulignement fait la difference : epais et plein pour l etape courante,
 * discret pour une etape terminee, absent pour une etape verrouillee. Trois
 * etats restent donc distinguables sans la couleur, en contraste eleve comme
 * en daltonisme.
 *
 * Le CSS porte deja `border-bottom: 2px solid transparent` sur
 * `.prep-crumb__label` : on ne change que la couleur du trait, jamais son
 * epaisseur, pour que la ligne du bas ne saute pas d un etat a l autre.
 */
const SEGMENT_LOOK: Readonly<Record<SegmentState, React.CSSProperties>> = {
  active: {
    color: 'var(--lkv-text-primary)',
    borderBottomColor: 'var(--lkv-action)',
    fontWeight: 720,
  },
  done: {
    color: 'var(--lkv-action)',
    borderBottomColor: 'color-mix(in srgb, var(--lkv-action) 34%, transparent)',
    fontWeight: 640,
  },
  locked: {
    color: 'var(--lkv-text-subtle)',
    borderBottomColor: 'transparent',
    fontWeight: 560,
  },
};

/**
 * Le rail occupe les trois colonnes du bandeau.
 *
 * La grille de `.prep-nav` garde deux colonnes d icone latérales ; sans cet
 * etirement le rail se retrouverait cantonne a la largeur d une icone. Les
 * colonnes restent vides et symetriques, ce qui centre le rail sans couche
 * supplementaire.
 */
const CRUMB_BOX: React.CSSProperties = { gridColumn: '1 / -1' };

export interface PrepCrumbProps {
  step: PrepStepId;
  draft: AdventurePrepDraft;
}

/**
 * Fil d Ariane du preparateur : trois libelles, un etat par segment, rien
 * d actionnable.
 *
 * Aucun bouton ici. Revenir en arriere, revenir au hub et ouvrir les
 * preferences ne sont plus des affordances du bandeau : le bandeau informe,
 * il ne pilote pas. Les capacites qu il portait restent accessibles — voir
 * `PrepNavActions` dans `AdventurePrepShell` — et le tactile les retrouve par
 * le bouton systeme et par la barre d onglets basse.
 *
 * Le draft reste une prop : il porte l etat `done` / `locked` de chaque
 * segment. Le rail ne calcule rien, il lit.
 */
export function PrepCrumb({ step, draft }: PrepCrumbProps) {
  return (
    <ol className="prep-crumb" style={CRUMB_BOX} aria-label="Étapes de la préparation">
      {PREP_STEPS.map((id, index) => {
        const isCurrent = id === step;
        const state: SegmentState = isCurrent
          ? 'active'
          : canOpenStep(draft, id)
            ? 'done'
            : 'locked';

        return (
          <React.Fragment key={id}>
            {index > 0 && (
              <li className="prep-crumb__sep" aria-hidden="true">
                ·
              </li>
            )}
            <li className="prep-crumb__item">
              <span
                className="prep-crumb__label"
                data-state={state}
                data-current={isCurrent}
                data-done={state === 'done'}
                data-locked={state === 'locked'}
                style={SEGMENT_LOOK[state]}
                {...(isCurrent ? { 'aria-current': 'step' as const } : {})}
              >
                {PREP_STEP_LABELS[id]}
              </span>
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Bandeau haut                                                        */
/* ------------------------------------------------------------------ */

/** Seules ces deux props restent : le bandeau n'a plus d'action a transmettre. */
export interface PrepNavProps {
  step: PrepStepId;
  draft: AdventurePrepDraft;
}

/**
 * Bandeau haut du preparateur : 52 px, verre, et rien d'autre qu'un rail.
 *
 * Ni fleche de retour, ni croix, ni bouton de filtres — c'est la demande
 * explicite, et les tests `prep-crumb` / `prep-nav` la verifient sur le HTML
 * rendu. Ce qui portait ces trois boutons n'a pas disparu : la navigation vers
 * le hub, la feuille des preferences et le retour vers une etape atteinte sont
 * rendus hors du flux visuel par le shell.
 *
 * La barre d onglets basse, elle, reste visible : MobileNavWrapper ne masque
 * plus /prepare et la route rend AppShell hasBottomNav, donc la reservation
 * `--bottom-nav-height` vaut exactement la hauteur reelle de la barre.
 */
export function PrepNav({ step, draft }: PrepNavProps) {
  return (
    <nav
      className="prep-nav"
      style={{ position: 'relative', zIndex: 20 }}
      aria-label="Progression de la préparation"
    >
      <PrepCrumb step={step} draft={draft} />
    </nav>
  );
}

export default PrepCrumb;