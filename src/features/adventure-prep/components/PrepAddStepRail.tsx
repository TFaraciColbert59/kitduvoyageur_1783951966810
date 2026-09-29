'use client';

/**
 * « Ajouter » — un rail de lieux REELS, au defilement infini.
 *
 * Le composant existant demandait un intitule libre : on écrivait donc le nom
 * d une etape a la main. C est la seule endroit du preparateur ou un lieu
 * pouvait etre invente, et c est precisement ce que la checklist refuse. Ici,
 * rien n est saisissable : le rail n affiche que des lieux que la base a
 * reellement rendus, autour du trace de la journee choisie.
 *
 * Le defilement est infini parce que la source, elle, ne rend pas tout : chaque
 * page elargit REELLEMENT la zone interrogee (voir `ringFor`) et n ajoute que
 * les lieux encore inconnus. Quand le rayon maximal est atteint, le rail le
 * DIT et s arrete — il ne recommence pas a elargir indefiniment.
 *
 * Le tri est explicite et mesure : par distance au trace, ou par nom. Aucun
 * ordre implicite, aucun nom trie a la main.
 */

import * as React from 'react';
import { A_VERIFIER, formatEur, withUnit } from '../engine/trust';
import {
  dayAnchors,
  rankForDay,
  RAIL_MAX_REACH_KM,
  reachForPage,
  ringFor,
  sortRail,
  usedPlaceIds,
  type RailSort,
} from '../engine/stepAlternatives';
import type { PlaceCandidate } from '../engine/places';
import { loadBasePlacesNear } from '../placeSource';
import { DrawerEmpty, DrawerRow, DrawerSection } from './PrepDrawerTemplate';
import type { PlacesLoader } from './PrepStepReplaceSheet';
import type { AdventurePrepStore } from '../store/useAdventurePrepStore';
import type { AdventurePrepDraft, ItineraryStepKind } from '../types';

const SOURCE_REELLE: PlacesLoader = (points, signal) =>
  loadBasePlacesNear(points, fetch, signal);

/** Les natures qu un rail peut proposer. Chacune a de vraies categories. */
export const RAIL_KINDS: readonly { readonly id: ItineraryStepKind; readonly label: string }[] = [
  { id: 'arret', label: 'Lieu' },
  { id: 'nuit', label: 'Hebergement' },
  { id: 'ravitaillement', label: 'Ravitaillement' },
  { id: 'repos', label: 'Pause' },
];

const SORTS: readonly { readonly id: RailSort; readonly label: string }[] = [
  { id: 'distance', label: 'Plus proche du trace' },
  { id: 'nom', label: 'Par nom' },
];

export interface AddStepRailProps {
  draft: AdventurePrepDraft;
  actions: AdventurePrepStore;
  onClose: () => void;
  /** Jour designe par la ligne cliquee ; sinon le premier. */
  day?: number | null;
  /** La source, par defaut la vraie. */
  loadPlaces?: PlacesLoader;
}

