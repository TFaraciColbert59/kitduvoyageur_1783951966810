'use client';

/**
 * « Remplacer » — des alternatives REELLES, ou un silence honestement motive.
 *
 * Le bouton avait ete retire et l alternative jamais ajoutee : le tiroir
 * promettait une action sans rien derriere. Ce qui manque, c est le CONTENU —
 * une liste de lieux du meme type, deja presents dans la base, classes par la
 * distance reelle a l etape.
 *
 * Trois regles, aucune negociable :
 *
 *   1. Aucune alternative inventee. La liste vient de `loadBasePlacesNear`,
 *      donc de `/api/pois` ; le classement vient de `alternativesFor`, donc
 *      d une distance orthodromique reelle.
 *   2. Le lieu qu on remplace n est jamais propose : le remplacer par
 *      lui-meme ne remplacerait rien.
 *   3. Stock vide = etat honnete, pas un formulaire a remplir. `GAP_LABELS`
 *      dit CE QUI MANQUE ; il ne montre jamais un exemple de lieu qui
 *      n existe pas.
 *
 * Le tiroir est rendu sur le gabarit (`PrepDrawerTemplate`), comme tous les
 * autres de l etape 1 : c est ce que M1.1 verifie.
 */

import * as React from 'react';
import { A_VERIFIER, formatEur, withUnit } from '../engine/trust';
import { stepById } from '../engine/itinerary';
import {
  alternativesFor,
  GAP_LABELS,
  REFERENCE_LABELS,
  referenceFor,
  referenceOrigin,
  ringFor,
  type AlternativesResult,
} from '../engine/stepAlternatives';
import type { PlaceCandidate, ScoredPlace } from '../engine/places';
import { loadBasePlacesNear } from '../placeSource';
import {
  DrawerActions,
  DrawerEmpty,
  DrawerList,
  DrawerRow,
  DrawerSection,
} from './PrepDrawerTemplate';
import type { AdventurePrepStore } from '../store/useAdventurePrepStore';
import type { AdventurePrepDraft, ItineraryStep, ItineraryStepKind } from '../types';

/**
 * La source des lieux. Par defaut la vraie : `/api/pois`, par boite, avec le
 * filtrage de joignabilite de `loadBasePlacesNear`. Injectable pour un test,
 * jamais pour une donnee de production.
 */
export type PlacesLoader = (
  points: readonly { lat: number; lon: number }[],
  signal: AbortSignal,
) => Promise<PlaceCandidate[]>;

const SOURCE_REELLE: PlacesLoader = (points, signal) =>
  loadBasePlacesNear(points, fetch, signal);

/** Le nom du type d etape, pour que la ligne dise ce qu elle propose. */
const KIND_LABELS: Readonly<Record<ItineraryStepKind, string>> = {
  trajet: 'Trajet',
  arret: 'Lieu',
  repos: 'Pause',
  nuit: 'Hébergement',
  ravitaillement: 'Ravitaillement',
};

export type ReplacePhase = 'chargement' | 'pret' | 'source-muette';

export interface ReplaceSheetProps {
  draft: AdventurePrepDraft;
  actions: AdventurePrepStore;
  /** L etape a remplacer. */
  stepId: string | null;
  onClose: () => void;
  /** La source, par defaut la vraie. */
  loadPlaces?: PlacesLoader;
}

/** Le detail d une alternative : ce que la source sait reellement dire. */
export function alternativeDetail(alternative: ScoredPlace): {
  readonly distance: string;
  readonly category: string;
  readonly price: string;
} {
  const { candidate, distanceKm } = alternative;
  return {
    distance: withUnit(distanceKm, 'km', 1),
    category: candidate.category,
    price: candidate.pricePerNight === null ? A_VERIFIER : formatEur(candidate.pricePerNight),
  };
}

const CHARGEMENT = 'chargement';

