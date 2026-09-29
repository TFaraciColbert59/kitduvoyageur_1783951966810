'use client';

import React from 'react';
import { PREP_STEPS, PREP_STEP_LABELS, type PrepStepId } from '../types';
import { canOpenStep, hasStepContent } from '../engine/steps';
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
 * Aspect d un segment — trois pastilles de verre, trois etats.
 *
 * Le composant ne pose plus de couleur : il ne pose que TROIS variables
 * (`--crumb-ink`, `--crumb-edge`, `--crumb-fill`) que la recette CSS
 * (`.prep-crumb__label` / `.prep-crumb__link`) tourne en verre flou, bordure
 * et remplissage. Une seule recette pour tout le rail : c est ce qui rend le
 * passage en pilules verre tenable dans le temps, et ce qui evite au
 * composant d inventer une couleur qu il ne maitrise pas (item H6).
 *
 * L etat reste porte trois fois : `data-state`, `aria-current` pour l etape
 * courante, et la graisse. La couleur ne porte donc jamais l information
 * seule — les trois etats se distinguent aussi en contraste eleve et en
 * daltonisme, par le remplissage et l epaisseur de bordure.
 */
type CrumbStyle = React.CSSProperties &
  Record<'--crumb-ink' | '--crumb-edge' | '--crumb-fill' | '--crumb-sheen', string>;

const SEGMENT_LOOK: Readonly<Record<SegmentState, CrumbStyle>> = {
  active: {
    '--crumb-ink': 'var(--lkv-text-primary)',
    '--crumb-edge': 'var(--prep-ink-accent-strong)',
    '--crumb-fill': 'color-mix(in srgb, var(--lkv-action) 16%, transparent)',
    '--crumb-sheen': 'var(--prep-sheen-top)',
    fontWeight: 720,
  },
  done: {
    '--crumb-ink': 'var(--prep-ink-accent-strong)',
    '--crumb-edge': 'color-mix(in srgb, var(--lkv-action) 42%, transparent)',
    '--crumb-fill': 'color-mix(in srgb, var(--lkv-action) 7%, transparent)',
    '--crumb-sheen': 'var(--prep-sheen-top-soft)',
    fontWeight: 640,
  },
  locked: {
    '--crumb-ink': 'var(--lkv-text-subtle)',
    '--crumb-edge': 'transparent',
    '--crumb-fill': 'transparent',
    '--crumb-sheen': 'transparent',
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
  /**
   * Ouvre une étape atteinte. Absent, le rail reste purement informatif :
   * c'est ce qui permet à un appelant de garder un bandeau sans navigation.
   */
  onOpenStep?: (step: PrepStepId) => void;
}

/**
 * Fil d Ariane du preparateur : trois libelles, un etat par segment.
 *
 * Le bandeau n affiche AUCUN bouton chromé : ni flèche, ni croix, ni
 * filtres, ni icône. C'est la demande, et `prep-crumb` la vérifie.
 *
 * Mais une étape ATTEINTE, elle, répond au doigt. Mesure d avant (393x852,
 * étape 3, parcours réel généré) : les trois étapes étaient des
 * `<span>` sans cible, et le seul retour vers une étape atteinte était un
 * bouton `Revenir à ...` logé dans un conteneur `prep-visually-hidden`
 * mesuré à 1x1 px, `clip-path: inset(50%)` — donc hors de portée du doigt.
 * Consequence : depuis l étape 3 on ne pouvait revenir ni à l étape 1 ni
 * à l étape 2 sans recharger l URL.
 *
 * Le correctif ne change pas l aspect : le bouton reprend la classe et les
 * métriques du libellé, et sa zone de toucher est étendue par un
 * pseudo-élément absolu, sans participation au layout. On ne voit pas la
 * différence, on sent la différence.
 *
 * Le draft reste une prop : il porte l etat `done` / `locked` de chaque
 * segment. Le rail ne calcule rien, il lit.
 */
export function PrepCrumb({ step, draft, onOpenStep }: PrepCrumbProps) {
  return (
    <ol className="prep-crumb" style={CRUMB_BOX} aria-label="Étapes de la préparation">
      {PREP_STEPS.map((id, index) => {
        const isCurrent = id === step;

        // La peinture et le clic lisent la MEME predicate. Mesure du 28/09 :
        // state venait de canOpenStep, reachable de isStepSatisfied - et ces
        // deux-la divergent pour l etape 3, dont le recap derive de
        // l itineraire. Resultat : « En avant ! » etait vert et souligne
        // depuis l etape 2, donc lu comme un lien, sans repondre au doigt.
        const content = hasStepContent(draft, id);
        const state: SegmentState = isCurrent ? 'active' : content ? 'done' : 'locked';

        // Une etape sans contenu ne s'ouvre pas : la 2 tant que l itineraire
        // n existe pas n a rien a montrer, et y sauter contournerait le CTA
        // qui le produit. Des que le contenu existe, les deux sens restent
        // ouverts - dont le retour vers le recapitulatif.
        const reachable =
          id !== step && content && canOpenStep(draft, id) && onOpenStep !== undefined;

        return (
          <React.Fragment key={id}>
            {/* Le separateur n a plus de glyphe : c est un trait de verre,
                dessine en CSS, donc jamais annonce ni jamais coupe en deux
                quand la pastille voisine grandit. */}
            {index > 0 && <li className="prep-crumb__sep" aria-hidden="true" />}
            <li className="prep-crumb__item">
              {reachable ? (
                <button
                  type="button"
                  className="prep-crumb__link"
                  data-step={id}
                  data-state={state}
                  data-current={false}
                  data-done
                  data-locked={false}
                  style={SEGMENT_LOOK[state]}
                  aria-label={`Revenir à ${PREP_STEP_LABELS[id]}`}
                  onClick={() => onOpenStep?.(id)}
                >
                  {PREP_STEP_LABELS[id]}
                </button>
              ) : (
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
              )}
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
  onOpenStep?: (step: PrepStepId) => void;
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
export function PrepNav({ step, draft, onOpenStep }: PrepNavProps) {
  return (
    <nav
      className="prep-nav"
      style={{ position: 'relative', zIndex: 20 }}
      aria-label="Progression de la préparation"
    >
      <PrepCrumb step={step} draft={draft} {...(onOpenStep ? { onOpenStep } : {})} />
    </nav>
  );
}

export default PrepCrumb;