export function AddStepRail({
  draft,
  actions,
  onClose,
  day = null,
  loadPlaces = SOURCE_REELLE,
}: AddStepRailProps) {
  const model = draft.itinerary;
  const [kind, setKind] = React.useState<ItineraryStepKind>('arret');
  const [sort, setSort] = React.useState<RailSort>('distance');
  const [jour, setJour] = React.useState<number>(day ?? 1);
  const [bruts, setBruts] = React.useState<readonly PlaceCandidate[]>([]);
  const [page, setPage] = React.useState(0);
  const [chargement, setChargement] = React.useState(false);
  const [sourceMuette, setSourceMuette] = React.useState(false);

  const sentinelle = React.useRef<HTMLLIElement | null>(null);

  const anchors = React.useMemo(() => dayAnchors(model, jour), [model, jour]);
  const anchorKey = anchors.map((anchor) => `${anchor.lat},${anchor.lon}`).join('|');

  React.useEffect(() => {
    if (anchors.length === 0) return;
    const controller = new AbortController();
    setChargement(true);
    loadPlaces(ringFor(anchors, page), controller.signal)
      .then((trouves) => {
        if (controller.signal.aborted) return;
        setBruts((avant) => {
          const vus = new Set(avant.map((candidat) => candidat.id));
          return [...avant, ...trouves.filter((candidat) => !vus.has(candidat.id))];
        });
        setSourceMuette(false);
        setChargement(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setSourceMuette(true);
        setChargement(false);
      });
    return () => controller.abort();
    // `kind` n entre pas : la source renvoie des categories, le filtre, lui,
    // est cote client. Recharger la page pour changer de nature Slowpassait a
    // chaque clic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, anchorKey, loadPlaces]);

  // Le defilement infini : la sentinelle arrive en vue -> page suivante.
  React.useEffect(() => {
    const noeud = sentinelle.current;
    if (noeud === null || typeof IntersectionObserver === 'undefined') return;
    if (anchors.length === 0 || chargement || reachForPage(page) >= RAIL_MAX_REACH_KM) return;
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((entree) => entree.isIntersecting)) setPage((avant) => avant + 1);
      },
      { rootMargin: '120px' },
    );
    observateur.observe(noeud);
    return () => observateur.disconnect();
  }, [anchors.length, chargement, page]);

  const classes = React.useMemo(
    () => sortRail(rankForDay(bruts, anchors, kind, usedPlaceIds(model)), sort),
    [bruts, anchors, kind, model, sort],
  );

  if (model === null) {
    return (
      <DrawerSection title="Ajouter une etape">
        <DrawerEmpty>Il faut d abord un programme pour y ajouter un lieu.</DrawerEmpty>
      </DrawerSection>
    );
  }

  if (anchors.length === 0) {
    return (
      <DrawerSection title="Ajouter une etape">
        <DrawerEmpty>
          Le jour {jour} n a encore aucun point reellement localise : aucun lieu ne peut
          lui etre propose sans inventer une position.
        </DrawerEmpty>
      </DrawerSection>
    );
  }

  const dernier = reachForPage(page) >= RAIL_MAX_REACH_KM;

  return (
    <>
      <DrawerSection title="Nature de l etape">
        <div className="prep-sheet-rail__filters" role="group" aria-label="Nature de l etape">
          {RAIL_KINDS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="prep-sheet-rail__chip"
              aria-pressed={kind === option.id}
              onClick={() => setKind(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="prep-sheet-rail__filters" role="group" aria-label="Jour">
          {Array.from({ length: model.days }, (_, index) => index + 1).map((value) => (
            <button
              key={value}
              type="button"
              className="prep-sheet-rail__chip"
              aria-pressed={jour === value}
              onClick={() => {
                setJour(value);
                setPage(0);
                setBruts([]);
              }}
            >
              Jour {value}
            </button>
          ))}
        </div>
        <div className="prep-sheet-rail__filters" role="group" aria-label="Tri">
          {SORTS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="prep-sheet-rail__chip"
              aria-pressed={sort === option.id}
              onClick={() => setSort(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </DrawerSection>

      <DrawerSection title={`Lieux reels autour du jour ${jour}`}>
        {classes.length === 0 ? (
          <DrawerEmpty>
            {sourceMuette
              ? "La source de lieux n'a pas repondu : rien n'est propose."
              : chargement
                ? 'Recherche des lieux reels autour du trace…'
                : `Aucun ${RAIL_KINDS.find((option) => option.id === kind)?.label.toLowerCase()} n'a ete rendu par la base autour du trace du jour ${jour}.`}
          </DrawerEmpty>
        ) : (
          <ul className="prep-sheet-rail" aria-label="Lieux proposes">
            {classes.map((classe) => (
              <DrawerRow
                key={classe.candidate.id}
                title={classe.candidate.name}
                detail={`${withUnit(classe.distanceKm, 'km', 1)} · ${classe.candidate.category} · ${
                  classe.candidate.pricePerNight === null
                    ? A_VERIFIER
                    : formatEur(classe.candidate.pricePerNight)
                }`}
                ariaLabel={`Ajouter ${classe.candidate.name} au jour ${jour}`}
                onSelect={() => {
                  void actions
                    .addStepToDay(jour, kind, {
                      title: classe.candidate.name,
                      placeName: classe.candidate.name,
                      placeId: classe.candidate.catalogId ?? null,
                    })
                    .then(onClose);
                }}
              />
            ))}
            <li className="prep-sheet-rail__sentinel" ref={sentinelle} aria-hidden="true" />
          </ul>
        )}
        <p className="prep-drawer__note">
          {dernier
            ? `Rayon maximal atteint (${withUnit(RAIL_MAX_REACH_KM, 'km', 0)} autour du trace) : au-dela, ce serait un autre voyage.`
            : `Dejaja demandes jusqu a ${withUnit(reachForPage(page), 'km', 0)} du trace. Le rail continue au defilement.`}
        </p>
      </DrawerSection>
    </>
  );
}

export default AddStepRail;