export function ReplaceSheet({
  draft,
  actions,
  stepId,
  onClose,
  loadPlaces = SOURCE_REELLE,
}: ReplaceSheetProps) {
  const [candidates, setCandidates] = React.useState<readonly PlaceCandidate[] | null>(null);
  const [phase, setPhase] = React.useState<ReplacePhase>(CHARGEMENT);

  const step: ItineraryStep | undefined =
    stepId === null || draft.itinerary === null ? undefined : stepById(draft.itinerary, stepId);

  // `reference` est memoise A PART : sinon chaque reponse de la source
  // recomputerait un objet nouveau, l effet de chargement se relancerait, et
  // le tiroir redemanderait la meme page indefiniment.
  const reference = React.useMemo(
    () => (step === undefined ? null : referenceFor(step, draft.itinerary)),
    [step, draft.itinerary],
  );
  const origine = React.useMemo(
    () => (step === undefined ? null : referenceOrigin(step, draft.itinerary)),
    [step, draft.itinerary],
  );

  const result: AlternativesResult = React.useMemo(
    () =>
      step === undefined
        ? { ranked: [], gap: 'reference-absente', reference: null }
        : alternativesFor(step, candidates ?? [], draft.itinerary),
    [step, candidates, draft.itinerary],
  );

  React.useEffect(() => {
    if (step === undefined || reference === null) return;
    const controller = new AbortController();
    setPhase(CHARGEMENT);
    loadPlaces(ringFor([reference], 0), controller.signal)
      .then((trouves) => {
        if (controller.signal.aborted) return;
        setCandidates(trouves);
        setPhase('pret');
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        // Une source muete ne se resume pas par une liste : elle dit qu elle
        // n a rien repondu, et le tiroir laisse la decision a la personne.
        setCandidates([]);
        setPhase('source-muette');
      });
    return () => controller.abort();
  }, [step, reference, loadPlaces]);

  if (step === undefined) {
    return (
      <>
        <DrawerSection title="Remplacer cette etape">
          <DrawerEmpty>
            Cette etape n est plus dans le parcours : il n y a rien a remplacer.
          </DrawerEmpty>
        </DrawerSection>
        <DrawerActions onClose={onClose} onApply={onClose} label="Fermer" />
      </>
    );
  }

  return (
    <>
      <DrawerSection title={`Remplacer « ${step.title} »`}>
        {origine === null ? (
          <DrawerEmpty>{GAP_LABELS['reference-absente']}</DrawerEmpty>
        ) : (
          <DrawerList>
            <DrawerRow title={KIND_LABELS[step.kind]} detail={`${step.title} · jour ${step.day}`} />
            <DrawerRow title="Point de reference" detail={REFERENCE_LABELS[origine]} />
          </DrawerList>
        )}
      </DrawerSection>

      <DrawerSection title="Meme categorie, autour de ce point">
        {phase === CHARGEMENT ? (
          <DrawerEmpty>Recherche des etablissements reels autour de ce point…</DrawerEmpty>
        ) : result.ranked.length === 0 ? (
          <DrawerEmpty>
            {phase === 'source-muette'
              ? "La source de lieux n'a pas repondu. Aucune alternative n'est proposee."
              : result.gap === null
                ? GAP_LABELS['stock-vide']
                : GAP_LABELS[result.gap]}
          </DrawerEmpty>
        ) : (
          <DrawerList>
            {result.ranked.map((alternative) => {
              const detail = alternativeDetail(alternative);
              return (
                <DrawerRow
                  key={alternative.candidate.id}
                  title={alternative.candidate.name}
                  detail={`${detail.distance} · ${detail.category} · ${detail.price}`}
                  ariaLabel={`Remplacer par ${alternative.candidate.name}, a ${detail.distance}`}
                  onSelect={() => {
                    // Un seul remplacement, PAS un ajout suivi d une suppression.
                    // ddStepToDay cree une etape SANS position (c est
                    // ssignPlaces qui decide ce qui peut etre pose) : l
                    // alternative choisie pour sa distance reelle retombait donc
                    // hors carte, et la journee se refermait dessus. On passe
                    // donc la position REELLE du lieu, et l etape garde son
                    // identite, son jour, son rang et son lien de repas.
                    void actions
                      .replaceStep(step.id, {
                        title: alternative.candidate.name,
                        placeName: alternative.candidate.name,
                        placeId: alternative.candidate.catalogId ?? null,
                        lat: alternative.candidate.lat,
                        lon: alternative.candidate.lon,
                      })
                      .then(onClose);
                  }}
                />
              );
            })}
          </DrawerList>
        )}
      </DrawerSection>

      <DrawerActions onClose={onClose} onApply={onClose} label="Fermer" />
    </>
  );
}

export default ReplaceSheet;